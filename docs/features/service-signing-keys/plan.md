# Service Signing Keys — Frontend Plan

Status: Draft
Released in: Unreleased

## Implementation Goal

Add a "Service Signing Keys" section to the dashboard that lets service providers register external signing keys and manage their trust records. The section reuses existing key-binding and controller-witness logic. No new onchain schemas are needed.

The product behavior is defined in `spec.md`.

## Guiding Implementation Decisions

1. All new components go inline in `src/app/dashboard/page.tsx`, consistent with the current pattern where `AccountSection`, `ServiceTrustWorkspace`, `ServiceKeyCard`, and `buildServiceKeys()` all live in the same file.
2. The `AddSigningKeyDialog` uses existing shadcn/ui `Dialog`, `Select`, `Input`, and `Textarea` primitives.
3. Trust level indicators reuse the existing `Signal` component from `ServiceKeyCard`.
4. Controller witness submission reuses `callControllerWitness()` from `src/lib/controller-witness-client.ts`.
5. Key-binding publish links reuse the existing `/publish/key-binding?subject=...&keyId=...` pattern.
6. The backend dependency is the `key_metadata` CRUD API defined in `omatrust-backend/docs/features/service-signing-keys/spec.md`. Frontend work can begin with mock data while the backend is built.

## Acceptance Criteria

### AC-1: Section appears in correct position

- The "Service Signing Keys" card appears after Account and before Service Management on the signed-in dashboard.
- The section is visible even when the user has no subject DID configured.

### AC-2: Empty state displays explanatory copy

- When the account has no key metadata records, the section shows the full explanatory copy inline (not just the short description).
- The explanatory copy includes: "OMATrust does not need your private key" and "Your service signs artifacts wherever you choose."
- An "Add Signing Key" button is visible in both the header and the empty state body.

### AC-3: Populated state shows signing key cards

- Each `key_metadata` record is rendered as a `SigningKeyCard`.
- Each card displays: display name, tag badges, key ID, notes (if present), bound subjects with per-subject derived status and trust level signals.
- The full explanatory copy moves to a tooltip on an info icon next to the section title.

### AC-4: Add Signing Key dialog — create mode

- Clicking "Add Signing Key" opens a modal dialog.
- The dialog collects: tags (multi-select), display name (text), key identifier (text), notes (textarea, optional).
- Tag options are: x402 Offers & Receipts, MCP Server Artifacts, Software Release Proofs, Generic Service Signing, Other. Multiple tags can be selected.
- The dialog does not collect Service ID — subject bindings are established onchain via the key-binding flow after registration.
- Key identifier validates against supported DID formats: `did:pkh`, `did:key`, `did:jwk`, `did:ethr`.
- The dialog never asks for a private key.
- On submit, calls `upsertSigningKey()` and refreshes the list on success.
- If the key already exists on the account, the frontend warns "This key is already registered on your account. Submitting will update its metadata." The backend upserts (overwrites metadata).

### AC-5: Add Signing Key dialog — edit mode

- Clicking "Edit" on a signing key card opens the same dialog pre-filled with existing values.
- Key identifier is displayed but disabled.
- Only display name, tags, and notes are editable.
- On submit, calls `upsertSigningKey()` (same endpoint as create; backend upserts) and refreshes the list on success.

### AC-6: Signing key card actions

- **Publish key binding**: visible when no key-binding attestation exists. Links to `/publish/key-binding?subject=...&keyId=...`.
- **Add controller witness**: visible when `intermediate === false`. Opens the same confirmation flow as the existing `ServiceKeyCard` controller witness submission.
- **Edit**: always visible. Opens the edit dialog.

### AC-7: Derived status display

- **Registered** (neutral badge): key metadata exists, no onchain key-binding found.
- **Active** (green/success badge): key-binding attestation exists, not revoked.
- **Revoked** (red/destructive badge): key-binding attestation exists and is revoked.

### AC-8: Trust level display

- Reuses the existing `Signal` component (Basic / Intermediate / Advanced).
- Values are derived from matching `ServiceKey` entries via `buildServiceKeys()`.

### AC-9: Duplicate filtering

- Keys that have a `key_metadata` record with `key_type = 'service-signing'` are filtered out of the Service Management "Key Authorizations" list.
- Filtering uses `canonicalIdentifier()` for consistent DID comparison.
- A key that appears in Service Signing Keys does not also appear in Key Authorizations.

### AC-10: API client functions

- `listSigningKeys()` and `upsertSigningKey()` are added to `src/lib/omatrust-backend.ts`.
- Both use `backendFetch()` with session cookie credentials.
- `KeyMetadataRecord`, `KeyMetadataTag`, `UpsertSigningKeyParams` types are exported.

