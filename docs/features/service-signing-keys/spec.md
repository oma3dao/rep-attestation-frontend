# Service Signing Keys — Frontend Spec

Status: Draft
Released in: Unreleased

## 1. Purpose

This specification defines the behavior of the new "Service Signing Keys" dashboard section. The section lets service providers register external signing keys and manage their trust records through OMATrust, without OMATrust holding private keys or signing artifacts.

The first target use case is x402 offer/receipt signing. Signing happens externally (CDP, Thirdweb, Turnkey, AWS KMS, self-managed server key, JWS key, etc.). OMATrust manages the trust records: key binding, controller witness, DNS proof, and reputation continuity.

## 2. Scope

### 2.1 In Scope

- New "Service Signing Keys" dashboard section between Account and Service Management.
- "Add Signing Key" multi-step dialog for registering key metadata.
- Per-key cards with trust level indicators, derived status, and action buttons.
- Duplicate filtering to remove signing keys from the Service Management "Key Authorizations" subsection.
- API client functions for the backend `key_metadata` CRUD endpoints.
- Empty-state and tooltip copy explaining the section purpose.

### 2.2 Out of Scope

- Signing or custody of private keys.
- x402 receipt/offer signing functionality.
- Key rotation workflows (deferred to V2).
- Restructuring the full Service Management section.
- New onchain attestation schemas.
- Backend API implementation (see `omatrust-backend/docs/features/service-signing-keys/spec.md`).

## 3. Conceptual Distinction

The UI must clearly distinguish two kinds of keys:

- **Attestation / account key**: the wallet used to sign into the portal and submit delegated OMATrust attestations. Shown in Account section and used for SIWE authentication.
- **Service signing key**: an external key used by the service to sign artifacts outside OMATrust, such as x402 offers and receipts. Stored in `key_metadata` with `key_type = 'service-signing'`. Shown in the new Service Signing Keys section.

This distinction must be reflected in section titles, descriptions, tooltips, and empty-state copy. At no point should the UI suggest that OMATrust holds the private key or signs artifacts on behalf of the user.

## 4. Dashboard Section Ordering

The signed-in dashboard render order becomes:

1. Header (title, Refresh, PublishButton)
2. **Account** (`AccountSection`)
3. **Service Signing Keys** (`ServiceSigningKeys`) — NEW
4. **Service Management** (`ServiceTrustWorkspace`)
5. **Issuer Tools** (`ActionGrid`)
6. Error card
7. **My Attestations**

### 4.1 Insertion Point

In `src/app/dashboard/page.tsx`, the new section is inserted between `AccountSection` and the `ServiceTrustWorkspace` conditional:

```tsx
<AccountSection session={session} serviceDids={serviceDids} />

<ServiceSigningKeys
  session={session}
  address={address}
  chainId={chainId}
  attestations={attestations}
  registeredSubjectDids={registeredSubjectDids}
  onControllerWitnessSubmitted={loadAttestations}
/>

{hasValidSubject && (
  <ServiceTrustWorkspace ... />
)}
```

### 4.2 Visibility

The Service Signing Keys section is always visible when the user is signed in. Unlike Service Management (which requires `hasValidSubject`), this section should appear even if the user has no subject configured yet — the empty state guides them to set up their first signing key and explains why they should.

## 5. Service Signing Keys Section

### 5.1 Component: `ServiceSigningKeys`

A `Card` component consistent with the existing `AccountSection` and `ServiceTrustWorkspace` card styling.

### 5.2 Header

```
Service Signing Keys                                    [i] [+ Add Signing Key]
Register and manage external keys that sign artifacts for your services.
```

- Title: "Service Signing Keys"
- Info icon (`[i]`): tooltip with the full explanatory copy (see section 5.3)
- "Add Signing Key" button: opens `AddSigningKeyDialog`
- Description: "Register and manage external keys that sign artifacts for your services."

### 5.3 Explanatory Copy

Used in the empty state (displayed inline) and as tooltip text (when keys exist):

> Register external keys that your service uses to sign artifacts such as x402 offers and receipts. OMATrust does not need your private key. Your service signs artifacts wherever you choose — CDP, Thirdweb, Turnkey, AWS KMS, or your own server. OMATrust publishes the trust records that tell agents and verifiers which keys are authorized for your service.

### 5.4 Empty State

