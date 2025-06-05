import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Address } from 'viem'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract Ethereum address from various DID formats or handle other identifier types.
 * 
 * Supported formats:
 * - DID:PKH: did:pkh:eip155:1:0x742d35Cc6634C0532925a3b844Bc454e4438f44e
 * - DID:ETHR: did:ethr:0x742d35Cc6634C0532925a3b844Bc454e4438f44e
 * - DID:ETHR with network: did:ethr:goerli:0x742d35Cc6634C0532925a3b844Bc454e4438f44e
 * - CAIP-10: eip155:1:0x742d35Cc6634C0532925a3b844Bc454e4438f44e
 * - Raw Ethereum address: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e
 * - Other DIDs: did:web:example.com (returns zero address as placeholder)
 */
export function extractAddressFromDID(didIdentifier: string): Address {
  // DID:PKH format: did:pkh:namespace:chainId:address
  // Example: did:pkh:eip155:1:0x742d35Cc6634C0532925a3b844Bc454e4438f44e
  if (didIdentifier.startsWith('did:pkh:')) {
    const didPart = didIdentifier.replace('did:pkh:', '')
    // Now we have the CAIP-10 part: eip155:1:0x742d35...
    
    if (didPart.startsWith('eip155:')) {
      const parts = didPart.split(':')
      if (parts.length === 3) {
        const address = parts[2]
        if (address.startsWith('0x') && address.length === 42) {
          return address as Address
        }
      }
      throw new Error(`Invalid DID:PKH CAIP-10 format: ${didIdentifier}`)
    } else {
      throw new Error(`Unsupported DID:PKH namespace in: ${didIdentifier}. Only eip155 is supported.`)
    }
  }
  
  // DID:ETHR format: did:ethr:address or did:ethr:network:address
  // Examples: 
  // - did:ethr:0x742d35Cc6634C0532925a3b844Bc454e4438f44e (mainnet)
  // - did:ethr:0x1:0x742d35Cc6634C0532925a3b844Bc454e4438f44e (mainnet with chain ID)
  // - did:ethr:goerli:0x742d35Cc6634C0532925a3b844Bc454e4438f44e (testnet)
  if (didIdentifier.startsWith('did:ethr:')) {
    const didPart = didIdentifier.replace('did:ethr:', '')
    const parts = didPart.split(':')
    
    if (parts.length === 1) {
      // Format: did:ethr:0x123... (address only, assumes mainnet)
      const address = parts[0]
      if (address.startsWith('0x') && address.length === 42) {
        return address as Address
      }
    } else if (parts.length === 2) {
      // Format: did:ethr:network:0x123... (network + address)
      const address = parts[1]
      if (address.startsWith('0x') && address.length === 42) {
        return address as Address
      }
    }
    
    throw new Error(`Invalid DID:ETHR format: ${didIdentifier}. Expected did:ethr:0x... or did:ethr:network:0x...`)
  }
  
  // For direct CAIP-10 addresses (legacy support)
  if (didIdentifier.startsWith('eip155:')) {
    const parts = didIdentifier.split(':')
    if (parts.length === 3) {
      const address = parts[2]
      if (address.startsWith('0x') && address.length === 42) {
        return address as Address
      }
    }
    throw new Error(`Invalid CAIP-10 address format: ${didIdentifier}`)
  }
  
  // If it's already an Ethereum address, use it directly
  if (didIdentifier.startsWith('0x') && didIdentifier.length === 42) {
    return didIdentifier as Address
  }
  
  // For other DID methods (did:web, etc.), use zero address as placeholder
  // The actual identifier will be stored in the attestation data
  if (didIdentifier.startsWith('did:')) {
    // Use zero address as placeholder - the real DID is in the attestation data
    console.warn(`Non-Ethereum DID identifier "${didIdentifier}" - using zero address as placeholder in contract`)
    return '0x0000000000000000000000000000000000000000' as Address
  }
  
  throw new Error(`Unsupported identifier format: ${didIdentifier}. Please use DID:PKH (did:pkh:eip155:...), DID:ETHR (did:ethr:0x...), other DID format (did:web:...), or Ethereum address (0x...)`)
}
