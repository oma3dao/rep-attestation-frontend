# Subscription-Gated Attestation — Frontend Spec

Status: Planned

## Goal

Integrate `rep-attestation-frontend` with `omatrust-backend` so that users can submit any attestation without holding OMA. Users pay for a subscription; the backend relay pays gas on their behalf.

## Current state

The frontend currently handles attestation submission via two paths:

- **Subsidized schemas** (`user-review`, `linked-identifier`): the frontend-hosted delegated-attest server at `/api/eas/delegated-attest` submits the transaction and pays gas. No account or subscription required.
- **All other schemas**: the user connects a self-custody wallet, transfers OMA on OMAChain to the wallet, pays gas in OMA, and submits the transaction directly via `ethers.JsonRpcProvider`.

This means non-crypto users cannot submit attestations beyond the two subsidized schemas.

## V1 routing rules

### RPC endpoint routing

- **Public browsing and landing-page attestation queries**: always use the public RPC endpoint in V1.
- **Backend relay writes** (backend-submitted attestations): always use the premium RPC endpoint internally, because the backend is paying gas from its own infrastructure.
- **Frontend premium attestation-query routing**: deferred in V1. Premium RPC is backend infrastructure now, not part of the landing-page query experience.

### Attestation submission routing

- **Wallets in `subscription` execution mode**: all attestations go through `POST /api/private/relay/eas/delegated-attest` on `omatrust-backend`. The backend handles nonce fetching, signature verification, schema eligibility, and transaction submission internally. The frontend does not make a separate nonce endpoint call. Every relay submission decrements one sponsored write credit, regardless of schema.
- **Wallets in `native` execution mode**: keep the current frontend execution behavior. Subsidized schemas (`user-review`, `linked-identifier`) use the current frontend-hosted delegated-attest path. All other schemas use direct transaction via the user's wallet, with the user paying gas in OMA.

### Execution-mode routing matrix

All wallets create or load a backend account and session before attestation submission. The execution path is then determined by wallet-scoped `executionMode`.

| Wallet provider | Allowed execution modes | Backend account + session | `user-review` / `linked-identifier` | All other schemas |
|---|---|---|---|---|
| `inApp` | `subscription` only | required | backend relay | backend relay |
| anything else | `subscription` or `native` | required | `subscription` -> backend relay, `native` -> current frontend-hosted delegated-attest path | `subscription` -> backend relay, `native` -> current direct transaction path |

The current frontend-hosted delegated-attest path remains part of the V1 `native` execution experience for the two subsidized schemas. This is an execution-mode rule constrained by wallet provider type, not a route-based or migration-era split.

---

## Browser transport model

For V1, the frontend calls `omatrust-backend` directly for session, subscription, and relay flows.

- browser requests go directly to `backend.omatrust.org` (or the matching preview backend origin)
- requests use `fetch(..., { credentials: "include" })` for cookie-based session auth
- `omatrust-api-gateway` is not in the request path for these V1 browser flows
- the backend supports credentialed CORS for the allowed frontend origins

### Backend CORS expectation

The backend must allow credentialed CORS requests from the approved frontend origins:

- `Access-Control-Allow-Origin` set to the exact requesting origin (not `*`)
- `Access-Control-Allow-Credentials: true`
- preflight handling for browser `OPTIONS` requests

Example allowed origins:

- `https://preview.reputation.omatrust.org`
- `https://reputation.omatrust.org`
- `http://localhost:3001`

---

## Sign-in and account creation flow

The backend session is not established on page load. Account creation and wallet connection are delayed until the user initiates sign-in.

The frontend uses an auth chooser modal triggered by the "Sign In" button or `?action=signin` query parameter.

### Auth chooser modal

The modal presents two options:

- **Existing account** — shows the wallet sign-in path for an already-connected or newly connected wallet
- **New account** — starts account creation

The Thirdweb ConnectButton only appears inside this modal and on the `/account` page. It is never shown in the header navigation.

### Implementation notes

