import Foundation
import Security

private let account = "SYNTHETIC_NONPRODUCTION_ITEM"
private let helperAlias = "NATIVE_E2E_SYNTHETIC"
private let trustedExecutable = "/usr/bin/security"
private let syntheticOnlyExecutable = "/usr/bin/true"
private let requiredPartition = "apple-tool:"
private let syntheticInitialPartition = "teamid:0000000000"
private let maximumCaptureBytes = 64 * 1024

private struct ACLSnapshot: Equatable {
    let authorizations: [String]
    let applications: [Data]?
    let description: String
    let selector: UInt16
}

guard CommandLine.arguments.count == 3 else {
    exit(64)
}

private let helperPath = CommandLine.arguments[1]
private let attemptId = CommandLine.arguments[2]
guard attemptId.count == 36,
      UUID(uuidString: attemptId) != nil,
      attemptId == attemptId.lowercased() else {
    exit(64)
}

private let service = "com.prometheus.synthetic.keychain-acl-v2.\(attemptId)"

private func wipe(_ data: inout Data) {
    guard !data.isEmpty else { return }
    data.resetBytes(in: 0..<data.count)
}

private func applicationData(_ application: SecTrustedApplication) -> Data? {
    var copied: CFData?
    guard SecTrustedApplicationCopyData(application, &copied) == errSecSuccess,
          let copied else {
        return nil
    }
    return copied as Data
}

private func copyContents(_ acl: SecACL) -> (
    applications: [SecTrustedApplication]?,
    description: CFString,
    selector: SecKeychainPromptSelector
)? {
    var applicationList: CFArray?
    var description: CFString?
    var selector = SecKeychainPromptSelector(rawValue: 0)
    guard SecACLCopyContents(
        acl,
        &applicationList,
        &description,
        &selector
    ) == errSecSuccess,
    let description else {
        return nil
    }
    if applicationList == nil {
        return (nil, description, selector)
    }
    guard let applications = applicationList as? [SecTrustedApplication] else {
        return nil
    }
    return (applications, description, selector)
}

private func authorizations(_ acl: SecACL) -> Set<String>? {
    guard let values = SecACLCopyAuthorizations(acl) as? [CFString] else {
        return nil
    }
    return Set(values.map { $0 as String })
}

private func decodeHex(_ value: String) -> Data? {
    guard !value.isEmpty,
          value.utf8.count <= maximumCaptureBytes,
          value.count.isMultiple(of: 2) else {
        return nil
    }
    var data = Data(capacity: value.count / 2)
    var index = value.startIndex
    while index < value.endIndex {
        let next = value.index(index, offsetBy: 2)
        guard let byte = UInt8(value[index..<next], radix: 16) else {
            wipe(&data)
            return nil
        }
        data.append(byte)
        index = next
    }
    return data
}

private func partitionList(_ description: CFString) -> [String]? {
    guard var bytes = decodeHex(description as String) else {
        return nil
    }
    defer { wipe(&bytes) }
    guard let value = try? PropertyListSerialization.propertyList(
        from: bytes,
        options: [],
        format: nil
    ),
    let dictionary = value as? [String: Any],
    Set(dictionary.keys) == Set(["Partitions"]),
    let partitions = dictionary["Partitions"] as? [String],
    !partitions.isEmpty,
    Set(partitions).count == partitions.count else {
        return nil
    }
    return partitions
}

private func partitionDescription(_ partitions: [String]) -> CFString? {
    guard let data = try? PropertyListSerialization.data(
        fromPropertyList: ["Partitions": partitions],
        format: .xml,
        options: 0
    ) else {
        return nil
    }
    return data.map { String(format: "%02X", $0) }.joined() as CFString
}

private func syntheticAccess() -> SecAccess? {
    var access: SecAccess?
    var partitionACL: SecACL?
    var syntheticOnlyApplication: SecTrustedApplication?
    guard SecTrustedApplicationCreateFromPath(
        syntheticOnlyExecutable,
        &syntheticOnlyApplication
    ) == errSecSuccess,
    let syntheticOnlyApplication,
    SecAccessCreate(
        "Prometheus synthetic Keychain ACL v2" as CFString,
        [syntheticOnlyApplication] as CFArray,
        &access
    ) == errSecSuccess,
    let access,
    SecACLCreateWithSimpleContents(
        access,
        nil,
        "Prometheus synthetic partition ACL" as CFString,
        SecKeychainPromptSelector(rawValue: 0),
        &partitionACL
    ) == errSecSuccess,
    let partitionACL,
    SecACLUpdateAuthorizations(
        partitionACL,
        [kSecACLAuthorizationPartitionID] as CFArray
    ) == errSecSuccess,
    let description = partitionDescription([syntheticInitialPartition]),
    SecACLSetContents(
        partitionACL,
        nil,
        description,
        SecKeychainPromptSelector(rawValue: 0)
    ) == errSecSuccess else {
        return nil
    }
    return access
}

