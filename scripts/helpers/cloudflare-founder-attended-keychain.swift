import Foundation
import Security

private struct KeychainItem: Hashable {
    let service: String
    let account: String
}

private let temporaryApiToken = KeychainItem(
    service: "com.prometheus.cloudflare.attended.service-token-provisioning",
    account: "CLOUDFLARE_ACCESS_SERVICE_TOKENS_WRITE_API_TOKEN"
)
private let governedAccountId = KeychainItem(
    service: "com.prometheus.cloudflare.unattended.deployment",
    account: "CLOUDFLARE_ACCOUNT_ID"
)
private let smokeClientId = KeychainItem(
    service: "com.prometheus.cloudflare.unattended.smoke",
    account: "CLOUDFLARE_ACCESS_CLIENT_ID"
)
private let smokeClientSecret = KeychainItem(
    service: "com.prometheus.cloudflare.unattended.smoke",
    account: "CLOUDFLARE_ACCESS_CLIENT_SECRET"
)

private let allowedItemsByOperation: [String: Set<KeychainItem>] = [
    "presence": [temporaryApiToken, governedAccountId, smokeClientId, smokeClientSecret],
    "read": [temporaryApiToken, governedAccountId],
    "add": [smokeClientId, smokeClientSecret],
    "delete": [temporaryApiToken, smokeClientId, smokeClientSecret]
]
private let ownershipTagPrefix = "prometheus-founder-attended-v1:"
private let maximumSecretBytes = 65_536
private let maximumInputBytes = maximumSecretBytes + 128

private func validOwnershipTag(_ value: String) -> Bool {
    guard value.hasPrefix(ownershipTagPrefix) else {
        return false
    }
    let suffix = value.dropFirst(ownershipTagPrefix.count)
    return suffix.utf8.count == 64 && suffix.unicodeScalars.allSatisfy { scalar in
        (48...57).contains(scalar.value) || (97...102).contains(scalar.value)
    }
}

private func readOwnershipTag() -> String? {
    let input = FileHandle.standardInput.readDataToEndOfFile()
    guard !input.isEmpty,
          input.count <= 128,
          let value = String(data: input, encoding: .utf8),
          validOwnershipTag(value) else {
        return nil
    }
    return value
}

private func readAddInput() -> (ownershipTag: String, secret: Data)? {
    let input = FileHandle.standardInput.readDataToEndOfFile()
    guard !input.isEmpty,
          input.count <= maximumInputBytes,
          let separator = input.firstIndex(of: 0x0A) else {
        return nil
    }
    let ownershipData = input[..<separator]
    let secretStart = input.index(after: separator)
    let secret = Data(input[secretStart...])
    guard let ownershipTag = String(data: ownershipData, encoding: .utf8),
          validOwnershipTag(ownershipTag),
          !secret.isEmpty,
          secret.count <= maximumSecretBytes else {
        return nil
    }
    return (ownershipTag, secret)
}

private let arguments = CommandLine.arguments
guard arguments.count == 4 else {
    exit(64)
}

let operation = arguments[1]
private let requestedItem = KeychainItem(service: arguments[2], account: arguments[3])

// This guard must remain before every Security.framework item operation.
guard let allowedItems = allowedItemsByOperation[operation],
      allowedItems.contains(requestedItem) else {
    exit(64)
}

let baseQuery: [CFString: Any] = [
    kSecClass: kSecClassGenericPassword,
    kSecAttrService: requestedItem.service,
    kSecAttrAccount: requestedItem.account
]

switch operation {
case "presence":
    var query = baseQuery
    query[kSecMatchLimit] = kSecMatchLimitOne
    query[kSecReturnAttributes] = true
    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecSuccess {
        exit(0)
    }
    if status == errSecItemNotFound {
        exit(2)
    }
    exit(1)

case "read":
    var query = baseQuery
    query[kSecMatchLimit] = kSecMatchLimitOne
    query[kSecReturnData] = true
    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    guard status == errSecSuccess, let data = result as? Data, !data.isEmpty else {
        exit(1)
    }
    FileHandle.standardOutput.write(data)

case "add":
    guard let input = readAddInput() else {
        exit(1)
    }
    var attributes = baseQuery
    attributes[kSecAttrComment] = input.ownershipTag
    attributes[kSecValueData] = input.secret
    let status = SecItemAdd(attributes as CFDictionary, nil)
    guard status == errSecSuccess else {
        exit(1)
    }

case "delete":
    var query = baseQuery
    if requestedItem != temporaryApiToken {
        guard let ownershipTag = readOwnershipTag() else {
            exit(1)
        }
        query[kSecAttrComment] = ownershipTag
    }
    let status = SecItemDelete(query as CFDictionary)
    if status == errSecSuccess {
        exit(0)
    }
    if status == errSecItemNotFound {
        exit(2)
    }
    exit(1)

default:
    // The pre-Security.framework matrix guard makes this unreachable.
    exit(64)
}