- the challenge → sign → verify flow is implemented as a single imperative async function (`performChallengeSignVerify`) called from button callbacks
- the `BackendSessionProvider` restores session state on startup via `GET /api/private/session/me` even before Thirdweb wallet hydration completes
- the `BackendSessionProvider` treats wallet disconnect as logout and clears the backend session cookie
- the frontend shows an explicit `Log Out` action on `/account`

### Existing account

- if no wallet is connected, the modal shows the Thirdweb ConnectButton
- once a wallet is connected, sign-in proceeds automatically without a separate "Continue Sign In" step
- if a wallet is already connected when the user opens the existing-account path, the frontend starts the SIWE challenge → sign → verify flow directly

### New account

There are two create-account paths depending on whether a subject is required.

#### Flow A: simple account creation

Used when no subject or organization URL is required.

- modal title: `Create Account`
- required field: `Display name`
- primary path: `Create Account`
- secondary path: `Pay with OMA instead →`

The primary path is the managed / subscription-oriented creation path. The secondary path is a self-custody / native execution path using the Thirdweb wallet picker without managed wallets.

#### Flow B: subject-required attestation submission

Used when the user submits a subject-scoped attestation and does not yet have a verified subject on their account.

Flow B is a chained sequence of two independent modals orchestrated by `AttestationForm`. The auth dialog and the subject confirmation dialog each handle one concern. Neither modal knows about the other — `AttestationForm` chains them via the `onSubmitAfterAuth` callback.

**Step 1 — Account creation (auth dialog, Flow A)**

The auth dialog opens exactly as in Flow A. The user enters a display name, connects a wallet, and creates an account. No subject fields appear in this modal. The auth dialog closes once the session is established.

**Step 2 — Subject verification (subject confirmation dialog)**

Immediately after the auth dialog closes, `AttestationForm` checks whether the schema is subject-scoped and whether the account already has a verified non-bootstrap subject. If a subject is needed, `AttestationForm` opens the `SubjectConfirmationDialog` automatically — the user does not return to the form between modals.

The subject confirmation dialog is the same component used on the `/account` page. It includes:

- DID method picker
- method-specific proof instructions (DNS TXT, did.json, wallet match, contract ownership)
- verification action with retry
- submit action that calls `POST /api/private/subjects` to persist the subject

The dialog pre-populates the subject input when a hint is available. If the attestation form's subject field contains a `did:web` value or a domain-like string, `AttestationForm` passes it as a `subjectHint` so the user doesn't re-enter it.

**Step 3 — Attestation submission**

After the subject dialog closes with a verified subject, `AttestationForm` proceeds to submit the attestation. The user does not click the submit button again.

**Chaining implementation**

`AttestationForm.handleSubmit` builds the `onSubmitAfterAuth` callback as an async function that runs after the auth dialog closes:

1. Refresh the session to pick up the newly created account state.
2. Check if the schema is subject-scoped and the account lacks a verified subject.
3. If a subject is needed, open `SubjectConfirmationDialog` and await its completion via a promise-based wrapper.
4. After the subject dialog resolves, call `submitPreparedAttestation`.

If the subject dialog is dismissed without completing verification, the chain aborts and the user returns to the form. The session remains valid — the user can retry submission, and only the subject dialog will reappear (the auth step is already complete).

**Important V1 rules:**

- the auth dialog never collects subject information — it handles identity only
- subject verification is a separate modal that chains after account creation
- the user experiences a continuous flow: auth dialog → subject dialog → submission, without returning to the form between steps
- if the user already has a verified subject (e.g., added from `/account`), step 2 is skipped entirely
- the `SubjectConfirmationDialog` component is shared between this chained flow and the `/account` page — one implementation, two entry points

### Backend account creation behavior

After wallet connection:

- frontend calls `POST /api/private/session/wallet/challenge` then `POST /api/private/session/wallet/verify`
- backend creates account, wallet, default `did:pkh` subject, free-tier subscription, credential, and session
- `walletProviderId` is sent to the backend (detected from `useActiveWallet().id`)
- backend returns wallet context via `session/me`, including `walletProviderId` and wallet-scoped `executionMode`
- if the user entered a display name or organization name, frontend calls `PATCH /api/private/accounts/me` to persist it
- for social/in-app wallets: SIWE signature is auto-signed, user sees no pop-up
- for self-custody wallets: user sees a wallet pop-up to sign the SIWE message

