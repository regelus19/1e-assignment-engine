# SharePoint repository setup

Stage E uses Microsoft Graph and two SharePoint Lists. The app contains no client secret and does not store access tokens in source code.

## 1. Create the SharePoint Lists

Create these lists on the intended 1 East/unit SharePoint site.

### `1E_OperationalState`

Keep the built-in **Title** column and add:

- `UnitId` — Single line of text
- `StateType` — Choice or Single line of text; values used by the app are `Live` and `Plan`
- `PayloadJson` — Multiple lines of text, plain text

The app uses logical identifiers such as:

- `1E|2026-09-14|Night|Live`
- `1E|2026-09-15|Day|Plan`

The Plan payload contains both the working `PlanningWorkspace` and the explicitly saved `PlanBaseline`, so another authorized user can perform the next-shift handoff.

### `1E_ShiftHistory`

Keep **Title** and add:

- `UnitId` — Single line of text
- `StateType` — Choice or Single line of text; the app writes `History`
- `PayloadJson` — Multiple lines of text, plain text

History is append-only from normal app workflows.

For performance, index `Title` and `UnitId` on the lists.

## 2. Microsoft Entra application

Register a browser/Spa application for the deployed URL and configure its SPA redirect URI. No client secret is used.

The straightforward MVP Graph permission is delegated `Sites.ReadWrite.All`. Your Microsoft 365 administrators may instead evaluate selected-site scoping if required by organizational policy.

## 3. Runtime configuration

Set these build/runtime variables with organization-specific values. Do not commit real tenant/site identifiers if your policy treats them as sensitive configuration.

```text
VITE_DATA_REPOSITORY_MODE=sharepoint
VITE_SHAREPOINT_SITE_ID=<microsoft-graph-site-id>
VITE_SHAREPOINT_OPERATIONAL_LIST_ID=<1E_OperationalState-list-id>
VITE_SHAREPOINT_HISTORY_LIST_ID=<1E_ShiftHistory-list-id>
VITE_MSAL_CLIENT_ID=<entra-spa-client-id>
VITE_MSAL_TENANT_ID=<entra-tenant-id>
VITE_MSAL_REDIRECT_URI=<deployed-app-url>
VITE_GRAPH_SCOPES=https://graph.microsoft.com/Sites.ReadWrite.All
```

Modes:

- `local` — always use `LocalOperationalRepository`.
- `auto` (default) — use SharePoint only when all SharePoint/Entra settings are present; otherwise local.
- `sharepoint` — require SharePoint/Entra configuration. Missing configuration fails closed and does not silently switch to local storage.

After SharePoint mode has initialized, Graph read/write failures do **not** fall back to local persistence. This prevents divergent operational state.

## 4. Concurrency behavior

Every SharePoint load retains the list item's ETag. Updates send `If-Match` with the expected ETag. Microsoft Graph returns HTTP `412 Precondition Failed` when another user has already changed the item. The repository then reloads the newest server record and throws a typed `RepositoryConflictError`.

The app does not automatically merge JSON. Planning conflicts load the latest shared version and tell the user to review the rejected change. Live-state writes are rejected rather than silently overwriting newer SharePoint data.

## 5. Initial migration / seeding

If SharePoint is correctly configured but no Live or Plan record exists yet, the SharePoint repository seeds that missing aggregate from the existing local repository once. After a remote record exists, SharePoint is authoritative; runtime remote failures never auto-fallback to local.

## 6. PHI boundary

Do not enter patient names, MRNs, DOBs, diagnoses, or other identifiers into this app. SharePoint receives only the existing anonymous operational assignment/workload structures. The prototype `patientStayId` values must remain synthetic/anonymous.