private func snapshot(_ item: SecKeychainItem) -> [ACLSnapshot]? {
    var access: SecAccess?
    var copiedACLs: CFArray?
    guard SecKeychainItemCopyAccess(item, &access) == errSecSuccess,
          let access,
          SecAccessCopyACLList(access, &copiedACLs) == errSecSuccess,
          let acls = copiedACLs as? [SecACL] else {
        return nil
    }
    var result: [ACLSnapshot] = []
    for acl in acls {
        guard let rights = authorizations(acl),
              let contents = copyContents(acl) else {
            return nil
        }
        let applications: [Data]?
        if let trustedApplications = contents.applications {
            let copied = trustedApplications.compactMap(applicationData)
            guard copied.count == trustedApplications.count else {
                return nil
            }
            applications = copied
        } else {
            applications = nil
        }
        result.append(ACLSnapshot(
            authorizations: rights.sorted(),
            applications: applications,
            description: contents.description as String,
            selector: contents.selector.rawValue
        ))
    }
    return result
}

private func trustedSecurityData() -> Data? {
    var application: SecTrustedApplication?
    guard SecTrustedApplicationCreateFromPath(trustedExecutable, &application) == errSecSuccess,
          let application else {
        return nil
    }
    return applicationData(application)
}

private func exactComponentState(_ item: SecKeychainItem) -> (retrieval: Bool, partition: Bool)? {
    guard let snapshots = snapshot(item),
          let trustedData = trustedSecurityData() else {
        return nil
    }
    let decrypt = kSecACLAuthorizationDecrypt as String
    let partitionID = kSecACLAuthorizationPartitionID as String
    var retrieval = false
    var partition = false
    for acl in snapshots {
        if Set(acl.authorizations).contains(decrypt),
           let applications = acl.applications {
            retrieval = retrieval || applications.filter { $0 == trustedData }.count == 1
        }
        if Set(acl.authorizations) == Set([partitionID]),
           let partitions = partitionList(acl.description as CFString) {
            partition = partition || partitions.contains(requiredPartition)
        }
    }
    return (retrieval, partition)
}

private func verifyMinimumGrant(_ item: SecKeychainItem) -> Bool {
    guard let snapshots = snapshot(item),
          let trustedData = trustedSecurityData() else {
        return false
    }
    let decrypt = kSecACLAuthorizationDecrypt as String
    let exportClear = kSecACLAuthorizationExportClear as String
    let partitionID = kSecACLAuthorizationPartitionID as String
    var retrievalCount = 0
    var partitionCount = 0
    for acl in snapshots {
        let rights = Set(acl.authorizations)
        if rights.contains(decrypt),
           let applications = acl.applications,
           applications.filter({ $0 == trustedData }).count == 1 {
            guard rights == Set([decrypt]),
                  !rights.contains(exportClear),
                  applications.count == 1 else {
                return false
            }
            retrievalCount += 1
        }
        if rights == Set([partitionID]) {
            guard let partitions = partitionList(acl.description as CFString),
                  partitions.filter({ $0 == requiredPartition }).count == 1 else {
                return false
            }
            partitionCount += 1
        }
    }
    return retrievalCount == 1 && partitionCount == 1
}

private func runSilent(_ executable: String, _ arguments: [String], expectedStatus: Int32) -> Bool {
    let process = Process()
    let standardOutput = Pipe()
    let standardError = Pipe()
    process.executableURL = URL(fileURLWithPath: executable)
    process.arguments = arguments
    process.standardOutput = standardOutput
    process.standardError = standardError
    do {
        try process.run()
    } catch {
        return false
    }
    process.waitUntilExit()
    var output = standardOutput.fileHandleForReading.readDataToEndOfFile()
    var error = standardError.fileHandleForReading.readDataToEndOfFile()
    defer {
        wipe(&output)
        wipe(&error)
    }
    return output.count <= maximumCaptureBytes
        && error.count <= maximumCaptureBytes
        && output.isEmpty
        && process.terminationStatus == expectedStatus
}

