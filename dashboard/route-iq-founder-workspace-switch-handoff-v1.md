# Route IQ Founder Workspace Switch Handoff v1

Owner: Prometheus Dashboard

Status: Dashboard consumer contract implemented; server authorization and session issuance remain Infrastructure/Data dependencies.

## Boundary

The Dashboard never authorizes workspace access. Every operational page remains bound to one authenticated workspace, operating profile, representative, role, and the existing four runtime assets:

- `workspaceConfiguration`
- `businessManifestRegistry`
- `businessRoster`
- `businessHours`

Workspace switching discards the current page state by loading a fresh `/app` session. It never merges rosters, hours, visits, route queues, browser storage, or runtime projections across workspaces.

## Read-only Founder workspace list

`GET /api/dashboard/route-iq/founder/workspaces`

The server must authenticate the immutable Founder principal before returning:

```json
{
  "contractVersion": "route-iq-founder-workspace-access-v1",
  "authorizationState": "server_verified",
  "principalAuthorization": "IMMUTABLE_FOUNDER_PRINCIPAL_VERIFIED",
  "currentWorkspaceId": "opaque_workspace_id",
  "currentOperatingProfileId": "opaque_profile_id",
  "authorizedWorkspaceSummaries": [
    {
      "workspaceId": "opaque_workspace_id",
      "workspaceLabel": "Display-only label",
      "operatingProfileId": "opaque_profile_id"
    }
  ]
}
```

The endpoint must return no list to representatives. Labels are display-only and must never participate in authorization. The server-derived workspace IDs are the only selectable values.

## Workspace session switch

`POST /api/dashboard/route-iq/founder/workspace-session`

The request body contains exactly:

```json
{
  "requestedWorkspaceId": "opaque_server_authorized_workspace_id"
}
```

The server must reauthenticate and reauthorize the immutable Founder principal, reject unlisted or caller-invented workspace IDs, establish a fresh single-workspace session, and return:

```json
{
  "contractVersion": "route-iq-founder-workspace-switch-receipt-v1",
  "authorizationState": "server_verified",
  "requestedWorkspaceId": "opaque_server_authorized_workspace_id",
  "sessionState": "FRESH_SINGLE_WORKSPACE_SESSION_BOUND",
  "reloadPath": "/app"
}
```

The Dashboard reloads `/app` only after this exact receipt. It does not accept a company display name, client-provided roster, runtime-asset path, role, territory, ZIP, principal, or capability as switch authority.

## Administration ZIP dependency

The Administration registry successor must validate `territories[].zipCoverage.postalCodes` as a nonempty, duplicate-free array of US five-digit ZIP codes. Each coverage object carries its exact workspace, company, territory, and coverage-version identity. The Dashboard projects only the authenticated representative's assigned territory ZIPs.

The Data roster successor must provide an explicit governed `postalCode` or `postal_code` for each approved business. The Dashboard does not infer a ZIP from an address. A missing, malformed, cross-territory, or unauthorized ZIP fails closed before rendering or route use.

The final integration release must use an Administration registry version at or above `route-iq-cross-industry-workspaces-v2.2.0`; earlier registries have no ZIP projection and are not sufficient for the repaired release.

## Safety

These endpoints do not expose Founder-only intelligence. Prospective collection remains OFF, active cohorts remain zero, and recommendation influence remains OFF. Anthony remains unmapped.
