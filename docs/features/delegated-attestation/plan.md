# Subscription-Gated Attestation — Frontend Plan

Status: Planned

## Scope

Integrate `rep-attestation-frontend` with `omatrust-backend` so that users can submit any attestation without holding OMA. Users pay for a subscription; the backend relay pays gas on their behalf.

This is the primary user-facing change. Premium RPC, nonce routing, and transport details are infrastructure that supports this but is hidden from the user.

## Why

The frontend currently only subsidizes gas for two schemas (`user-review` and `linked-identifier`) via a hardcoded allowlist. All other attestations require the user to hold OMA and pay gas directly. This blocks non-crypto users from using the system.

With `omatrust-backend`, any attestation can be submitted through the relay if the user has an active subscription. The frontend needs to support account creation, subscription management, and routing attestation submissions through the backend relay.

## V1 transport decision

For V1, `rep-attestation-frontend` calls `omatrust-backend` directly for session, subscription, and relay flows.

- browser requests go directly to `backend.omatrust.org` or the matching preview backend origin
- requests use `fetch(..., { credentials: "include" })` for cookie-based session auth
- `omatrust-api-gateway` is not in the request path for these V1 browser flows
- `omatrust-backend` supports credentialed CORS for the allowed frontend origins

## Backend dependency

This feature depends on `omatrust-backend` exposing:

- `POST /api/private/session/wallet/challenge` and `POST /api/private/session/wallet/verify` — SIWE auth
- `GET /api/private/session/me` — session context
- `GET /api/private/subscriptions/current` — subscription status
- `POST /api/private/subscriptions/checkout-session` — Stripe upgrade
- `POST /api/private/subscriptions/stripe-webhook` — payment confirmation
- `POST /api/private/relay/eas/delegated-attest` — subscription-gated attestation submission
- `POST /api/private/rpc-premium` — metered premium RPC proxy (used internally, not user-facing)

## Frontend workstreams

### 0. Design system alignment

Before building new components, align the design token system with the omatrust-landing brand language. The current frontend bypasses its own CSS variable system by hardcoding Tailwind color classes (`bg-blue-600`, `text-gray-600`, `bg-gray-50`). This must be fixed first so every subsequent component uses tokens correctly.

The goal is not to copy the landing page's dark-theme marketing aesthetic. The portal should feel like the same brand but optimized for professional readability on a light background.

Adopt from omatrust-landing:

- token discipline: replace all hardcoded color classes with semantic tokens (`bg-primary`, `text-foreground`, `text-muted-foreground`, `bg-muted`)
- font setup: Inter via CSS variable (`--font-inter`), add JetBrains Mono (`--font-jetbrains-mono`) for wallet addresses, schema UIDs, and technical labels. Register both in tailwind.config.ts.
- typography hierarchy: `tracking-tight` on headings, `leading-relaxed` on body text, `font-mono tracking-widest` for small technical labels
- border radius: bump `--radius` from `0.5rem` to `0.75rem`
- shadcn baseColor: change from `"slate"` to `"neutral"` in components.json (cleaner grays, less blue tint)
- body rendering: add `antialiased` to body class
- global paragraph styling: add `p { @apply leading-relaxed; }` to globals.css

