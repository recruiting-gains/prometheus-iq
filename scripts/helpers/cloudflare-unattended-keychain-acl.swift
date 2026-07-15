import Foundation
import Security

private struct GovernedItem {
    let service: String
    let account: String
}

private let items: [String: GovernedItem] = [
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

private let trustedExecutable = "/usr/bin/security"
private let arguments = CommandLine.arguments

guard arguments.count == 3,
      ["inspect", "grant", "revoke"].contains(arguments[1]),
      let governedItem = items[arguments[2]] else {
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
    guard status == errSecSuccess else {
        return nil
    }
    return reference
}

private func applicationData(_ application: SecTrustedApplication) -> Data? {
    var copied: CFData?
    guard SecTrustedApplicationCopyData(application, &copied) == errSecSuccess,
          let copied else {
        return nil
    }
    return copied as Data
}

private func copyApplications(_ acl: SecACL) -> (
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

guard let itemReference = findItem(governedItem) else {
    exit(20)
}

var accessReference: SecAccess?
guard SecKeychainItemCopyAccess(itemReference, &accessReference) == errSecSuccess,
      let accessReference,
      let matching = SecAccessCopyMatchingACLList(
        accessReference,
        kSecACLAuthorizationDecrypt
      ) as? [SecACL],
      matching.count == 1 else {
    exit(21)
}

var trustedApplication: SecTrustedApplication?
guard SecTrustedApplicationCreateFromPath(
    trustedExecutable,
    &trustedApplication
) == errSecSuccess,
let trustedApplication,
let trustedData = applicationData(trustedApplication),
let current = copyApplications(matching[0]) else {
    exit(21)
}

// A nil application list means every application is already trusted. Do not
// broaden or rewrite that pre-existing access policy.
if current.applications == nil {
    exit(arguments[1] == "revoke" ? 23 : 0)
}

let existingApplications = current.applications ?? []
let matchingIndexes = existingApplications.indices.filter { index in
    applicationData(existingApplications[index]) == trustedData
}

switch arguments[1] {
case "inspect":
    exit(matchingIndexes.isEmpty ? 10 : 0)

case "grant":
    if !matchingIndexes.isEmpty {
        exit(0)
    }
    let updated = existingApplications + [trustedApplication]
    guard SecACLSetContents(
        matching[0],
        updated as CFArray,
        current.description,
        current.selector
    ) == errSecSuccess,
    SecKeychainItemSetAccess(itemReference, accessReference) == errSecSuccess else {
        exit(22)
    }
    exit(10)

case "revoke":
    guard matchingIndexes.count == 1 else {
        exit(23)
    }
    let updated = existingApplications.enumerated().compactMap { index, application in
        matchingIndexes.contains(index) ? nil : application
    }
    guard SecACLSetContents(
        matching[0],
        updated as CFArray,
        current.description,
        current.selector
    ) == errSecSuccess,
    SecKeychainItemSetAccess(itemReference, accessReference) == errSecSuccess else {
        exit(22)
    }
    exit(11)

default:
    exit(64)
}
