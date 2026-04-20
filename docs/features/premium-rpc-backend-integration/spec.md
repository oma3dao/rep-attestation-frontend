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

## Sign-up wizard flow

The backend session is not established on page load. Account creation and wallet connection are delayed until the user wants to submit an attestation.

When an unauthenticated user clicks to file an attestation, the frontend launches a modal sign-up wizard.

### Wizard steps

**Step 1: Welcome and free tier introduction**

Default messaging:

> Thank you for signing up. We are giving you a limited number of transactions for free. Once those transactions are used up, you can pay for more by upgrading to a paid subscription.

The wizard proceeds to Step 2. The frontend does not ask the user to choose an execution mode up front. Execution mode is established after wallet sign-in, because some wallet types can support only one mode.

**Step 2: Account information**

The user fills out account details before connecting a wallet:

- Display name (optional)
- Subject / organization URL (optional — only needed for subject-scoped attestations, but can be entered here proactively)
- Any other relevant profile information

If the user enters a subject URL, the frontend derives the `did:web` subject for later use in Step 4.

After filling out the form, the user clicks a button to connect their wallet.

**Step 3: Connect wallet and create account**

- Thirdweb wallet picker showing all supported wallet options including social/in-app wallets, MetaMask, WalletConnect, Coinbase Wallet, and other supported self-custody wallets.
- The connected wallet's `walletProviderId` constrains which execution modes are allowed.

After wallet connection:

- Frontend calls `POST /api/private/session/wallet/challenge` then `POST /api/private/session/wallet/verify`
- Backend creates account, wallet, default `did:pkh` subject, free-tier subscription, credential, and session
- `walletProviderId` is sent to the backend (detected from `useActiveWallet().id`)
- Backend returns wallet context via `session/me`, including `walletProviderId` and wallet-scoped `executionMode`
- If the user entered a display name in Step 2, frontend calls `PATCH /api/private/accounts/me` to update it
- For social/in-app wallets: SIWE signature is auto-signed, user sees no pop-up
- For self-custody wallets: user sees a wallet pop-up to sign the SIWE message

Execution-mode rules on first sign-in:

- `inApp` wallets are automatically set to `subscription`
- non-`inApp` wallets choose `subscription` or `native` on first sign-in
- the chosen `executionMode` is persisted on the wallet and reused on later sessions

Every wallet creates or loads a backend account and session here, including wallets that will later use `native` execution mode.

**Step 4: Subject ownership (conditional)**

This step only appears if the selected attestation schema is subject-scoped. See the Subject ownership confirmation section below for the detailed sub-steps.

If the user already entered a subject URL in Step 2, the frontend pre-populates this step.

If the attestation is not subject-scoped (e.g., a simple user review or security assessment), skip to Step 5.

**Step 5: Sign and submit attestation**

- Frontend presents the attestation form (or the user has already filled it out before the wizard launched)
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

- Skip Steps 1–3
- If the attestation is subject-scoped and no verified subject exists, show Step 4
- Otherwise go directly to Step 5, where the submission path is determined by the wallet's persisted `executionMode`

---

## Unauthenticated user experience

Unauthenticated users can:

- browse the landing page and view existing attestations (public RPC, no session needed)
- see Sign In and Sign Up buttons in the navigation

Unauthenticated users cannot:

- submit any attestation
- access subscription, account, or session features

When an unauthenticated user clicks to file an attestation, the sign-up wizard launches.

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

### Subject setup sub-steps (within Step 4 of the wizard)

**4a. Enter organization URL**

- User enters the URL of their organization (e.g., `example.com`)
- Frontend derives the `did:web` subject (e.g., `did:web:example.com`)
- If the user already entered this in Step 2, pre-populate

**4b. Add subject to account**

- Frontend calls `POST /api/private/subjects` with the normalized DID
- Backend creates the subject record with canonical DID and `subjectDidHash`

**4c. Verify ownership**

- Frontend shows instructions for DNS-TXT record or `.well-known/did.json` setup
- For `did:web` subjects: DNS-TXT record challenge or `.well-known/did.json` challenge
- For wallet-based subjects (`did:pkh`, `did:ethr`): signature challenge from the controlling address
- Frontend provides a manual "Verify" retry button (same pattern as `app-registry-frontend`)

**4d. Confirmation**

- Once ownership is verified, the frontend shows confirmation and proceeds to Step 5

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

## Account page

A single `/account` page shows all account information:

- wallet address and provider type
- current plan (free / paid) and status
- subscription usage (sponsored writes used / limit, premium reads used / limit)
- entitlement period dates
- upgrade button (for free-tier users)

Linked from the header/navigation for signed-in users.

---

## Files likely to change

- `src/lib/attestation-queries.ts`
- `src/lib/server/eas-routes.ts`
- `src/lib/eas.ts` (attestation routing logic)
- `src/config/chains.ts`
- `src/components/header.tsx`
- new: sign-up wizard modal component
- new: account page (`/account`)
- new: backend session context provider
- new: custom JSON-RPC transport for premium RPC

---

## Acceptance criteria

- [ ] All new attestation submissions require account creation (sign-up wizard modal)
- [ ] Every wallet creates or loads a backend account and session before attestation submission
- [ ] Wallet first sign-in establishes a persisted wallet-scoped `executionMode`
- [ ] Managed wallets (`inApp`) can submit any attestation through the backend relay without holding OMA
- [ ] Every relay submission decrements one sponsored write credit regardless of schema
- [ ] Free-tier users can submit any schema until their write credits are exhausted
- [ ] Wallets in `native` execution mode keep the current frontend behavior: subsidized delegated-attest for the two subsidized schemas and direct transaction for all other schemas
- [ ] Wallets in `subscription` execution mode always use the backend relay path
- [ ] Managed wallets (`inApp`) are constrained to `subscription` execution mode
- [ ] Wallets in `subscription` execution mode with exhausted entitlement are routed to upgrade, not per-submission fallback
- [ ] Subject-scoped attestations prompt for subject ownership verification with manual retry
- [ ] Subject ownership is re-checked by the backend on each subject-scoped submission (no caching)
- [ ] Account page shows plan, usage, and upgrade option
- [ ] Backend session cookies are included on all backend requests
- [ ] Premium RPC credentials are never exposed to the browser
- [ ] Premium RPC failures fall back to public RPC transparently
- [ ] Landing page attestation queries continue to use the public RPC endpoint
- [ ] The current frontend-hosted delegated-attest path remains functional for self-custody submissions of the two subsidized schemas

---

## Preserved from earlier spec versions

The following details from earlier drafts are retained for reference:

- `ethers.JsonRpcProvider` instances in `src/lib/attestation-queries.ts` and `src/lib/server/eas-routes.ts` are the current direct RPC usage points that will need updating
- the `src/lib/eas.ts` routing logic (`isSubsidizedSchema`) currently decides between delegated and direct paths — this will be extended to include the backend relay path
- the Thirdweb `ConnectButton` in `header.tsx` currently uses inline `<style>` overrides that should be moved to globals.css during the design system alignment workstream