Execution-mode rules on first sign-in:

- `inApp` wallets are automatically set to `subscription`
- non-`inApp` wallets choose `subscription` or `native` on first sign-in
- the chosen `executionMode` is persisted on the wallet and reused on later sessions

Every wallet creates or loads a backend account and session here, including wallets that will later use `native` execution mode.

### Attestation submission after sign-in

Once the user has a valid backend session, the submission path depends on whether the schema requires a subject.

**Non-subject-scoped schemas:**

Submission proceeds directly. The user signs the EIP-712 attestation payload and the frontend routes to the appropriate execution path.

**Subject-scoped schemas:**

Before submission, `AttestationForm` checks whether the account has a verified non-bootstrap subject (i.e., a subject other than the default wallet `did:pkh`). If no verified subject exists, the `SubjectConfirmationDialog` opens. Submission proceeds only after the subject is verified and attached to the account.

This check applies regardless of how the user arrived at submission — whether they just created an account (Flow B chaining) or are a returning user with an existing session.

**Execution path routing (applies to all schemas after any subject gate is satisfied):**

- User signs the EIP-712 attestation payload
  - Social/in-app wallets: auto-signed, no pop-up
  - Self-custody wallets: wallet pop-up showing the typed data
- **`subscription` execution mode**: frontend submits via `POST /api/private/relay/eas/delegated-attest`. Backend verifies signature, checks entitlement, submits transaction, returns txHash and attestation UID. One sponsored write credit is decremented.
- **`native` execution mode + subsidized schema**: frontend uses the current frontend-hosted delegated-attest path.
- **`native` execution mode + non-subsidized schema**: frontend submits the transaction directly via the user's wallet. User pays gas in OMA.
- Frontend shows confirmation with transaction hash and attestation UID

Note: the free tier allows any schema — there is no schema restriction on the free plan. The user only needs to upgrade to paid when their free write credits are exhausted, not based on which schema they're using.

If a wallet is in `subscription` execution mode and has no usable entitlement, the frontend should direct the user to upgrade or buy more entitlement. V1 does not auto-fallback that wallet to `native` mode per submission.

### Returning users

If the user already has a backend session (cookie present and valid):

- skip account creation
- if the schema is subject-scoped and the account has no verified non-bootstrap subject, `AttestationForm` opens the `SubjectConfirmationDialog` before submission — the same dialog used in Flow B and on `/account`
- if the account already has a verified subject, go directly to submission
- the submission path is determined by the wallet's persisted `executionMode`

---

## Unauthenticated user experience

Unauthenticated users can:

- browse the landing page, publish page, and view existing attestations (public RPC, no session needed)
- see "Sign In" button in the header navigation

Unauthenticated users cannot:

- submit any attestation
- access subscription, account, or session features

The header "Sign In" button opens the auth chooser modal. The `?action=signin` query parameter (used by the OMATrust landing page) also opens the modal automatically on page load.

When signed in, the header button changes to show the user's display name or truncated wallet address and links to `/account`.

### Sign In vs Sign Up

- Both call the same backend flow (SIWE challenge → verify → account created if new, loaded if existing)
- The distinction is a UI framing choice, not a backend difference
- Sign Up sets the expectation that the user is creating a new account
- Sign In sets the expectation that the user is returning

### Account creation for all users

V1 requires account creation for all attestation submissions, including subsidized schemas. This means:

- every user gets an account, a session, and a free-tier subscription
- account/session creation happens before submission regardless of wallet type
- the frontend loads `walletProviderId` and `executionMode` after sign-in to decide the execution path
- managed wallets (`inApp`) are constrained to `subscription` execution mode
- other wallets may persist either `subscription` or `native`
- `subscription` mode uses the backend relay for all schemas
- `native` mode keeps the current frontend submission behavior: subsidized delegated-attest for the two subsidized schemas, direct transaction for all other schemas

---

## Subject ownership confirmation

Certain attestations are subject-scoped — the signer is acting on behalf of a subject (a DID such as `did:web:example.com`). These attestations require the user to prove ownership of the subject before the attestation can be submitted.