When no key metadata records exist for the account:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Service Signing Keys                                  [+ Add Signing Key]│
│                                                                          │
│ Register external keys that your service uses to sign artifacts such     │
│ as x402 offers and receipts. OMATrust does not need your private key.    │
│ Your service signs artifacts wherever you choose — CDP, Thirdweb,        │
│ Turnkey, AWS KMS, or your own server. OMATrust publishes the trust       │
│ records that tell agents and verifiers which keys are authorized for     │
│ your service.                                                            │
│                                                                          │
│                         [+ Add Signing Key]                              │
└──────────────────────────────────────────────────────────────────────────┘
```

The "Add Signing Key" button appears both in the header and centered in the empty state body.

### 5.5 Populated State

When key metadata records exist, each is rendered as a `SigningKeyCard`:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Service Signing Keys                             [i]  [+ Add Signing Key]│
│ Register and manage external keys that sign artifacts for your services. │
│                                                                          │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ SigningKeyCard (see section 6)                                      │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ SigningKeyCard                                                      │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

## 6. Signing Key Card

### 6.1 Component: `SigningKeyCard`

Each card represents one key metadata record, enriched with onchain trust data from `buildServiceKeys()`.

### 6.2 Card Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Production x402 receipt signer                         [x402] [mcp]      │
│                                                                          │
│ Key ID:      did:pkh:eip155:1:0xabc123...                                │
│ Notes:       Stored in AWS KMS, rotated monthly                          │
│                                                                          │
│ Bound subjects:                                                          │
│   did:web:example.com       Active   Basic: Yes  Int: Yes  Adv: No       │
│   did:web:api.example.com   Registered                                   │
│                                                                          │
│ [Publish key binding]  [Add controller witness]  [Edit]                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Displayed Fields

| Field | Source | Description |
|---|---|---|
| Display name | `key_metadata.display_name` | Bold, top of card |
| Tags | `key_metadata.tags` | Badge/pill per tag, top-right |
| Key ID | `key_metadata.key_did` | Monospace |
| Notes | `key_metadata.notes` | Only shown if non-null |
| Bound subjects | Derived from `ServiceKey` entries matching this `key_did` | Per-subject row showing subject DID, status, and trust level |
| Status (per subject) | Derived (see 6.4) | Badge: Registered / Active / Revoked |
| Trust level (per subject) | Derived from `ServiceKey` (see 6.5) | Signal indicators: Basic / Intermediate / Advanced |

Since `subject_did` is not stored in `key_metadata`, the card discovers which subjects the key is bound to by matching `key_metadata.key_did` against `ServiceKey` entries from `buildServiceKeys()`. If the key has no onchain bindings to any subject, the bound subjects area shows "No subject bindings yet."

### 6.4 Derived Status

Status is computed per subject by matching the key metadata record against onchain attestation data:

- **Registered**: `key_metadata` row exists, no matching key-binding attestation found for this key+subject pair in `serviceKeys` (no `keyBindingUid`).
- **Active**: matching key-binding attestation exists and `revocationTime === 0`.
- **Revoked**: matching key-binding attestation exists and `revocationTime > 0`.

Matching is done by comparing `canonicalIdentifier(key_metadata.key_did)` against `ServiceKey.canonicalKeyDid` entries from `buildServiceKeys()`.

### 6.5 Trust Level

Reuses the existing `ServiceKey` trust level computation:

- **Basic**: DNS TXT or did.json confirms controller relationship (`basic === true`).
- **Intermediate**: controller-witness attestation exists (`intermediate === true`).
- **Advanced**: both key-binding and controller-witness exist (`advanced === true`).

Uses the same `Signal` component already used by `ServiceKeyCard`.

### 6.6 Actions

| Action | Condition | Behavior |
|---|---|---|
| Publish key binding | Per-subject: `keyBindingUid` not set for that subject | Link to `/publish/key-binding?subject={subjectDid}&keyId={keyDid}`. If the key has no bound subjects yet, the user is prompted to select or enter a subject DID. |
| Add controller witness | Per-subject: `intermediate === false` | Calls `callControllerWitness()` with confirmation dialog (reuse pattern from `ServiceKeyCard`) |
| Edit | Always | Opens `AddSigningKeyDialog` pre-filled with existing values. Key identifier is disabled (immutable). Submitting re-POSTs (upsert overwrites metadata). |

### 6.7 Tag Labels

| DB Value           | Display Label              |
|--------------------|----------------------------|
| `x402`             | x402 Offers & Receipts     |
| `mcp`              | MCP Server Artifacts       |
| `software-release` | Software Release Proofs    |
| `generic-signing`  | Generic Service Signing    |
| `other`            | Other                      |

## 7. Add Signing Key Dialog

### 7.1 Component: `AddSigningKeyDialog`

A modal dialog for creating or editing key metadata. Uses the existing shadcn/ui `Dialog` component.

### 7.2 Create Mode Fields

| Field | Type | Required | Default | Validation | Placeholder / Example |
|---|---|---:|---|---|---|
| Tags | Multi-select | no | `[]` | Each tag from allowed set | "Select tags..." |
| Display name | Text input | yes | — | Non-empty, max 200 chars | "Production x402 receipt signer" |
| Key identifier | Text input | yes | — | Valid DID format (`did:pkh:`, `did:key:`, `did:jwk:`, `did:ethr:`) | "did:pkh:eip155:1:0x..." |
| Notes | Textarea | no | — | Max 1000 chars | "Stored in AWS KMS" |

Note: `Service ID` is no longer collected in the dialog. Subject-to-key bindings are established onchain via the existing key-binding publish flow after the key is registered. `key_type` is set to `service-signing` automatically.

### 7.3 Tag Multi-Select Options

1. x402 Offers & Receipts
2. MCP Server Artifacts
3. Software Release Proofs
4. Generic Service Signing
5. Other

Multiple tags can be selected. For example, a server wallet used for both x402 and MCP signing would have tags `["x402", "mcp"]`.

### 7.4 Edit Mode

When editing, the dialog is pre-filled with existing values. `Key identifier` is displayed but disabled (immutable). Only `Display name`, `Tags`, and `Notes` can be changed. Submitting re-POSTs (the backend upserts on `(account_id, key_did)`).

### 7.5 Submission

Both create and edit call `POST /api/private/signing-keys` via `upsertSigningKey()`. The backend upserts — if the `keyDid` already exists for the account, it overwrites `displayName`, `tags`, `notes`.

On success, the dialog closes and the signing keys list refreshes. The response includes `created: true` (new key) or `created: false` (updated existing). The frontend can show a toast like "Key registered" or "Key updated" accordingly.

### 7.6 Error Handling

- 400 `INVALID_INPUT`: show inline error with the server message.
- Network errors: show generic error.

## 8. Duplicate Filtering

### 8.1 Problem

Without filtering, a key that appears in Service Signing Keys would also appear in Service Management → Key Authorizations, creating confusing duplication.

### 8.2 Solution

The `ServiceTrustWorkspace` component receives the list of key metadata records and filters them out of the `serviceKeys` array before rendering Key Authorization cards.

Filter logic:

```typescript
const signingKeyDids = new Set(
  keyMetadataRecords
    .filter((km) => km.keyType === "service-signing")
    .map((km) => canonicalIdentifier(km.keyDid))
)

