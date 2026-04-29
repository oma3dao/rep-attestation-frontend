/**
 * Clear browser-side state left behind by wallet providers.
 *
 * Called from two places:
 * - Before opening the wallet picker (no wallet connected, DB connections are closed)
 * - On logout (best-effort — some deletes may be blocked by open connections)
 *
 * Each wallet provider stores session data differently. This function
 * handles cleanup for all known providers so stale data doesn't cause
 * "No matching key" errors or other reconnection issues.
 */
export function clearWalletBrowserState() {
  if (typeof window === "undefined") return

  // WalletConnect v2 — stores relay sessions, pairings, and encryption keys in IndexedDB
  try {
    indexedDB.deleteDatabase("WALLET_CONNECT_V2_INDEXED_DB")
  } catch {
    // May fail if WalletConnect Core has an open connection (e.g., during logout)
  }

  // Thirdweb wallet state in localStorage
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith("thirdweb:") || key.startsWith("wc@2:"))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key))
  } catch {
    // Non-critical
  }

  // Add cleanup for other wallet providers here as needed
  // e.g., Coinbase Wallet SDK, MetaMask state, etc.
}
