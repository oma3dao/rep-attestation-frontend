## Dashboard ✅

- Refer to a user's ID as "User ID" instead of "Wallet"
- Print the whole address- do not drop middle chars
- remove "on omachain testnet"
- "display name" -> "Name"
- "Service identifiers" -> "Service IDs"
- service controller workspace: In this section we have two headers and two subheaders. We only need one header and one subheader.
  - Header: Key Authorizations
  - Subheader: Authorize signing keys For each of your services
- key<>service cards
  - remove "key authorization"- It's redundant.
  - Replace subject with service ID And make it a darker font.
  - Add a key label to the key ID. The font should be the same as the service ID font. Those two DIDs identify the card so they should be equally important.
  - Do not shorten the key DID.
  - "sources" Should Be more prominent but not as prominent as service ID and key ID.
  - Label bold, value in monospace font for clear distinction.
- "Link another identity" -> "Add Link"
- Trusted Attestations of My Services section
  - Don't shorten wallet addresses.
  - Service ID, not subject.
- My attestations
  - Recipient -> Service
- Publish button
  - User review should go directly to the user review form.

  
## Attestation Modal ✅

- UID->Attestation UID
- View transaction->View transaction onchain
- Subject -> Service ID
- Controller -> KeyID
- Method -> Proof Mechanism
- Observed at: Convert this to something human-readable.

## Account Page ✅

- Wallet->User ID
- Wallet type -> type


---

## Main Page (not yet implemented)

- The latest trust profile cards should have a lot more information
  - signing key with ownership confirmed (e.g.- DNS TXT or did.json)
  - key with ownership anchored on omatrust
  - enterprise key management (key binding)
  - cybersecurity assessment from trusted entity
  - aggregated user review stars

## Forms UX ✅

- Make the attestation forms more user-friendly by updating field titles in the JSON schemas
- Approach: `title` is the user-facing label. If a DID field, title ends with "ID".
- Changes applied to `schemas-json/*.schema.json` and regenerated `src/config/schemas.ts`:
  - key-binding: subject → "Service ID", keyId → "Key ID", keyPurpose → "Authorized Use"
  - controller-witness: subject → "Service ID", controller → "Key ID", method → "Verification Method", observedAt → "Observed At"
  - user-review: subject → "Service ID", version → "Version"
  - security-assessment: subject → "Service ID"
  - certification: subject → "Service ID", assessor → "Assessor ID"
  - linked-identifier: subject → "Primary ID", linkedId → "Linked ID", method description simplified
  - user-review-response: already good (Reviewer ID, Response)
- Descriptions also updated to be more conversational and explain field relationships
- Field descriptions moved from inline text to tooltips (hover/tap info icon)
- Proofs field now correctly routes to the guided ProofInput component (was broken — fell into generic array input)
- Timestamp fields: picker hidden by default, only shown when user checks "Override current time"
- Card content top padding restored after removing required fields indicator text
- Field ordering: render in schema order, not required-first (not yet implemented — waiting on schema field order review)

