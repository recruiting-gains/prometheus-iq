import Foundation
import Security

private let account = "SYNTHETIC_NONPRODUCTION_ITEM"
private let helperAlias = "NATIVE_E2E_SYNTHETIC"
private let trustedExecutable = "/usr/bin/security"
private let syntheticOnlyExecutable = CommandLine.arguments.first ?? ""
private let requiredPartition = "apple-tool:"
private let syntheticInitialPartition = "teamid:0000000000"
private let maximumCaptureBytes = 64 * 1024
private let maximumKeychainPathBytes = 4096
private let childProcessTimeoutSeconds = 5.0

private struct ACLSnapshot: Equatable {
    let authorizations: [String]
    let applications: [Data]?
    let description: String
    let selector: UInt16
}

private struct UserKeychainSelection: Equatable {
    var searchListPaths: [Data]
    var defaultPath: Data

    mutating func wipePaths() {
        for index in searchListPaths.indices {
            wipe(&searchListPaths[index])
        }
        wipe(&defaultPath)
    }
}

private enum PositiveReadResult {
    case success
    case launchFailed
    case timeout
    case commandFailed
    case outputMismatch
}

private enum FixtureMode: String {
    case lifecycle = "LIFECYCLE"
    case matrixAppleToolOnly = "MATRIX_APPLE_TOOL_ONLY"
    case matrixAppleOnly = "MATRIX_APPLE_ONLY"
    case matrixAppleToolPlusApple = "MATRIX_APPLE_TOOL_PLUS_APPLE"
    case matrixDecryptOnly = "MATRIX_DECRYPT_ONLY"
    case matrixExportClearOnly = "MATRIX_EXPORT_CLEAR_ONLY"
    case matrixDecryptPlusExportClear = "MATRIX_DECRYPT_PLUS_EXPORT_CLEAR"

    var matrixConfiguration: (partitions: [String], authorizations: [CFString])? {
        switch self {
        case .lifecycle:
            return nil
        case .matrixAppleToolOnly:
            return (["apple-tool:"], [kSecACLAuthorizationDecrypt])
        case .matrixAppleOnly:
            return (["apple:"], [kSecACLAuthorizationDecrypt])
        case .matrixAppleToolPlusApple:
            return (["apple-tool:", "apple:"], [kSecACLAuthorizationDecrypt])
        case .matrixDecryptOnly:
            return (["apple-tool:"], [kSecACLAuthorizationDecrypt])
        case .matrixExportClearOnly:
            return (["apple-tool:"], [kSecACLAuthorizationExportClear])
        case .matrixDecryptPlusExportClear:
            return (["apple-tool:"], [
                kSecACLAuthorizationDecrypt,
                kSecACLAuthorizationExportClear
            ])
        }
    }
}

guard CommandLine.arguments.count == 6 else {
    exit(64)
}

private let helperPath = CommandLine.arguments[1]
private let attemptId = CommandLine.arguments[2]
private let keychainPath = CommandLine.arguments[3]
private let phasePath = CommandLine.arguments[4]
private let fixtureMode = FixtureMode(rawValue: CommandLine.arguments[5])
guard attemptId.count == 36,
      UUID(uuidString: attemptId) != nil,
      attemptId == attemptId.lowercased(),
      syntheticOnlyExecutable.hasPrefix("/"),
      FileManager.default.isExecutableFile(atPath: syntheticOnlyExecutable),
      helperPath.hasPrefix("/"),
      !helperPath.contains(".."),
      FileManager.default.isExecutableFile(atPath: helperPath),
      keychainPath.hasPrefix("/"),
      !keychainPath.contains(".."),
      phasePath.hasPrefix("/"),
      !phasePath.contains(".."),
      fixtureMode != nil else {
    exit(64)
}

private let service = "com.prometheus.synthetic.keychain-acl-v2.\(attemptId)"
private let phaseLabels: Set<String> = [
    "USER_KEYCHAIN_SELECTION_BEFORE_CAPTURED",
    "KEYCHAIN_CREATE_STARTED",
    "KEYCHAIN_CREATED",
    "KEYCHAIN_UNLOCKED",
    "ITEM_CREATED_WITH_INITIAL_ACCESS",
    "INITIAL_ACL_VALIDATED",
    "MATRIX_ACCESS_VALIDATED",
    "MATRIX_READ_STARTED",
    "MATRIX_READ_PASSED",
    "HELPER_INSPECTED",
    "HELPER_GRANTED",
    "GRANT_VALIDATED",
    "POSITIVE_READ_STARTED",
    "POSITIVE_READ_PASSED",
    "HELPER_REVOKED",
    "RESTORE_VALIDATED",
    "KEYCHAIN_DELETE_DEFERRED",
    "KEYCHAIN_DELETE_REQUESTED",
    "KEYCHAIN_ABSENT",
    "USER_KEYCHAIN_SELECTION_RESTORED"
]