Leave behind (marketing flourishes that don't belong in a portal):

- cyan as primary color — keep a professional, slightly desaturated blue
- glow shadows — look cheap on light backgrounds
- pill-shaped CTA buttons — too casual for a portal
- noise overlays, grid backgrounds, animated gradients
- backdrop blur effects
- billboard heading sizes (`text-7xl`, `text-8xl`)

Cleanup:

- move inline `<style>` tag for ThirdwebConnectButton from header.tsx to globals.css
- add `text-balance` utility to globals.css
- remove all hardcoded `bg-blue-*`, `text-blue-*`, `text-gray-*`, `bg-gray-*`, `bg-black` in favor of token references

Completed:

Design token system aligned with omatrust-landing brand language. All hardcoded Tailwind color classes replaced with semantic tokens. Inter + JetBrains Mono fonts registered via CSS variables. Border radius bumped to 0.75rem. shadcn baseColor changed to neutral. Header redesigned to match landing page navigation style (sticky, scroll blur, active link indicators). ThirdwebConnectButton styles moved from inline to globals.css.

### 1. Sign In / Sign Up and backend session (implemented)

The entry point for all authenticated flows.

- header shows "Sign In" button when unauthenticated. When authenticated, the button shows the display name of the account and links to `/account`
- Unauthenticated Sign In button opens an auth chooser modal with two options: "Existing account" (sign in) and "New account" (create account)
- the auth dialog uses `useConnectModal` to open the Thirdweb wallet picker — no `ConnectButton` is rendered inside the dialog
- `ConnectButton` is used only on the `/account` page for the "Manage Wallet" control (with disconnect hidden)
- SIWE challenge/verify flow uses an imperative async function (`performChallengeSignVerify`) triggered by button click, not React effects
- wallet provider detected via `useActiveWallet().id` and sent as `walletProviderId` to backend on verify
- provider-level `useAutoConnect` handles wallet restoration on app mount; individual components do not manage autoConnect
- session check runs exactly once after autoConnect finishes; skips the `session/me` call entirely if no wallet was restored
- auto-disconnect effect removed from `BackendSessionProvider`
- auth dialog closes automatically on page navigation via pathname change detection
- `?action=signin` query parameter from the landing page opens the auth modal automatically
- wallet connection is delayed until the user initiates sign-in, not on page load
- after sign-in: existing account → navigates to `/dashboard`, new account → navigates to `/account`, submission flow → shows success message, user clicks submit again
- logout uses `window.location.href` for full page unload, ensuring clean wallet state teardown
- `clearWalletBrowserState()` utility cleans up WalletConnect IndexedDB and Thirdweb localStorage on logout and before new wallet connections

### 2. Subscription and payment

Once signed in, the user needs a way to see their plan and upgrade.

- `/account` page implemented with:
  - `Name`
  - `Subject Identifier`
  - combined wallet card with wallet DID, wallet type, Thirdweb "Manage Wallet" button, and explicit `Log Out`
  - subscription plan/status, reads left, writes left, renewal timing, and upgrade CTA
- `/account` page redirects to `/` when session is lost (wallet disconnect, session expiry)
- header links to `/account` when signed in
- account page subject flow implemented:
  - hides the bootstrap wallet subject when it is the only subject
  - prompts the user to add a meaningful subject identifier
  - opens subject confirmation modal with DID picker, proof instructions, verification, and submit
- startup session restore implemented globally via `GET /api/private/session/me`
- explicit logout implemented by revoking backend session and disconnecting the wallet
- upgrade flow (Stripe checkout) not yet implemented end-to-end

### 3. Subscription-execution delegated attestation

The core feature. Route wallets in `subscription` execution mode through the backend relay.

- for wallets in `subscription` execution mode: fetch the signable EAS nonce via `GET /api/private/relay/eas/nonce?attester=0x...`
- treat the relay nonce lookup as a premium metered read; it should go through `omatrust-backend`, not directly to the public RPC endpoint
- for wallets in `subscription` execution mode: submit attestations via `POST /api/private/relay/eas/delegated-attest`
- the frontend uses the returned nonce to construct the delegated payload for signing; the backend delegated-attest endpoint still re-fetches the authoritative nonce internally before verifying and submitting
- the backend verifies the signature, checks subscription entitlement, checks schema eligibility, and submits the transaction
- handle backend error codes in the UI: `SPONSORED_WRITE_LIMIT_EXCEEDED`, `SCHEMA_NOT_ELIGIBLE`, `SUBSCRIPTION_INACTIVE`, `ATTESTER_MISMATCH`
- when a wallet in `subscription` execution mode has no usable entitlement, route the user to upgrade rather than falling back per submission
- for wallets in `native` execution mode: continue using the current frontend execution behavior outside the backend relay path

### 4. Wallet provider and execution-mode routing

How the frontend decides which execution path to use.

- `walletProviderId` remains the raw technical field from Thirdweb
- `walletProviderId === "inApp"`: constrain the wallet to `subscription` execution mode
- other wallets: allow either `subscription` or `native` execution mode
- persist `executionMode` on the wallet at first sign-in and read it from session context on later visits
- use a single wallet picker with all supported wallets; route after connection based on persisted `executionMode`

### 5. Current `native` flow coexistence

The current frontend-hosted delegated-attest server continues to handle `user-review` and `linked-identifier` schemas for wallets in `native` execution mode during V1.

- keep the current frontend code path for those two schemas when `executionMode === "native"`
- use the backend relay for all schemas when `executionMode === "subscription"`
- use the current direct transaction path for non-subsidized schemas when `executionMode === "native"`
- no proxy from the backend to the current frontend-hosted delegated-attest server

#### Chain switching for `native` direct transactions

The `ConnectButton` does not force the wallet onto OMAChain at connect time. This is intentional — the `chain` (singular) prop triggers `wallet_switchEthereumChain` through WalletConnect, which sends the chain ID in CAIP-2 format (`eip155:66238`). MetaMask rejects this for custom chains it doesn't recognize. See [issue #38](https://github.com/oma3dao/rep-attestation-frontend/issues/38).

Instead, chain switching must happen just before a direct on-chain transaction, using raw EIP-1193 provider calls with hex chain IDs. `app-registry-frontend` already implements this pattern in `src/lib/contracts/chain-guard.ts`:

1. Check if the wallet is already on the correct chain — if so, skip
2. Call `wallet_switchEthereumChain` with hex chain ID (`0x102be` for 66238)
3. If MetaMask returns error 4902 (chain unknown), call `wallet_addEthereumChain` to add OMAChain with its name, RPC, native currency, and explorer, then switch
4. If provider-level switching isn't available (managed wallets), fall back and let Thirdweb handle it internally

Copy `chain-guard.ts` from `app-registry-frontend` and call `ensureWalletOnEnvChain(account)` before `sendTransaction` in the direct attestation path (`createDirectAttestation` in `src/lib/eas.ts`). This is not needed for delegated attestations (EIP-712 signing) or SIWE signing — only for transactions where the user's wallet pays gas.

### 6. Premium RPC transport (internal)

Hidden from the user. The backend uses the premium RPC endpoint for relay-adjacent reads.

- the backend relay handles nonce lookups internally via premium RPC
- V1 attestation queries on the landing page use the public RPC endpoint
- premium read routing for attestation queries is deferred until a user dashboard is built
- `POST /api/private/rpc-premium` is available for future premium reads but not used in V1 landing page flows
- when premium read entitlement is exhausted, fall back to public RPC where appropriate

Transport note: `ethers.JsonRpcProvider` against the backend URL is not sufficient for cookie-based auth. Use a custom fetch-based JSON-RPC transport with `credentials: "include"` when calling backend RPC endpoints.

## Session initialization timing

See the spec for the full session initialization flow, wallet type gating, and signing UX details.

## Subject ownership note

Subject verification has two entry points:

- **Unauthenticated submission of a subject-scoped schema**: the auth dialog handles account creation and then branches into an inline subject-setup step. After sign-in and subject setup, the dialog shows a success message and the user closes it to click submit again (Flow B in the spec).
- **Signed-in submission of a subject-scoped schema without a verified subject**: Gate 2 in the submission flow runs a live verification check. If it fails, `AttestationForm` opens the `SubjectConfirmationDialog` (the same component used on `/account`) for re-verification.

`/account` remains the general management surface for adding, viewing, and re-verifying subjects outside of the submission flow.

## Unauthenticated user experience

See the spec for unauthenticated user behavior and the Sign In / Sign Up distinction.

## Out of scope

- replacing the public RPC endpoint
- redesigning the attestation query SDK
- migrating the current frontend-hosted delegated-attest server functionality
- user dashboard with premium read features
