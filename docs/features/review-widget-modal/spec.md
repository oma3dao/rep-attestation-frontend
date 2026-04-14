# Review Widget Modal — Spec

Status: Implemented

## Goal

Allow users of the reputation frontend to submit reviews for `reputation.omatrust.org` via the embedded OMATrust review widget, using the host page's existing Thirdweb wallet session for signing.

## Protocol reference

The postMessage signing protocol is defined in:

→ [omatrust-sdk/docs/features/widget-signing-bridge/spec.md](https://github.com/oma3dao/omatrust-sdk/blob/main/docs/features/widget-signing-bridge/spec.md)

## Components

### Review button

- Located in the site header
- Visible when a wallet is connected (`useActiveAccount()`)
- Opens the review widget modal on click

### Modal (`ReviewWidgetModal`)

- Radix dialog with transparent background (widget provides its own card styling)
- Iframe loads the widget from `NEXT_PUBLIC_WIDGET_BASE_URL` (defaults to `https://reputation.omatrust.org`)
- Connected wallet address injected into iframe URL via `&wallet=` param

### Signing bridge

- Uses `createSigningBridge` from `@oma3/omatrust/widgets`
- `signTypedData` callback uses `ethers6Adapter.signer.toEthers()` from Thirdweb
- `devOriginOverride` set from `NEXT_PUBLIC_WIDGET_BASE_URL` for local dev
- Bridge created in `useEffect` when modal opens, destroyed on close
- Trust policy fetched automatically by the SDK

### Close handling

- Listens for `omatrust:close` postMessage from widget
- Closes the modal dialog

## Widget configuration

| Param      | Value                                              |
|------------|----------------------------------------------------|
| `url`      | `reputation.omatrust.org`                          |
| `contract` | `0x8835AF90f1537777F52E482C8630cE4e947eCa32` (EAS) |
| `chainId`  | `66238` (OMAchain Testnet)                         |
| `name`     | `OMATrust Reputation Portal`                       |
| `explorer` | `https://explorer.testnet.chain.oma3.org/api`      |

## Environment variables

| Variable                       | Description                                    |
|--------------------------------|------------------------------------------------|
| `NEXT_PUBLIC_WIDGET_BASE_URL`  | Widget origin. Defaults to production. Set to `http://localhost:3000` for local dev. |

## Acceptance Criteria

- [ ] Review button visible in header when wallet is connected
- [ ] Review button hidden when no wallet connected
- [ ] Clicking Review opens modal with widget iframe
- [ ] Widget receives connected wallet address via query param
- [ ] Signing bridge created via SDK on modal open
- [ ] Bridge destroyed on modal close
- [ ] Widget handshake succeeds (integrated mode detected)
- [ ] Signing request forwarded to Thirdweb wallet
- [ ] Signature returned to widget via postMessage
- [ ] `omatrust:close` message closes the modal
- [ ] Clicking outside the modal closes it
- [ ] Bridge creation failure logged to console
- [ ] Works with Thirdweb social login wallets (no second wallet prompt)

## Edge Cases

- Modal opened before iframe loads → bridge responds to handshake retries
- User disconnects wallet while modal is open → bridge creation guard prevents crash
- Trust policy fetch fails → bridge creation fails, error logged
- User submits review then reopens modal → fresh iframe, new bridge