private func recordPhase(_ phase: String) -> Bool {
    guard phaseLabels.contains(phase),
          let data = phase.data(using: .ascii) else {
        return false
    }
    defer {
        var wipeable = data
        wipe(&wipeable)
    }
    do {
        try data.write(to: URL(fileURLWithPath: phasePath), options: .atomic)
        return true
    } catch {
        return false
    }
}

private func wipe(_ data: inout Data) {
    guard !data.isEmpty else { return }
    data.resetBytes(in: 0..<data.count)
}

private func normalizedKeychainPath(_ keychain: SecKeychain) -> Data? {
    var pathBuffer = [CChar](repeating: 0, count: maximumKeychainPathBytes)
    var pathLength = UInt32(pathBuffer.count)
    defer {
        for index in pathBuffer.indices {
            pathBuffer[index] = 0
        }
    }
    let status = pathBuffer.withUnsafeMutableBufferPointer { buffer in
        SecKeychainGetPath(keychain, &pathLength, buffer.baseAddress!)
    }
    guard status == errSecSuccess,
          pathLength > 0,
          pathLength < UInt32(pathBuffer.count) else {
        return nil
    }
    return pathBuffer.withUnsafeBufferPointer {
        Data(bytes: $0.baseAddress!, count: Int(pathLength))
    }
}

