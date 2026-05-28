/**
 * Service URL construction.
 *
 * Derives full service URLs from the active chain and a base domain.
 * The active chain determines the environment prefix:
 *
 *   omachain-mainnet  → no prefix  (e.g., backend.omatrust.org)
 *   omachain-testnet  → preview.   (e.g., preview.backend.omatrust.org)
 *   omachain-devnet   → dev.       (e.g., dev.backend.omatrust.org)
 *   anything else      → preview.   (safe default)
 *
 * If the base domain contains "localhost", "127.0.0.1", or a port,
 * it's treated as a local override and used as-is with http://.
 */

const CHAIN_PREFIX_MAP: Record<string, string> = {
  "omachain-mainnet": "",
  "omachain-testnet": "preview.",
  "omachain-devnet": "dev.",
}

function getActiveChainKey(): string {
  return process.env.NEXT_PUBLIC_ACTIVE_CHAIN ?? "omachain-testnet"
}

function isLocalDomain(domain: string): boolean {
  return (
    domain.includes("localhost") ||
    domain.includes("127.0.0.1") ||
    /:\d+/.test(domain)
  )
}

/**
 * Build a full URL from the active chain and a base domain.
 *
 * @param baseDomain - e.g., "backend.omatrust.org" or "localhost:3001"
 * @returns Full URL, e.g., "https://preview.backend.omatrust.org" or "http://localhost:3001"
 */
export function buildServiceUrl(baseDomain: string): string {
  if (baseDomain.startsWith("http")) return baseDomain.replace(/\/+$/, "")

  if (isLocalDomain(baseDomain)) {
    return `http://${baseDomain}`.replace(/\/+$/, "")
  }

  const chain = getActiveChainKey()
  const prefix = CHAIN_PREFIX_MAP[chain] ?? "preview."
  return `https://${prefix}${baseDomain}`.replace(/\/+$/, "")
}

// ---------------------------------------------------------------------------
// Service-specific URL helpers
// ---------------------------------------------------------------------------

const BACKEND_DOMAIN =
  process.env.NEXT_PUBLIC_OMATRUST_BACKEND_DOMAIN ?? "backend.omatrust.org"

/** OMATrust backend origin (e.g., https://preview.backend.omatrust.org) */
export function getBackendOrigin(): string {
  return buildServiceUrl(BACKEND_DOMAIN)
}