const filteredServiceKeys = serviceKeys.filter(
  (sk) => !signingKeyDids.has(sk.canonicalKeyDid)
)
```

Since `key_metadata` no longer contains `subject_did`, filtering is purely by key DID. If a key has metadata with `key_type = 'service-signing'`, all of its subject bindings are filtered from Key Authorizations — the key is fully managed in the Service Signing Keys section.

Note: uses `canonicalIdentifier()` (from `@oma3/omatrust/identity`) for consistent comparison, matching the existing `isSameControllerId` pattern.

### 8.3 Data Flow

The `DashboardContent` component loads key metadata via `listSigningKeys()` and passes it down to both `ServiceSigningKeys` (for display) and `ServiceTrustWorkspace` (for filtering).

## 9. API Client Functions

Add to `src/lib/omatrust-backend.ts`:

### 9.1 Types

```typescript
export type KeyMetadataTag = "x402" | "mcp" | "software-release" | "generic-signing" | "other"

export type KeyMetadataRecord = {
  id: string
  accountId: string
  keyDid: string
  keyType: "attestation" | "service-signing"
  displayName: string
  tags: KeyMetadataTag[]
  notes: string | null
  created: boolean
  createdAt: string
  updatedAt: string
}

export type UpsertSigningKeyParams = {
  keyDid: string
  keyType: "attestation" | "service-signing"
  displayName: string
  tags?: KeyMetadataTag[]
  notes?: string
}
```

### 9.2 Functions

```typescript
export async function listSigningKeys(params?: {
  keyType?: string
  tag?: string
}): Promise<KeyMetadataRecord[]>

