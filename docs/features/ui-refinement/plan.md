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

## Forms UX (not yet implemented)

- Make the attestation forms more user-friendly
- Likely requires changes to:
  - `schemas.json` (field metadata, labels, descriptions, validation hints)
  - `rep-attestation-tools-evm-solidity` (schema definitions on-chain)
  - Form rendering logic in the frontend (how schema fields map to UI inputs)
