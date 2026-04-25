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

- **Wallets in `subscription` execution mode**: all attestations use the backend relay on `omatrust-backend`. The frontend first calls `GET /api/private/relay/eas/nonce?attester=0x...` to fetch the signable EAS nonce through the backend's premium-read path, signs the delegated payload, then submits it to `POST /api/private/relay/eas/delegated-attest`. The backend re-fetches the authoritative nonce before signature verification/submission. Every successful relay submission decrements one sponsored write credit, regardless of schema.
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

## Wallet connection architecture

The frontend manages two independent pieces of state: the Thirdweb wallet connection (client-side, stored in browser local storage by Thirdweb) and the backend session (server-side, stored as an httpOnly cookie). Keeping these in sync is the primary source of complexity.

### Design principles

- the backend session cookie is the source of truth for "is the user signed in"
- the Thirdweb wallet connection is needed only for signing (SIWE, EIP-712 attestation payloads, direct transactions)
- a valid submission state requires both a session and a connected wallet — if either is missing, the user goes through the auth dialog
- if a session exists but the wallet is not connected (autoConnect failed), the session is treated as stale and cleared — the user re-authenticates from scratch

### Provider-level autoConnect

A single `useAutoConnect` call runs inside `BackendSessionProvider` (or a sibling component at the provider level). This replaces the per-`ConnectButton` `autoConnect` prop. It runs once on app mount, attempts to restore the previously connected wallet from Thirdweb's local storage, and either succeeds or fails silently.

Configuration:

- `client`: the Thirdweb client
- `wallets`: the full wallet list (inAppWallet + MetaMask + Coinbase + WalletConnect)
- `timeout`: 15000ms
- failure is non-fatal — if autoConnect fails (stale key, cleared storage, etc.), the app continues with no wallet connected

No `ConnectButton` instance should set `autoConnect`. AutoConnect is handled once at the provider level.

Startup sequencing:

1. `useAutoConnect` runs and attempts wallet restoration
2. `BackendSessionProvider` waits for autoConnect to finish (`isLoading` becomes false)
3. If no wallet was restored, skip the session check — set session to null and mark loading as done. Even if a cookie exists, the session is stale without a wallet.
4. If a wallet was restored, call `GET /api/private/session/me` to check for an existing backend session
5. If both wallet and session exist, the user is fully signed in on page load

This ordering prevents unnecessary network requests on clean browsers and avoids the transient "session without wallet" state during the autoConnect window.

### useConnectModal for user-initiated wallet connection

The auth dialog and any other place that needs to prompt the user to connect a wallet uses `useConnectModal` from `thirdweb/react` instead of rendering a `ConnectButton`. This hook provides an imperative `connect()` function that opens the Thirdweb wallet picker as its own modal overlay and returns a promise that resolves with the connected wallet.

Benefits:

- the Thirdweb wallet picker is independent of the auth dialog's lifecycle — no "ConnectButton inside a modal" issues
- the auth dialog can use a plain `<Button>` that calls `connectModal.connect(...)` on click
- the wallet picker opens as an overlay on top of the auth dialog, or the auth dialog can close first if preferred
- the promise-based API integrates cleanly with the imperative `performChallengeSignVerify` flow

### ConnectButton usage

`ConnectButton` is used only on the `/account` page for the "Manage Wallet" control, where it shows the connected wallet's details and provides disconnect/switch functionality. It should set `autoConnect={false}` since autoConnect is handled at the provider level.

### Submission gate wallet matrix

When the user clicks "Submit" on `AttestationForm`, the button is always enabled and always labeled "Submit Attestation." The form does not inspect wallet or session state to decide the button label or disabled state. Instead, `handleSubmit` evaluates a 2×2 matrix:

| | Wallet connected | Wallet not connected |
|---|---|---|
| **Session exists** | Submit directly (happy path) | Clear session, open auth dialog |
| **No session** | Open auth dialog (wallet already available for SIWE) | Open auth dialog |

Only the top-left cell (session + wallet) proceeds to submission directly. All other cells route through the auth dialog, which handles wallet connection and session creation in one flow.