Subject-scoped attestations in V1:

- **Key binding** — binds a wallet to a subject DID
- **Linked identifier** — links an external identifier to a subject DID
- **User review response** — a response filed on behalf of the subject being reviewed

### Current V1 behavior

The canonical place to add and verify a subject is now the `/account` page.

Account-page behavior:

- the page shows a `Subject Identifier` card between `Name` and `Wallet`
- if the only subject on the account is the default wallet `did:pkh`, the UI hides it and treats the account as missing a meaningful subject
- in that state the page prompts the user to add a URL they own
- clicking the CTA opens a subject confirmation modal

Subject confirmation modal behavior:

- the modal includes a DID method picker
- it shows method-specific proof instructions
- it calls `POST /api/verify/subject-ownership` as a public preflight verification step
- it then calls `POST /api/private/subjects` to persist the subject on the account

Important backend rule:

- the frontend verification step is UX preflight only
- `POST /api/private/subjects` is the authoritative ownership check
- other clients cannot bypass ownership checks by skipping the public verification endpoint

Bootstrap-subject replacement rule:

- if the account only has the default bootstrap wallet `did:pkh` subject and the user adds their first meaningful subject such as `did:web:example.com`, the backend replaces the bootstrap subject with the real one
- the real subject becomes the default subject for the account

### Re-verification rules

Subject ownership is checked by the backend on each subject-scoped attestation submission via direct onchain lookup. The backend does not cache key-binding or subject ownership state. As long as the DNS-TXT or `.well-known/did.json` record remains active, subsequent subject-scoped attestations proceed without re-prompting the user for verification setup.

If the DNS-TXT or `.well-known` record is removed, the backend will reject the attestation and the frontend should prompt the user to re-verify.

See `docs.omatrust.org` for key-binding proof formats and controller-witness attestation details.

See `app-registry-frontend` for its implementation of `did:web` ownership checking.

---

## Wallet provider metadata

The frontend detects the connected Thirdweb wallet provider id and sends it to `omatrust-backend` during SIWE session verification.

Source: `useActiveWallet().id`

Examples:

- `inApp` — Thirdweb-managed in-app/social wallets
- `io.metamask`
- `walletConnect`
- `com.coinbase.wallet`

V1 product rules:

- `walletProviderId` remains the raw technical field name for the stored Thirdweb provider identifier
- `walletProviderId === "inApp"`: managed wallet, constrain the wallet to `subscription` execution mode
- all other values: still create a backend account and session, then allow either `subscription` or `native` execution mode

---

## Execution Mode

`executionMode` is wallet-scoped metadata persisted by the backend and returned in session context.

Allowed V1 values:

- `subscription`
- `native`

V1 rules:

- `executionMode` is established on the wallet's first sign-in
- `executionMode` is wallet-scoped, not per-submission
- `inApp` wallets may only use `subscription`
- other wallets may use `subscription` or `native`
- future wallet-management UI may allow toggling `executionMode`, but that is not required for V1

`GET /api/private/session/me` should return both:

- `walletProviderId`
- `executionMode`

---

## Premium RPC (internal)

Premium RPC is infrastructure hidden from the user.

- The backend relay uses the premium RPC internally for nonce lookups and transaction submission
- The frontend does not call a separate nonce endpoint for subscription-path attestations — the backend's `delegated-attest` endpoint handles nonce fetching internally
- V1 landing page attestation queries (browsing reviews, checking scores) use the public RPC endpoint regardless of subscription status
- Premium read routing for attestation queries is deferred until a user dashboard is built

### Premium RPC fallback

When the premium RPC endpoint fails (including quota exhaustion via `PREMIUM_READ_LIMIT_EXCEEDED`), the frontend should:

- fall back to the public RPC endpoint for reads
- log the error for debugging (console or a lightweight error reporting service)
- not surface the premium RPC failure to the user — the fallback should be transparent

Transport note: `ethers.JsonRpcProvider` against the backend URL is not sufficient for cookie-based auth. Use a custom fetch-based JSON-RPC transport with `credentials: "include"` when calling backend RPC endpoints.