private func verifyUnattendedRead(_ expected: Data) -> Bool {
    let process = Process()
    let standardOutput = Pipe()
    let standardError = Pipe()
    process.executableURL = URL(fileURLWithPath: trustedExecutable)
    process.arguments = ["find-generic-password", "-s", service, "-a", account, "-w"]
    process.standardOutput = standardOutput
    process.standardError = standardError
    do {
        try process.run()
    } catch {
        return false
    }
    process.waitUntilExit()
    var output = standardOutput.fileHandleForReading.readDataToEndOfFile()
    var error = standardError.fileHandleForReading.readDataToEndOfFile()
    var expectedWithNewline = expected
    expectedWithNewline.append(0x0a)
    defer {
        wipe(&output)
        wipe(&error)
        wipe(&expectedWithNewline)
    }
    return output.count <= maximumCaptureBytes
        && error.count <= maximumCaptureBytes
        && error.isEmpty
        && process.terminationStatus == 0
        && (output == expected || output == expectedWithNewline)
}

private func interactionStatus() -> Int32 {
    let process = Process()
    let standardOutput = Pipe()
    let standardError = Pipe()
    process.executableURL = URL(fileURLWithPath: trustedExecutable)
    process.arguments = ["find-generic-password", "-s", service, "-a", account, "-w"]
    process.standardOutput = standardOutput
    process.standardError = standardError
    do {
        try process.run()
    } catch {
        return -1
    }
    process.waitUntilExit()
    var output = standardOutput.fileHandleForReading.readDataToEndOfFile()
    var error = standardError.fileHandleForReading.readDataToEndOfFile()
    defer {
        wipe(&output)
        wipe(&error)
    }
    guard output.count <= maximumCaptureBytes,
          error.count <= maximumCaptureBytes else { return -1 }
    return process.terminationStatus
}

private func setAccessFailureExitCode(_ status: OSStatus) -> Int32 {
    switch status {
    case errSecInvalidItemRef:
        return 81
    case errSecAuthFailed:
        return 82
    case errSecInteractionNotAllowed:
        return 83
    case errSecNotAvailable:
        return 84
    case errSecParam, errSecUnimplemented:
        return 85
    default:
        return 89
    }
}

var syntheticValue = Data("synthetic-nonproduction-value".utf8)
defer { wipe(&syntheticValue) }
guard let access = syntheticAccess() else { exit(65) }
var attributes: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service,
    kSecAttrAccount as String: account,
    kSecValueData as String: syntheticValue,
    kSecUseDataProtectionKeychain as String: kCFBooleanFalse as Any
]
attributes[kSecReturnRef as String] = kCFBooleanTrue as Any
var createdItem: CFTypeRef?
guard SecItemAdd(attributes as CFDictionary, &createdItem) == errSecSuccess else { exit(66) }
guard let createdItem,
      CFGetTypeID(createdItem) == SecKeychainItemGetTypeID() else { exit(67) }
let item = createdItem as! SecKeychainItem
let setAccessStatus = SecKeychainItemSetAccess(item, access)
guard setAccessStatus == errSecSuccess else { exit(setAccessFailureExitCode(setAccessStatus)) }
guard let initialSnapshot = snapshot(item) else { exit(69) }
guard let initialState = exactComponentState(item),
      !initialState.retrieval,
      !initialState.partition else { exit(70) }
let initialReadStatus = interactionStatus()
// Both security(1) interaction statuses are classified as
// INTERACTION_REQUIRED by the fixed unattended classifier.
guard [36, 128].contains(initialReadStatus) else { exit(77) }
guard runSilent(helperPath, ["inspect", helperAlias], expectedStatus: 12) else { exit(70) }
guard runSilent(helperPath, ["grant", helperAlias], expectedStatus: 32) else { exit(71) }
guard verifyMinimumGrant(item) else { exit(72) }
guard verifyUnattendedRead(syntheticValue) else { exit(73) }
guard runSilent(helperPath, ["revoke", helperAlias, "both"], expectedStatus: 42) else { exit(74) }
guard runSilent(helperPath, ["inspect", helperAlias], expectedStatus: 12) else { exit(75) }
guard snapshot(item) == initialSnapshot else { exit(76) }

exit(0)