The "session exists, wallet not connected" cell clears the session before opening the auth dialog. If autoConnect failed, the wallet identity is gone and the session is unusable for signing. Rather than attempting to reconnect and verify the wallet matches, the frontend treats this as a stale session and starts fresh. The user goes through the auth dialog, connects their wallet, and either signs into their existing account (the backend matches the wallet DID) or creates a new one. This eliminates wallet-mismatch edge cases and keeps the code path simple.

For managed wallets, the SIWE re-sign is invisible (auto-signed). For self-custody wallets, it's one wallet pop-up — a small cost for robust synchronization.

### Logout

The `logout` function in `BackendSessionProvider` handles both sides imperatively:

1. Call `POST /api/private/session/logout` to revoke the backend session and clear the cookie
2. Call `disconnect(activeWallet)` to disconnect the Thirdweb wallet
3. Call `clearWalletBrowserState()` to clean up WalletConnect IndexedDB and Thirdweb localStorage (best-effort — may be blocked by open connections)
4. Navigate via `window.location.href = "/"` for a full page unload, which destroys the WalletConnect Core singleton and releases all browser state

The full page navigation on logout ensures a clean slate. Any wallet state that `clearWalletBrowserState()` couldn't delete (due to open IndexedDB connections) is released when the page unloads.

The `ConnectButton` on the `/account` page hides the Thirdweb disconnect option (`connectHideDisconnect`) so users go through the explicit Log Out button, which properly cleans up both the backend session and wallet state.

---

## Sign-in and account creation flow

The backend session is not established on page load. Account creation and wallet connection are delayed until the user initiates sign-in.

The frontend uses an auth chooser modal triggered by the "Sign In" button or `?action=signin` query parameter.

### Auth chooser modal

The modal presents two options:

- **Existing account** — shows the wallet sign-in path for an already-connected or newly connected wallet
- **New account** — starts account creation

The auth dialog uses `useConnectModal` to trigger wallet connection when needed. No `ConnectButton` is rendered inside the dialog. The Thirdweb wallet picker opens as its own overlay when the user clicks a sign-in or create-account button and no wallet is connected.

### Implementation notes

- the challenge → sign → verify flow is implemented as a single imperative async function (`performChallengeSignVerify`) called from button callbacks
- the auth dialog uses `useConnectModal` to open the Thirdweb wallet picker — no `ConnectButton` is rendered inside the dialog
- provider-level `useAutoConnect` handles wallet restoration on app mount; individual components do not manage autoConnect
- `BackendSessionProvider` waits for `useAutoConnect` to finish (its `isLoading` becomes false) before calling `GET /api/private/session/me` — this prevents the transient "session exists, wallet not yet restored" state from triggering stale-session clearing
- if autoConnect succeeds and the session cookie is valid, the user is fully signed in on page load with no interaction required
- if autoConnect fails and a session cookie exists, the session is treated as stale and cleared — the user will be prompted to sign in when they try to submit
- the frontend shows an explicit `Log Out` action on `/account`

### Existing account

- the auth dialog shows a plain button (not a ConnectButton) for sign-in
- clicking the button calls `useConnectModal.connect(...)` if no wallet is connected, which opens the Thirdweb wallet picker as an overlay
- if a wallet is already connected (autoConnect succeeded), the SIWE flow starts immediately without opening the wallet picker
- once a wallet is connected, sign-in proceeds automatically via `performChallengeSignVerify`

### New account

The account-creation modal itself is always identity-first. It creates the account and session before any subject work happens.

#### Flow A: simple account creation

Used when no subject or organization URL is required.

- modal title: `Create Account`
- required field: `Display name`
- primary path: `Create Account`
- secondary path: `Pay with OMA instead →`

The primary path is the managed / subscription-oriented creation path. The secondary path is a self-custody / native execution path using the Thirdweb wallet picker without managed wallets.

#### Flow B: subject-required attestation submission

Used when the user submits a subject-scoped attestation and does not yet have a verified subject on their account.

Flow B stays in one continuous auth funnel. The auth dialog creates the account first, then branches into a subject-setup step if needed. After sign-in (and subject setup if required), the dialog shows a success message and the user closes it to return to the form.

**Step 1 — Account creation**

The auth dialog opens exactly as in Flow A. The user enters a display name, connects a wallet, and creates an account. No subject fields appear in this step.