export async function upsertSigningKey(
  params: UpsertSigningKeyParams
): Promise<KeyMetadataRecord>
```

All functions use `backendFetch()` with `credentials: 'include'` for session cookie transport, consistent with existing API client functions.

## 10. Files to Create or Modify

| File | Action | Purpose |
|---|---|---|
| `src/app/dashboard/page.tsx` | modify | Add `ServiceSigningKeys` section, `SigningKeyCard`, `AddSigningKeyDialog`; pass key metadata to `ServiceTrustWorkspace` for filtering; add key metadata loading to `DashboardContent` |
| `src/lib/omatrust-backend.ts` | modify | Add `KeyMetadataRecord` type, `KeyMetadataTag`, `UpsertSigningKeyParams`, `listSigningKeys()`, `upsertSigningKey()` |

## 11. Dashboard Context Integration

The Service Signing Keys section should be visible in the following dashboard contexts (per the section matrix pattern in `docs/features/portal-ui/spec.md`):

| Context | Visible |
|---|---|
| No context (default) | Yes |
| `service-management` | Yes |
| `issuer` | Yes |
| `review` | No |

When `?context=service-management` is eventually wired, the section appears alongside Service Management. For MVP, since context filtering is not yet active, the section appears unconditionally for signed-in users.

## 12. UX Copy Reference

### 12.1 Section Title

"Service Signing Keys"

### 12.2 Section Description (short)

"Register and manage external keys that sign artifacts for your services."

### 12.3 Section Description (full — empty state and tooltip)

"Register external keys that your service uses to sign artifacts such as x402 offers and receipts. OMATrust does not need your private key. Your service signs artifacts wherever you choose — CDP, Thirdweb, Turnkey, AWS KMS, or your own server. OMATrust publishes the trust records that tell agents and verifiers which keys are authorized for your service."

### 12.4 Add Signing Key Button

"Add Signing Key"

### 12.5 Dialog Title

- Create mode: "Register a Service Signing Key"
- Edit mode: "Edit Signing Key"

### 12.6 Dialog Description (create mode)

"Register an external key that your service uses to sign artifacts. OMATrust will not ask for your private key."

### 12.7 Status Badges

- Registered: neutral/default badge
- Active: green/success badge
- Revoked: red/destructive badge

### 12.8 Tags Field Help Text

"What will this key sign? You can select multiple tags. This helps organize your keys and helps verifiers understand the key's purpose."

### 12.9 Key Identifier Field Help Text

"Enter the public key identifier in DID format. Supported formats: did:pkh (EVM signer), did:key, did:jwk, did:ethr. Do not enter your private key."

## 13. Deferred (V2)

- **Key rotation flow**: dialog that accepts a new key identifier, revokes the old key-binding attestation, publishes a new key-binding, and updates the `key_metadata` record.
- **Retire state**: soft deactivation badge and state without onchain revocation.
- **Bulk import**: register multiple signing keys at once (e.g., from a CSV or API).
- **Status change notifications**: alert when a key-binding is revoked externally.
- **Full Service Management restructure**: the current section mixes concepts; a future redesign may split it into subsections aligned with user mental models.

## 14. Risk List

- **User confusion about signing**: users may think OMATrust signs x402 receipts. Mitigated by explicit copy: "OMATrust does not need your private key" and "Your service signs artifacts wherever you choose." The dialog must never include a private key field.
- **Tag drift**: `keyPurpose` in onchain key-binding schema and `tags` in `key_metadata` could diverge if the user selects different values. MVP treats them independently.
- **Duplicate detection edge cases**: filtering relies on canonical DID matching via `canonicalIdentifier()`. If the same key is represented differently (e.g., mixed-case address in `did:pkh`), the filter must normalize correctly. The existing `isSameControllerId` function handles this.
- **No subject in metadata**: since `subject_did` is not stored in `key_metadata`, the card must discover bound subjects from onchain data. If the key has no bindings yet, the card shows an empty bound-subjects area with guidance to publish a key binding.