### AC-11: No private key exposure

- No field in the dialog is labeled "private key", "secret", or similar.
- Help text on the key identifier field explicitly says: "Do not enter your private key."
- The dialog description says: "OMATrust will not ask for your private key."

## Test Cases

### Component Tests: `ServiceSigningKeys`

| ID | Test | Expected Result |
|---|---|---|
| C-1 | Render with no key metadata records | Shows empty state with full explanatory copy and "Add Signing Key" button |
| C-2 | Render with 2 key metadata records | Shows 2 `SigningKeyCard` components |
| C-3 | Render with key metadata but no subject DID | Section still visible, cards render without errors |
| C-4 | Info icon tooltip | Tooltip contains the full explanatory copy |
| C-5 | "Add Signing Key" button click | Opens `AddSigningKeyDialog` |

### Component Tests: `SigningKeyCard`

| ID | Test | Expected Result |
|---|---|---|
| K-1 | Card with Registered status | Shows "Registered" neutral badge, "Publish key binding" button visible |
| K-2 | Card with Active status | Shows "Active" green badge, "Publish key binding" button hidden |
| K-3 | Card with Revoked status | Shows "Revoked" red badge |
| K-4 | Card with no controller witness | "Add controller witness" button visible |
| K-5 | Card with controller witness | "Add controller witness" button hidden |
| K-6 | Card with notes | Notes line displayed |
| K-7 | Card without notes | Notes line not rendered |
| K-8 | Tag badges display correct labels | `x402` shows "x402 Offers & Receipts"; multiple tags render multiple badges |
| K-8b | Card with no bound subjects | Shows "No subject bindings yet" with guidance |
| K-8c | Card with 2 bound subjects | Shows per-subject rows with status and trust signals |
| K-9 | Edit button click | Opens dialog in edit mode with pre-filled values |
| K-10 | Publish key binding link | Navigates to `/publish/key-binding?subject=...&keyId=...` |

### Component Tests: `AddSigningKeyDialog`

| ID | Test | Expected Result |
|---|---|---|
| D-1 | Create mode: empty form | All fields empty, tags defaults to no selection |
| D-2 | Create mode: valid submission | Calls `upsertSigningKey()`, dialog closes, list refreshes |
| D-3 | Create mode: missing required field | Submit button disabled or validation error shown |
| D-4 | Create mode: invalid key DID format | Validation error: "Key identifier must be in DID format (did:pkh, did:key, did:jwk, or did:ethr)" |
| D-5 | Create mode: existing keyDid | Warning shown: "This key is already registered. Submitting will update its metadata." Upsert succeeds. |
| D-5b | Create mode: multiple tags selected | Tags array sent correctly in request |
| D-6 | Edit mode: fields pre-filled | Display name, tags, notes editable; Key identifier disabled |
| D-7 | Edit mode: valid submission | Calls `upsertSigningKey()`, dialog closes, list refreshes |
| D-8 | Dialog never shows private key field | No input labeled "private key" or "secret" exists |
| D-9 | Tags multi-select has all 5 options | All tag options render correctly |
| D-9b | Dialog does not have a Service ID field | No input for subject DID exists |

### Integration Tests: Duplicate Filtering

| ID | Test | Expected Result |
|---|---|---|
| F-1 | Key exists in both key_metadata and serviceKeys | Key appears in Service Signing Keys, not in Key Authorizations |
| F-2 | Key exists only in serviceKeys (no metadata) | Key appears in Key Authorizations, not in Service Signing Keys |
| F-3 | Key with different DID casing | Canonical normalization ensures correct filtering |
| F-4 | Multiple signing keys, one matches serviceKeys | Only the matching key is filtered from Key Authorizations |

### Integration Tests: Data Flow

| ID | Test | Expected Result |
|---|---|---|
| I-1 | Dashboard loads key metadata on mount | `listSigningKeys()` called, results passed to `ServiceSigningKeys` |
| I-2 | Creating a signing key refreshes the list | New key appears in the section without full page reload |
| I-3 | Updating a signing key via re-POST | Card shows updated metadata without full page reload |
| I-4 | Controller witness submission from signing key card | Refreshes attestations, updates trust level indicators |

### API Client Tests

| ID | Test | Expected Result |
|---|---|---|
| A-1 | `listSigningKeys()` returns array | Parses response correctly |
| A-2 | `upsertSigningKey()` with new key | Returns record with `created: true` |
| A-3 | `upsertSigningKey()` with existing key | Returns record with `created: false` |
| A-4 | All functions include credentials | `credentials: 'include'` set on fetch |