**Step 2 — Post-auth subject setup**

If the pending submission is subject-scoped and the newly authenticated account still only has the bootstrap wallet subject, the auth dialog moves to `Verify Subject Ownership` instead of showing the success message.

This step includes:

- organization URL input
- derived `did:web` preview
- proof-method selection (`DNS TXT` or `did.json`)
- proof instructions using the connected wallet DID
- verification + subject-attach action

The auth dialog pre-populates the subject URL when a hint is available. If the attestation form's subject field contains a `did:web` value or a domain-like string, `AttestationForm` passes it as `subjectHint` so the user does not re-enter it.

**Step 3 — Success and return to form**

After sign-in completes (and subject setup if needed), the auth dialog shows a success message: "You're signed in. Close this dialog and click Submit Attestation to publish." The user closes the dialog and clicks the submit button again. The second click runs with fresh hook values — session exists, wallet connected — and submits directly.

**Important V1 rules:**

- account creation and subject setup are still separate concerns, but they remain in one continuous funnel for subject-scoped first-time submissions
- the account is created before the subject is attached
- if the user already has a verified non-bootstrap subject, the subject-setup step is skipped entirely
- the auth dialog does not submit the attestation — it only establishes the session and subject, then the user clicks submit again
- `/account` remains the general management surface for subjects, but first-time subject-scoped submission does not force the user to leave the publish funnel

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

### Attestation submission gate

The submit button on `AttestationForm` is always enabled and always labeled "Submit Attestation." The form does not change the button label or disabled state based on wallet or session state. When the user clicks submit, `handleSubmit` runs the gate sequence:

**Gate 1 — Session + Wallet**

The form checks session and wallet state together per the wallet matrix above:

- **Session exists, wallet connected**: proceed to Gate 2.
- **Session exists, wallet not connected**: clear the session (it's stale without a wallet), then open the auth dialog in `chooser` mode. The user re-authenticates from scratch.
- **No session** (wallet connected or not): open the auth dialog in `chooser` mode. If a wallet is already connected, the SIWE flow can start immediately inside the dialog. If not, the dialog handles wallet connection via `useConnectModal`.

After the auth dialog completes and the user closes it, they click the submit button again. The second click runs with a valid session and connected wallet, proceeding to Gate 2.

**Gate 2 — Live subject verification (subject-scoped schemas only)**

If the schema is subject-scoped, `AttestationForm` calls `POST /api/verify/subject-ownership` with the form's subject DID and the connected wallet DID. This is a live check — it hits DNS TXT, `.well-known/did.json`, on-chain key bindings, controller-witness attestations, and linked identifiers. The stored subjects in the database are not the authority here; the live proof sources are.

If the live check passes, submission proceeds.

If the live check fails:

1. If the form's subject was previously stored on the account, the backend removes it (subject pruning — see re-verification rules below).
2. `AttestationForm` opens the `SubjectConfirmationDialog` pre-populated with the form's subject value. The dialog shows proof instructions so the user can set up their DNS TXT / did.json / key binding and retry verification.
3. After the dialog fires `onSubjectCreated` (verification passed and subject re-attached), `AttestationForm` proceeds to submission.
4. If the user dismisses the dialog without completing verification, the submission is aborted.

This gate applies regardless of how the user arrived:

- unauthenticated user who just completed account creation
- returning user with an existing session
- user whose previously verified subject has become stale (DNS record removed, key binding revoked)

**Subject field pre-population for signed-in users**

When the user has a session with a `primarySubject` that is not the bootstrap wallet DID, `AttestationForm` pre-populates the subject field with that value on mount. The user can change it to any other subject. If they enter a subject that doesn't pass the live check, Gate 2 handles it.

**How `SubjectConfirmationDialog` is used in this context**

The dialog's existing interface (`open`, `onOpenChange`, `walletDid`, `existingSubjectDids`, `onSubjectCreated`) is sufficient. `AttestationForm` wraps it with a promise so `handleSubmit` can `await` the subject step:

1. `AttestationForm` sets a `pendingSubjectResolve` ref and opens the dialog.
2. `onSubjectCreated` resolves the promise and closes the dialog.
3. `onOpenChange(false)` without a subject rejects the promise, aborting submission.

This keeps `SubjectConfirmationDialog` as a single shared implementation — `/account` uses it for general subject management, `AttestationForm` uses it as a submission gate.

**Submission (after both gates are satisfied)**

- **`subscription` execution mode pre-sign step**: frontend calls `GET /api/private/relay/eas/nonce?attester=0x...` to fetch the nonce needed to construct the EIP-712 delegated payload. This is a premium metered read and should go through `omatrust-backend`, not directly to the public RPC endpoint.
- User signs the EIP-712 attestation payload
  - Social/in-app wallets: auto-signed, no pop-up
  - Self-custody wallets: wallet pop-up showing the typed data
- **`subscription` execution mode**: frontend submits via `POST /api/private/relay/eas/delegated-attest`. The backend re-fetches the authoritative nonce, verifies signature, checks entitlement, submits transaction, returns txHash and attestation UID. One sponsored write credit is decremented.
- **`native` execution mode + subsidized schema**: frontend uses the current frontend-hosted delegated-attest path.
- **`native` execution mode + non-subsidized schema**: frontend submits the transaction directly via the user's wallet. User pays gas in OMA.
- Frontend shows confirmation with transaction hash and attestation UID
- after successful submission, `AttestationForm` navigates the user to `/dashboard` where they can see their attestation — this replaces the current `window.alert()` confirmation

Note: the free tier allows any schema — there is no schema restriction on the free plan. The user only needs to upgrade to paid when their free write credits are exhausted, not based on which schema they're using.

If a wallet is in `subscription` execution mode and has no usable entitlement, the frontend should direct the user to upgrade or buy more entitlement. V1 does not auto-fallback that wallet to `native` mode per submission.

### Returning users

If the user already has a backend session (cookie present and valid):

- skip account creation (Gate 1 passes immediately)
- subject field is pre-populated from the account's primary subject (editable)
- if the schema is subject-scoped, Gate 2 runs the live verification check against the form's subject
- if the live check passes, submission proceeds directly
- if the live check fails, `SubjectConfirmationDialog` opens so the user can re-verify or set up a new proof
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

Subject ownership is verified live on each subject-scoped attestation submission. The live check hits all available proof sources:

- DNS TXT records (`_controllers.<domain>`)
- `.well-known/did.json` DID documents
- on-chain key-binding attestations
- on-chain controller-witness attestations
- on-chain linked-identifier attestations

The backend does not rely on stored subject records as proof of ownership. Stored subjects are a convenience cache for pre-populating the UI and displaying the account's known subjects.

**Subject pruning on failed live check:**

If a live verification check fails for a subject that is stored on the account, the backend removes that subject from the account's stored subjects. This keeps the database in sync with the actual state of the proof sources. The user is then prompted to re-verify via the `SubjectConfirmationDialog`, which guides them through re-establishing their proof (re-adding the DNS TXT record, re-hosting the did.json, etc.). If re-verification succeeds, the subject is re-attached to the account.

This pruning ensures that stored subjects do not become stale. A user who removes their DNS TXT record or revokes a key binding will have the corresponding subject removed from their account the next time a live check runs against it.

**When live checks run:**

- at attestation submission time (Gate 2 in the submission flow)
- when the backend processes a subject-scoped relay submission (`POST /api/private/relay/eas/delegated-attest`)

Live checks do not run on page load, session restore, or account page views. The `/account` page displays stored subjects as-is. Pruning only happens when a submission triggers a live check.

See `docs.omatrust.org` for key-binding proof formats and controller-witness attestation details.

See `app-registry-frontend` for its implementation of `did:web` ownership checking.

### Future direction: subjects as derived state

Long-term, stored subjects should be an index derived from on-chain attestations (key bindings, controller-witness attestations, linked identifiers) rather than user-managed state. When a key-binding attestation is filed, the backend indexes it. When a DNS TXT record is verified, the backend records the verification but treats it as ephemeral. The `/account` page would show subjects derived from the latest on-chain and DNS state, not from a mutable database table. This is not V1 scope but informs the direction of the pruning behavior described above.

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
- The frontend calls `GET /api/private/relay/eas/nonce` for subscription-path attestations so it can construct the delegated payload to sign
- the relay nonce lookup is a premium metered read and should be served by `omatrust-backend`, not by direct browser access to the premium RPC origin
- the backend's `delegated-attest` endpoint still re-fetches the authoritative nonce internally before verifying and submitting
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
- a single wallet management control in that same card via the Thirdweb connect button (with disconnect hidden — users use the explicit Log Out button)
- a `Subject Identifier` card between the `Name` and `Wallet` cards, with a loading state to prevent the "Add Subject" CTA from flashing before data loads
- if the only subject is the wallet DID itself, the page hides it and treats the account as missing a meaningful subject identifier
- in that empty state, the page prompts the user to add a subject identifier with the CTA copy `Add your Subject Identifier.`
- clicking that CTA opens a subject confirmation modal
- the subject confirmation modal includes:
  - a DID method picker
  - method-specific ownership instructions
  - a verification action
  - a submit action
- the name card is labeled `Name` and includes an inline edit button that toggles to a text field with Save/Cancel
- an explicit `Log Out` button is shown on the account page — it revokes the backend session, disconnects the wallet, cleans up browser state, and does a full page navigation to `/`
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
- `AttestationForm` Gate 2: live subject verification call before submission, with `SubjectConfirmationDialog` fallback on failure
- `AttestationForm` subject field pre-population from session's `primarySubject`
- backend subject pruning: remove stored subject when live verification fails at submission time
- backend live verification should check all proof sources: DNS TXT, did.json, key bindings, controller-witness attestations, linked identifiers
- `SubjectConfirmationDialog` pre-population via `subjectHint` prop when opened from `AttestationForm`
- custom JSON-RPC transport for premium RPC
- Premium RPC fallback to public RPC on failure

---

## Acceptance criteria

- [x] All new attestation submissions require account creation or sign-in
- [x] Every wallet creates or loads a backend account and session before attestation submission
- [x] Wallet first sign-in establishes a persisted wallet-scoped `executionMode`
- [x] Managed wallets (`inApp`) can submit any attestation through the backend relay without holding OMA
- [x] Every relay submission decrements one sponsored write credit regardless of schema
- [x] Free-tier users can submit any schema until their write credits are exhausted
- [x] Wallets in `native` execution mode keep the current frontend behavior: subsidized delegated-attest for the two subsidized schemas and direct transaction for all other schemas
- [x] Wallets in `subscription` execution mode always use the backend relay path
- [x] Managed wallets (`inApp`) are constrained to `subscription` execution mode
- [x] Wallets in `subscription` execution mode with exhausted entitlement are routed to upgrade, not per-submission fallback
- [x] Subject ownership verification exists with manual retry and backend enforcement
- [x] Subject ownership is re-checked authoritatively by the backend when a subject is attached to the account
- [x] Unauthenticated subject-scoped submission stays in one funnel: auth -> subject setup -> submission
- [ ] Signed-in subject-scoped submission runs live verification against the form's subject before submission
- [ ] Failed live verification prunes the stale subject from the account and opens SubjectConfirmationDialog for re-verification
- [ ] Subject field is pre-populated from session's primary subject when signed in
- [x] Account page shows plan, usage, and upgrade option
- [x] Backend session cookies are included on all backend requests
- [x] Premium RPC credentials are never exposed to the browser
- [ ] Premium RPC failures fall back to public RPC transparently
- [x] Landing page attestation queries continue to use the public RPC endpoint
- [x] The current frontend-hosted delegated-attest path remains functional for self-custody submissions of the two subsidized schemas
- [x] Provider-level `useAutoConnect` replaces per-ConnectButton autoConnect
- [x] Auth dialog uses `useConnectModal` instead of ConnectButton for wallet connection
- [x] Submit button is always enabled and labeled "Submit Attestation" — gates handle wallet/session state
- [x] Session-exists-but-wallet-disconnected case clears the stale session and routes through auth dialog

---

## Preserved from earlier spec versions

The following details from earlier drafts are retained for reference:

- `ethers.JsonRpcProvider` instances in `src/lib/attestation-queries.ts` and `src/lib/server/eas-routes.ts` are the current direct RPC usage points that will need updating for premium RPC transport
