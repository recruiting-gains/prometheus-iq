import Foundation
import Security

private let account = "SYNTHETIC_NONPRODUCTION_ITEM"
private let trustedExecutable = "/usr/bin/security"
private let requiredPartition = "apple-tool:"

guard CommandLine.arguments.count == 2 else {
    exit(64)
}

private let attemptId = CommandLine.arguments[1]
guard attemptId.count == 36,
      UUID(uuidString: attemptId) != nil,
      attemptId == attemptId.lowercased() else {
    exit(64)
}
private let service = "com.prometheus.synthetic.keychain-acl-v2.\(attemptId)"

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
    description: CFString
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
        return (nil, description)
    }
    guard let applications = applicationList as? [SecTrustedApplication] else {
        return nil
    }
    return (applications, description)
}

private func authorizations(_ acl: SecACL) -> Set<String>? {
    guard let values = SecACLCopyAuthorizations(acl) as? [CFString] else {
        return nil
    }
    return Set(values.map { $0 as String })
}

private func decodeHex(_ value: String) -> Data? {
    guard !value.isEmpty, value.count.isMultiple(of: 2) else {
        return nil
    }
    var data = Data(capacity: value.count / 2)
    var index = value.startIndex
    while index < value.endIndex {
        let next = value.index(index, offsetBy: 2)
        guard let byte = UInt8(value[index..<next], radix: 16) else {
            return nil
        }
        data.append(byte)
        index = next
    }
    return data
}

private func partitionList(_ description: CFString) -> [String]? {
    guard let bytes = decodeHex(description as String),
          let value = try? PropertyListSerialization.propertyList(
            from: bytes,
            options: [],
            format: nil
          ),
          let dictionary = value as? [String: Any],
          Set(dictionary.keys) == Set(["Partitions"]),
          let partitions = dictionary["Partitions"] as? [String],
          !partitions.isEmpty else {
        return nil
    }
    return partitions
}

private func findSyntheticItem() -> SecKeychainItem? {
    var item: SecKeychainItem?
    let status = service.withCString { servicePointer in
        account.withCString { accountPointer in
            SecKeychainFindGenericPassword(
                nil,
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

guard let item = findSyntheticItem() else {
    exit(65)
}

var access: SecAccess?
var copiedACLs: CFArray?
var trustedApplication: SecTrustedApplication?
guard SecKeychainItemCopyAccess(item, &access) == errSecSuccess,
      let access,
      SecAccessCopyACLList(access, &copiedACLs) == errSecSuccess,
      let acls = copiedACLs as? [SecACL],
      SecTrustedApplicationCreateFromPath(
        trustedExecutable,
        &trustedApplication
      ) == errSecSuccess,
      let trustedApplication,
      let trustedData = applicationData(trustedApplication) else {
    exit(66)
}

let decrypt = kSecACLAuthorizationDecrypt as String
let exportClear = kSecACLAuthorizationExportClear as String
var trustedRetrievalCount = 0
var partitionCount = 0
for acl in acls {
    guard let rights = authorizations(acl),
          let contents = copyContents(acl) else {
        exit(67)
    }
    if rights.contains(decrypt) && rights.contains(exportClear),
       let applications = contents.applications {
        let matches = applications.filter { application in
            applicationData(application) == trustedData
        }
        if matches.count == 1 {
            trustedRetrievalCount += 1
        }
    }
    if rights == Set([kSecACLAuthorizationPartitionID as String]) {
        guard let partitions = partitionList(contents.description),
              partitions == [requiredPartition] else {
            exit(68)
        }
        partitionCount += 1
    }
}

guard trustedRetrievalCount == 1, partitionCount == 1 else {
    exit(69)
}

exit(0)
