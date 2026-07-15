import Foundation
import Security

private let arguments = CommandLine.arguments
guard arguments.count == 4 else {
    exit(64)
}

let operation = arguments[1]
let service = arguments[2]
let account = arguments[3]

guard !service.isEmpty, !account.isEmpty else {
    exit(64)
}

let baseQuery: [CFString: Any] = [
    kSecClass: kSecClassGenericPassword,
    kSecAttrService: service,
    kSecAttrAccount: account
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
    let data = FileHandle.standardInput.readDataToEndOfFile()
    guard !data.isEmpty, data.count <= 65_536 else {
        exit(1)
    }
    var attributes = baseQuery
    attributes[kSecValueData] = data
    attributes[kSecAttrAccessible] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    let status = SecItemAdd(attributes as CFDictionary, nil)
    guard status == errSecSuccess else {
        exit(1)
    }

case "delete":
    let status = SecItemDelete(baseQuery as CFDictionary)
    guard status == errSecSuccess else {
        exit(1)
    }

default:
    exit(64)
}
