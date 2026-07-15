import Foundation
import Security

private struct GovernedItem {
    let service: String
    let account: String
}

private enum ComponentScope: String {
    case retrieval
    case partition
    case both

    var includesRetrieval: Bool { self == .retrieval || self == .both }
    var includesPartition: Bool { self == .partition || self == .both }
}

private struct AuthorizationState {
    let access: SecAccess
    let retrievalACL: SecACL?
    let ownedRetrievalACL: SecACL?
    let partitionACL: SecACL
    let partitionApplications: CFArray?
    let partitionDescription: CFString
    let partitionSelector: SecKeychainPromptSelector
    let partitions: [String]

    var retrievalPresent: Bool { retrievalACL != nil }
    var partitionPresent: Bool { partitions.contains(requiredPartition) }
}

private let productionItems: [String: GovernedItem] = [
    "DEPLOYMENT_API_TOKEN": GovernedItem(
        service: "com.prometheus.cloudflare.unattended.deployment",
        account: "CLOUDFLARE_API_TOKEN"
    ),
    "CLOUDFLARE_ACCOUNT_ID": GovernedItem(
        service: "com.prometheus.cloudflare.unattended.deployment",
        account: "CLOUDFLARE_ACCOUNT_ID"
    ),
    "SMOKE_CLIENT_ID": GovernedItem(
        service: "com.prometheus.cloudflare.unattended.smoke",
        account: "CLOUDFLARE_ACCESS_CLIENT_ID"
    ),
    "SMOKE_CLIENT_SECRET": GovernedItem(
        service: "com.prometheus.cloudflare.unattended.smoke",
        account: "CLOUDFLARE_ACCESS_CLIENT_SECRET"
    )
]

#if KEYCHAIN_ACL_V2_NATIVE_E2E
// The native verifier supplies these UUID-scoped values in a temporary source
// file at compile time. Normal production compilation has no such alias.
let nativeE2EService: String
let nativeE2EAccount: String
#endif

private let items: [String: GovernedItem] = {
    var allowed = productionItems
#if KEYCHAIN_ACL_V2_NATIVE_E2E
    allowed["NATIVE_E2E_SYNTHETIC"] = GovernedItem(
        service: nativeE2EService,
        account: nativeE2EAccount
    )
#endif
    return allowed
}()

private let trustedExecutable = "/usr/bin/security"
private let requiredPartition = "apple-tool:"
private let retrievalDescription = "Prometheus unattended Keychain retrieval v2"
private let maximumPartitionCount = 64
private let maximumPartitionBytes = 256

private let arguments = CommandLine.arguments
guard arguments.count == 3 || arguments.count == 4,
      ["inspect", "grant", "revoke"].contains(arguments[1]),
      let governedItem = items[arguments[2]],
      (arguments[1] == "revoke") == (arguments.count == 4),
      arguments[1] != "revoke" || ComponentScope(rawValue: arguments[3]) != nil else {
    exit(64)
}

private func findItem(_ item: GovernedItem) -> SecKeychainItem? {
    var reference: SecKeychainItem?
    let status = item.service.withCString { servicePointer in
        item.account.withCString { accountPointer in
            SecKeychainFindGenericPassword(
                nil,
                UInt32(strlen(servicePointer)),
                servicePointer,
                UInt32(strlen(accountPointer)),
                accountPointer,
                nil,
                nil,
                &reference
            )
        }
    }
    return status == errSecSuccess ? reference : nil
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
    rawApplications: CFArray?,
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
        return (nil, nil, description, selector)
    }
    guard let applications = applicationList as? [SecTrustedApplication] else {
        return nil
    }
    return (applications, applicationList, description, selector)
}

private func authorizations(_ acl: SecACL) -> Set<String>? {
    guard let values = SecACLCopyAuthorizations(acl) as? [CFString] else {
        return nil
    }
    return Set(values.map { $0 as String })
}