private func copyUserKeychainSelection() -> UserKeychainSelection? {
    autoreleasepool {
        var copiedSearchList: CFArray?
        guard SecKeychainCopyDomainSearchList(
            SecPreferencesDomain.user,
            &copiedSearchList
        ) == errSecSuccess,
        let copiedSearchList,
        let keychains = copiedSearchList as? [SecKeychain] else {
            return nil
        }
        var searchListPaths: [Data] = []
        for keychain in keychains {
            guard let path = normalizedKeychainPath(keychain) else {
                for index in searchListPaths.indices {
                    wipe(&searchListPaths[index])
                }
                return nil
            }
            searchListPaths.append(path)
        }
        var defaultKeychain: SecKeychain?
        guard SecKeychainCopyDomainDefault(
            SecPreferencesDomain.user,
            &defaultKeychain
        ) == errSecSuccess,
        let defaultKeychain,
        let defaultPath = normalizedKeychainPath(defaultKeychain) else {
            for index in searchListPaths.indices {
                wipe(&searchListPaths[index])
            }
            return nil
        }
        return UserKeychainSelection(
            searchListPaths: searchListPaths,
            defaultPath: defaultPath
        )
    }
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

private func syntheticAccess(
    partitions: [String],
    securityAuthorizations: [CFString]?
) -> SecAccess? {
    var access: SecAccess?
    var partitionACL: SecACL?
    var retrievalACL: SecACL?
    var syntheticOnlyApplication: SecTrustedApplication?
    var helperApplication: SecTrustedApplication?
    var securityApplication: SecTrustedApplication?
    guard SecTrustedApplicationCreateFromPath(
        syntheticOnlyExecutable,
        &syntheticOnlyApplication
    ) == errSecSuccess,
    let syntheticOnlyApplication,
    SecTrustedApplicationCreateFromPath(
        helperPath,
        &helperApplication
    ) == errSecSuccess,
    let helperApplication,
    SecAccessCreate(
        "Prometheus synthetic Keychain ACL v2" as CFString,
        [syntheticOnlyApplication, helperApplication] as CFArray,
        &access
    ) == errSecSuccess,
    let access,
    let changeACLs = SecAccessCopyMatchingACLList(
        access,
        kSecACLAuthorizationChangeACL
    ) as? [SecACL],
    changeACLs.count == 1,
    let changeContents = copyContents(changeACLs[0]),
    SecACLSetContents(
        changeACLs[0],
        [syntheticOnlyApplication, helperApplication] as CFArray,
        changeContents.description,
        changeContents.selector
    ) == errSecSuccess,
    (securityAuthorizations == nil || (
        SecTrustedApplicationCreateFromPath(
            trustedExecutable,
            &securityApplication
        ) == errSecSuccess
        && securityApplication != nil
        && SecACLCreateWithSimpleContents(
            access,
            [securityApplication!] as CFArray,
            "Prometheus synthetic matrix retrieval" as CFString,
            SecKeychainPromptSelector(rawValue: 0),
            &retrievalACL
        ) == errSecSuccess
        && retrievalACL != nil
        && SecACLUpdateAuthorizations(
            retrievalACL!,
            securityAuthorizations! as CFArray
        ) == errSecSuccess
    )),
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
    let description = partitionDescription(partitions),
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

private func trustedApplicationData(_ path: String) -> Data? {
    var application: SecTrustedApplication?
    guard SecTrustedApplicationCreateFromPath(path, &application) == errSecSuccess,
          let application else {
        return nil
    }
    return applicationData(application)
}

private func findPersistedSyntheticItem(_ keychain: SecKeychain) -> SecKeychainItem? {
    var item: SecKeychainItem?
    let status = service.withCString { servicePointer in
        account.withCString { accountPointer in
            SecKeychainFindGenericPassword(
                keychain,
                UInt32(strlen(servicePointer)),
                servicePointer,
                UInt32(strlen(accountPointer)),
                accountPointer,
                nil,
                nil,
                &item
            )
        }
    }
    return status == errSecSuccess ? item : nil
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

private func verifyInitialAdministrativeACL(_ item: SecKeychainItem) -> Bool {
    guard let snapshots = snapshot(item),
          let fixtureData = trustedApplicationData(syntheticOnlyExecutable),
          let helperData = trustedApplicationData(helperPath) else {
        return false
    }
    let changeACL = kSecACLAuthorizationChangeACL as String
    let expectedApplications = [fixtureData, helperData]
    let matches = snapshots.filter { acl in
        guard Set(acl.authorizations) == Set([changeACL]),
              let applications = acl.applications,
              applications.count == expectedApplications.count else {
            return false
        }
        return expectedApplications.allSatisfy { expected in
            applications.filter { $0 == expected }.count == 1
        }
    }
    return matches.count == 1
        && snapshots.filter { $0.authorizations.contains(changeACL) }.count == 1
}

private func verifyMatrixAccess(
    _ item: SecKeychainItem,
    partitions: [String],
    authorizations expectedAuthorizations: [CFString]
) -> Bool {
    guard let snapshots = snapshot(item),
          let securityData = trustedSecurityData() else {
        return false
    }
    let partitionID = kSecACLAuthorizationPartitionID as String
    let expectedRights = Set(expectedAuthorizations.map { $0 as String })
    var securityACLCount = 0
    var partitionACLCount = 0
    for acl in snapshots {
        let rights = Set(acl.authorizations)
        if let applications = acl.applications,
           applications.contains(securityData) {
            guard rights == expectedRights,
                  applications.count == 1,
                  applications.filter({ $0 == securityData }).count == 1 else {
                return false
            }
            securityACLCount += 1
        }
        if rights == Set([partitionID]) {
            guard let actual = partitionList(acl.description as CFString),
                  actual == partitions else {
                return false
            }
            partitionACLCount += 1
        }
    }
    return securityACLCount == 1 && partitionACLCount == 1
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

private func waitForBoundedExit(_ process: Process) -> Bool {
    let deadline = Date().addingTimeInterval(childProcessTimeoutSeconds)
    while process.isRunning && Date() < deadline {
        Thread.sleep(forTimeInterval: 0.025)
    }
    guard process.isRunning else {
        process.waitUntilExit()
        return true
    }
    process.terminate()
    for _ in 0..<20 where process.isRunning {
        Thread.sleep(forTimeInterval: 0.025)
    }
    if process.isRunning {
        _ = kill(process.processIdentifier, SIGKILL)
    }
    process.waitUntilExit()
    return false
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
    let completed = waitForBoundedExit(process)
    var output = standardOutput.fileHandleForReading.readDataToEndOfFile()
    var error = standardError.fileHandleForReading.readDataToEndOfFile()
    defer {
        wipe(&output)
        wipe(&error)
    }
    return completed
        && output.count <= maximumCaptureBytes
        && error.count <= maximumCaptureBytes
        && output.isEmpty
        && process.terminationStatus == expectedStatus
}

private func verifyUnattendedRead(_ expected: Data) -> PositiveReadResult {
    let process = Process()
    let standardOutput = Pipe()
    let standardError = Pipe()
    process.executableURL = URL(fileURLWithPath: trustedExecutable)
    process.arguments = ["find-generic-password", "-s", service, "-a", account, "-w", keychainPath]
    process.standardInput = FileHandle.nullDevice
    process.standardOutput = standardOutput
    process.standardError = standardError
    do {
        try process.run()
    } catch {
        return .launchFailed
    }
    let completed = waitForBoundedExit(process)
    var output = standardOutput.fileHandleForReading.readDataToEndOfFile()
    var error = standardError.fileHandleForReading.readDataToEndOfFile()
    var expectedWithNewline = expected
    expectedWithNewline.append(0x0a)
    defer {
        wipe(&output)
        wipe(&error)
        wipe(&expectedWithNewline)
    }
    guard completed else { return .timeout }
    guard output.count <= maximumCaptureBytes,
          error.count <= maximumCaptureBytes else { return .outputMismatch }
    guard process.terminationStatus == 0,
          error.isEmpty else { return .commandFailed }
    return output == expected || output == expectedWithNewline
        ? .success
        : .outputMismatch
}

private func itemCreateFailureExitCode(_ status: OSStatus) -> Int32 {
    switch status {
    case errSecInteractionNotAllowed:
        return 81
    case errSecAuthFailed:
        return 82
    case errSecNotAvailable:
        return 83
    case errSecParam, errSecUnimplemented:
        return 84
    default:
        return 85
    }
}

private let keychainSidecarPaths = [keychainPath, "\(keychainPath)-db"]

private func keychainPathsAbsentNow() -> Bool {
    keychainSidecarPaths.allSatisfy {
        !FileManager.default.fileExists(atPath: $0)
    }
}

private func keychainPathsDisappearWithinBound() -> Bool {
    for _ in 0..<20 {
        if keychainPathsAbsentNow() { return true }
        Thread.sleep(forTimeInterval: 0.05)
    }
    return keychainPathsAbsentNow()
}

private func exercise(_ keychain: SecKeychain) -> Int32 {
    let matrixConfiguration = fixtureMode!.matrixConfiguration
    guard let access = syntheticAccess(
        partitions: matrixConfiguration?.partitions ?? [syntheticInitialPartition],
        securityAuthorizations: matrixConfiguration?.authorizations
    ) else { return 66 }
    var syntheticValue = Data("synthetic-nonproduction-value".utf8)
    defer { wipe(&syntheticValue) }
    var attributes: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
        kSecAttrAccess as String: access,
        kSecValueData as String: syntheticValue,
        kSecUseKeychain as String: keychain,
        kSecUseDataProtectionKeychain as String: kCFBooleanFalse as Any
    ]
    attributes[kSecReturnRef as String] = kCFBooleanTrue as Any
    var createdItem: CFTypeRef?
    let createStatus = SecItemAdd(attributes as CFDictionary, &createdItem)
    guard createStatus == errSecSuccess else { return itemCreateFailureExitCode(createStatus) }
    guard let createdItem,
          CFGetTypeID(createdItem) == SecKeychainItemGetTypeID() else { return 68 }
    let item = createdItem as! SecKeychainItem
    if let matrixConfiguration {
        guard verifyInitialAdministrativeACL(item),
              verifyMatrixAccess(
                item,
                partitions: matrixConfiguration.partitions,
                authorizations: matrixConfiguration.authorizations
              ),
              let persistedItem = findPersistedSyntheticItem(keychain),
              snapshot(persistedItem) == snapshot(item) else { return 69 }
        guard recordPhase("ITEM_CREATED_WITH_INITIAL_ACCESS") else { return 93 }
        guard recordPhase("MATRIX_ACCESS_VALIDATED") else { return 93 }
        guard recordPhase("MATRIX_READ_STARTED") else { return 93 }
        switch verifyUnattendedRead(syntheticValue) {
        case .success:
            break
        case .launchFailed:
            return 73
        case .timeout:
            return 78
        case .commandFailed:
            return 79
        case .outputMismatch:
            return 80
        }
        guard recordPhase("MATRIX_READ_PASSED") else { return 93 }
        return 0
    }
    guard let initialSnapshot = snapshot(item),
          let initialState = exactComponentState(item),
          verifyInitialAdministrativeACL(item),
          !initialState.retrieval,
          !initialState.partition else { return 69 }
    guard let persistedItem = findPersistedSyntheticItem(keychain),
          snapshot(persistedItem) == initialSnapshot else { return 69 }
    guard recordPhase("ITEM_CREATED_WITH_INITIAL_ACCESS") else { return 93 }
    guard recordPhase("INITIAL_ACL_VALIDATED") else { return 93 }
    guard runSilent(helperPath, ["inspect", helperAlias], expectedStatus: 12) else { return 70 }
    guard recordPhase("HELPER_INSPECTED") else { return 93 }
    guard runSilent(helperPath, ["grant", helperAlias], expectedStatus: 32) else { return 71 }
    guard recordPhase("HELPER_GRANTED") else { return 93 }
    guard verifyMinimumGrant(persistedItem) else { return 72 }
    guard recordPhase("GRANT_VALIDATED") else { return 93 }
    guard recordPhase("POSITIVE_READ_STARTED") else { return 93 }
    switch verifyUnattendedRead(syntheticValue) {
    case .success:
        break
    case .launchFailed:
        return 73
    case .timeout:
        return 78
    case .commandFailed:
        return 79
    case .outputMismatch:
        return 80
    }
    guard recordPhase("POSITIVE_READ_PASSED") else { return 93 }
    guard runSilent(helperPath, ["revoke", helperAlias, "both"], expectedStatus: 42) else { return 74 }
    guard recordPhase("HELPER_REVOKED") else { return 93 }
    guard runSilent(helperPath, ["inspect", helperAlias], expectedStatus: 12) else { return 75 }
    guard snapshot(persistedItem) == initialSnapshot else { return 76 }
    guard let restoredState = exactComponentState(persistedItem),
          !restoredState.retrieval,
          !restoredState.partition else { return 77 }
    guard recordPhase("RESTORE_VALIDATED") else { return 93 }
    return 0
}

private func fixtureMain() -> Int32 {
    guard var beforeSelection = copyUserKeychainSelection() else { return 97 }
    defer { beforeSelection.wipePaths() }
    guard recordPhase("USER_KEYCHAIN_SELECTION_BEFORE_CAPTURED") else { return 93 }
    var keychainPassword = Data("synthetic-keychain-password-\(attemptId)".utf8)
    defer { wipe(&keychainPassword) }
    var keychain: SecKeychain?
    guard recordPhase("KEYCHAIN_CREATE_STARTED") else { return 93 }
    let createStatus = keychainPath.withCString { path in
        keychainPassword.withUnsafeBytes { bytes in
            SecKeychainCreate(
                path,
                UInt32(bytes.count),
                bytes.baseAddress?.assumingMemoryBound(to: CChar.self),
                false,
                nil,
                &keychain
            )
        }
    }
    guard createStatus == errSecSuccess, keychain != nil else { return 65 }
    guard recordPhase("KEYCHAIN_CREATED") else { return 93 }
    defer {
        if let activeKeychain = keychain {
            _ = recordPhase("KEYCHAIN_DELETE_DEFERRED")
            _ = SecKeychainDelete(activeKeychain)
        }
    }
    let unlockStatus = keychainPassword.withUnsafeBytes { bytes in
        SecKeychainUnlock(
            keychain!,
            UInt32(bytes.count),
            bytes.baseAddress?.assumingMemoryBound(to: CChar.self),
            true
        )
    }
    guard unlockStatus == errSecSuccess,
          let activeKeychain = keychain else { return 66 }
    guard recordPhase("KEYCHAIN_UNLOCKED") else { return 93 }
    let exerciseStatus = exercise(activeKeychain)
    let deletePhaseRecorded = recordPhase("KEYCHAIN_DELETE_REQUESTED")
    let deleteStatus = SecKeychainDelete(activeKeychain)
    if deleteStatus == errSecSuccess {
        keychain = nil
    }
    let pathsAbsent = deleteStatus == errSecSuccess
        && (keychainPathsAbsentNow() || keychainPathsDisappearWithinBound())
    let absentPhaseRecorded = pathsAbsent && recordPhase("KEYCHAIN_ABSENT")
    guard var afterSelection = copyUserKeychainSelection() else {
        return exerciseStatus == 0 ? 98 : exerciseStatus
    }
    defer { afterSelection.wipePaths() }
    let selectionRestored = beforeSelection == afterSelection
    let selectionPhaseRecorded = selectionRestored
        && recordPhase("USER_KEYCHAIN_SELECTION_RESTORED")
    if exerciseStatus != 0 { return exerciseStatus }
    guard deletePhaseRecorded else { return 93 }
    guard deleteStatus == errSecSuccess else { return 90 }
    guard pathsAbsent else { return 91 }
    guard absentPhaseRecorded else { return 93 }
    guard selectionRestored else { return 99 }
    guard selectionPhaseRecorded else { return 93 }
    return 0
}

exit(fixtureMain())
