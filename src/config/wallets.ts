import {
  createWallet,
  inAppWallet,
  walletConnect,
} from "thirdweb/wallets"

/**
 * Shared wallet configuration.
 *
 * Used by both the provider-level `useAutoConnect` and individual
 * `ConnectButton` instances so the wallet list is defined once.
 */

export const managedWallet = inAppWallet({
  auth: {
    options: [
      "email",
      "google",
      "apple",
      "facebook",
      "passkey",
    ],
  },
})

export const nativeWallets = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  walletConnect(),
]

/** All supported wallets — managed first, then native. */
export const allWallets = [managedWallet, ...nativeWallets]