private func decodeHex(_ value: String) -> Data? {
    guard !value.isEmpty,
          value.utf8.count <= 64 * 1024,
          value.count.isMultiple(of: 2) else {
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

private func partitionList(from description: CFString) -> [String]? {
    guard let bytes = decodeHex(description as String),
          let value = try? PropertyListSerialization.propertyList(
            from: bytes,
            options: [],
            format: nil
          ),
          let dictionary = value as? [String: Any],
          Set(dictionary.keys) == Set(["Partitions"]),
          let partitions = dictionary["Partitions"] as? [String],
          !partitions.isEmpty,
          partitions.count <= maximumPartitionCount,
          Set(partitions).count == partitions.count,
          partitions.allSatisfy({ partition in
              !partition.isEmpty
                && partition.utf8.count <= maximumPartitionBytes
                && partition.unicodeScalars.allSatisfy { scalar in
                    scalar.value >= 0x21 && scalar.value <= 0x7e
                }
          }) else {
        return nil
    }
    return partitions
}

private func partitionDescription(_ partitions: [String]) -> CFString? {
    guard !partitions.isEmpty,
          partitions.count <= maximumPartitionCount,
          Set(partitions).count == partitions.count,
          let data = try? PropertyListSerialization.data(
            fromPropertyList: ["Partitions": partitions],
            format: .xml,
            options: 0
          ) else {
        return nil
    }
    return data.map { String(format: "%02X", $0) }.joined() as CFString
}

private func exactTrustedApplication() -> (SecTrustedApplication, Data)? {
    var application: SecTrustedApplication?
    guard SecTrustedApplicationCreateFromPath(
        trustedExecutable,
        &application
    ) == errSecSuccess,
    let application,
    let data = applicationData(application) else {
        return nil
    }
    return (application, data)
}

private func authorizationState(_ item: SecKeychainItem) -> AuthorizationState? {
    var access: SecAccess?
    var copiedACLs: CFArray?
    guard SecKeychainItemCopyAccess(item, &access) == errSecSuccess,
          let access,
          SecAccessCopyACLList(access, &copiedACLs) == errSecSuccess,
          let allACLs = copiedACLs as? [SecACL],
          let (_, trustedData) = exactTrustedApplication() else {
        return nil
    }

    let decrypt = kSecACLAuthorizationDecrypt as String
    let requiredRights = Set([decrypt])
    var trustedRetrievalACLs: [SecACL] = []
    var ownedRetrievalACLs: [SecACL] = []
    var partitionACLs: [SecACL] = []

    for acl in allACLs {
        guard let rights = authorizations(acl),
              let contents = copyContents(acl) else {
            return nil
        }
        if rights.contains(decrypt) {
            // A nil list grants matching rights to every application. Refuse to
            // build automation on an already broad secret ACL.
            guard let applications = contents.applications else {
                return nil
            }
            let matches = applications.filter { application in
                applicationData(application) == trustedData
            }
            guard matches.count <= 1 else {
                return nil
            }
            if matches.count == 1 {
                // Trusting /usr/bin/security on a broader standard ACL would
                // also grant signing, MAC, derivation, or export rights. Only
                // the exact decrypt right used by generic-password value
                // retrieval is accepted.
                guard rights == requiredRights,
                      applications.count == 1 else {
                    return nil
                }
                trustedRetrievalACLs.append(acl)
            }
            if contents.description as String == retrievalDescription {
                guard rights == requiredRights,
                      applications.count == 1,
                      matches.count == 1 else {
                    return nil
                }
                ownedRetrievalACLs.append(acl)
            }
        }
        if rights.contains(kSecACLAuthorizationPartitionID as String) {
            guard rights == Set([kSecACLAuthorizationPartitionID as String]) else {
                return nil
            }
            partitionACLs.append(acl)
        }
    }

    guard trustedRetrievalACLs.count <= 1,
          ownedRetrievalACLs.count <= 1,
          partitionACLs.count == 1,
          let partitionContents = copyContents(partitionACLs[0]),
          let partitions = partitionList(from: partitionContents.description) else {
        return nil
    }

    return AuthorizationState(
        access: access,
        retrievalACL: trustedRetrievalACLs.first,
        ownedRetrievalACL: ownedRetrievalACLs.first,
        partitionACL: partitionACLs[0],
        partitionApplications: partitionContents.rawApplications,
        partitionDescription: partitionContents.description,
        partitionSelector: partitionContents.selector,
        partitions: partitions
    )
}

private func createRetrievalACL(_ access: SecAccess) -> SecACL? {
    guard let (application, _) = exactTrustedApplication() else {
        return nil
    }
    var newACL: SecACL?
    guard SecACLCreateWithSimpleContents(
        access,
        [application] as CFArray,
        retrievalDescription as CFString,
        SecKeychainPromptSelector(rawValue: 0),
        &newACL
    ) == errSecSuccess,
    let newACL,
    SecACLUpdateAuthorizations(
        newACL,
        [kSecACLAuthorizationDecrypt] as CFArray
    ) == errSecSuccess else {
        return nil
    }
    return newACL
}

private func setPartitions(_ state: AuthorizationState, _ partitions: [String]) -> Bool {
    guard let updated = partitionDescription(partitions) else {
        return false
    }
    return SecACLSetContents(
        state.partitionACL,
        state.partitionApplications,
        updated,
        state.partitionSelector
    ) == errSecSuccess
}

private func addRequiredPartition(_ state: AuthorizationState) -> Bool {
    guard !state.partitionPresent else {
        return false
    }
    return setPartitions(state, state.partitions + [requiredPartition])
}

private func removeOwnedRetrievalACL(_ state: AuthorizationState) -> Bool {
    guard let owned = state.ownedRetrievalACL else {
        return false
    }
    return SecACLRemove(owned) == errSecSuccess
}

private func removeRequiredPartition(_ state: AuthorizationState) -> Bool {
    guard state.partitionPresent else {
        return false
    }
    let remaining = state.partitions.filter { $0 != requiredPartition }
    guard !remaining.isEmpty else {
        return false
    }
    return setPartitions(state, remaining)
}

private func restoreGrant(
    item: SecKeychainItem,
    state: AuthorizationState,
    createdRetrievalACL: SecACL?,
    addedPartition: Bool
) -> Bool {
    if let createdRetrievalACL,
       SecACLRemove(createdRetrievalACL) != errSecSuccess {
        return false
    }
    if addedPartition && !setPartitions(state, state.partitions) {
        return false
    }
    guard SecKeychainItemSetAccess(item, state.access) == errSecSuccess,
          let restored = authorizationState(item),
          restored.retrievalPresent == state.retrievalPresent,
          restored.partitionPresent == state.partitionPresent else {
        return false
    }
    return true
}

private func restoreRevocation(
    item: SecKeychainItem,
    state: AuthorizationState,
    scope: ComponentScope
) -> Bool {
    if scope.includesRetrieval,
       createRetrievalACL(state.access) == nil {
        return false
    }
    if scope.includesPartition && !setPartitions(state, state.partitions) {
        return false
    }
    guard SecKeychainItemSetAccess(item, state.access) == errSecSuccess,
          let restored = authorizationState(item),
          (!scope.includesRetrieval || restored.ownedRetrievalACL != nil),
          (!scope.includesPartition || restored.partitionPresent) else {
        return false
    }
    return true
}

guard let itemReference = findItem(governedItem),
      let initial = authorizationState(itemReference) else {
    exit(21)
}

switch arguments[1] {
case "inspect":
    if initial.retrievalPresent && initial.partitionPresent { exit(0) }
    if !initial.retrievalPresent && initial.partitionPresent { exit(10) }
    if initial.retrievalPresent && !initial.partitionPresent { exit(11) }
    exit(12)

case "grant":
    let addRetrieval = !initial.retrievalPresent
    let addPartition = !initial.partitionPresent
    if !addRetrieval && !addPartition { exit(0) }
    let createdRetrievalACL = addRetrieval ? createRetrievalACL(initial.access) : nil
    if addRetrieval && createdRetrievalACL == nil { exit(22) }
    if addPartition && !addRequiredPartition(initial) { exit(22) }
    let committed = SecKeychainItemSetAccess(itemReference, initial.access) == errSecSuccess
    let final = committed ? authorizationState(itemReference) : nil
    if !committed || final?.retrievalPresent != true || final?.partitionPresent != true {
        exit(restoreGrant(
            item: itemReference,
            state: initial,
            createdRetrievalACL: createdRetrievalACL,
            addedPartition: addPartition
        ) ? 22 : 24)
    }
    if addRetrieval && addPartition { exit(32) }
    if addRetrieval { exit(30) }
    exit(31)

case "revoke":
    guard let scope = ComponentScope(rawValue: arguments[3]),
          (!scope.includesRetrieval || initial.ownedRetrievalACL != nil),
          (!scope.includesPartition || initial.partitionPresent) else {
        exit(23)
    }
    if scope.includesRetrieval && !removeOwnedRetrievalACL(initial) { exit(22) }
    if scope.includesPartition && !removeRequiredPartition(initial) { exit(22) }
    let committed = SecKeychainItemSetAccess(itemReference, initial.access) == errSecSuccess
    let final = committed ? authorizationState(itemReference) : nil
    if !committed
        || (scope.includesRetrieval && final?.ownedRetrievalACL != nil)
        || (scope.includesPartition && final?.partitionPresent != false) {
        exit(restoreRevocation(
            item: itemReference,
            state: initial,
            scope: scope
        ) ? 22 : 24)
    }
    if scope == .both { exit(42) }
    if scope == .retrieval { exit(40) }
    exit(41)

default:
    exit(64)
}