### Future consideration (post-V1)

A smart RPC router could inspect the JSON-RPC method and route `eth_sendRawTransaction` (gas-paying writes) through the premium endpoint for all users, while gating reads by subscription. This is deferred from V1.

---

## Account page (implemented)

The `/account` page shows:

- wallet DID and wallet type in a single combined wallet card
- wallet type language uses `Managed wallet` or `Self-custodial wallet` rather than provider metadata
- a single wallet management control in that same card via the Thirdweb connect button
- a `Subject Identifier` card between the `Name` and `Wallet` cards
- if the only subject is the wallet DID itself, the page hides it and treats the account as missing a meaningful subject identifier
- in that empty state, the page prompts the user to add a subject identifier with the CTA copy `Add your Subject Identifier.`
- clicking that CTA opens a subject confirmation modal
- the subject confirmation modal includes:
  - a DID method picker
  - method-specific ownership instructions
  - a verification action
  - a submit action
- the name card is labeled `Name`
- an explicit `Log Out` button is shown on the account page and disconnects the wallet while revoking the backend session
- the subscription card shows:
  - plan and status
  - remaining reads
  - remaining writes
  - renewal date when available
  - explanatory copy that reads and writes reset on renewal
- if the account is on the free plan, the subscription card includes an upgrade button

The page redirects to `/` when the session is lost (wallet disconnect, session expiry).

The header shows the user's display name or truncated wallet address when signed in, linking to `/account`. When not signed in, the header shows "Sign In".

## Still to implement:
- `src/lib/eas.ts` — attestation routing logic (backend relay path)
- custom JSON-RPC transport for premium RPC
- chained subject-verification flow in `AttestationForm` (Flow B): promise-based `SubjectConfirmationDialog` wrapper, subject-gate check in `onSubmitAfterAuth`, subject hint pre-population from form data
- remove vestigial `createSubjectInfo` and `createSubjectVerify` wizard steps from `auth-entry-dialog.tsx`

---

## Acceptance criteria

- [x] All new attestation submissions require account creation or sign-in
- [x] Every wallet creates or loads a backend account and session before attestation submission
- [x] Wallet first sign-in establishes a persisted wallet-scoped `executionMode`
- [ ] Managed wallets (`inApp`) can submit any attestation through the backend relay without holding OMA
- [ ] Every relay submission decrements one sponsored write credit regardless of schema
- [ ] Free-tier users can submit any schema until their write credits are exhausted
- [ ] Wallets in `native` execution mode keep the current frontend behavior: subsidized delegated-attest for the two subsidized schemas and direct transaction for all other schemas
- [ ] Wallets in `subscription` execution mode always use the backend relay path
- [x] Managed wallets (`inApp`) are constrained to `subscription` execution mode
- [ ] Wallets in `subscription` execution mode with exhausted entitlement are routed to upgrade, not per-submission fallback
- [x] Subject ownership verification exists with manual retry and backend enforcement
- [x] Subject ownership is re-checked authoritatively by the backend when a subject is attached to the account
- [ ] Subject-scoped attestation submission gates on verified subject — opens SubjectConfirmationDialog inline if needed (chained flow)
- [x] Account page shows plan, usage, and upgrade option
- [x] Backend session cookies are included on all backend requests
- [ ] Premium RPC credentials are never exposed to the browser
- [ ] Premium RPC failures fall back to public RPC transparently
- [x] Landing page attestation queries continue to use the public RPC endpoint
- [x] The current frontend-hosted delegated-attest path remains functional for self-custody submissions of the two subsidized schemas

---

## Preserved from earlier spec versions

The following details from earlier drafts are retained for reference:

- `ethers.JsonRpcProvider` instances in `src/lib/attestation-queries.ts` and `src/lib/server/eas-routes.ts` are the current direct RPC usage points that will need updating
- the `src/lib/eas.ts` routing logic (`isSubsidizedSchema`) currently decides between delegated and direct paths — this will be extended to include the backend relay path
- the Thirdweb `ConnectButton` in `header.tsx` currently uses inline `<style>` overrides that should be moved to globals.css during the design system alignment workstream
