import { useActiveAccount, useActiveWalletChain } from 'thirdweb/react'
import { bsc, bscTestnet, sepolia, mainnet } from 'thirdweb/chains'

/**
 * Pure ThirdWeb wallet integration
 * Provides wallet state and chain information using ThirdWeb hooks
 */
export function useWallet() {
  const account = useActiveAccount()
  const chain = useActiveWalletChain()
  
  // Check if current chain is supported by BAS
  const isBASChain = (chainId?: number): boolean => {
    return chainId === bscTestnet.id || chainId === bsc.id
  }
  
  // Check if current chain supports any attestation service
  const isAttestationChain = (chainId?: number): boolean => {
    // Currently only BAS chains support attestations
    return isBASChain(chainId)
  }
  
  // Use current chain or default to BSC testnet
  const chainId = chain?.id || bscTestnet.id
  
  return {
    // Wallet connection state
    isConnected: !!account,
    address: account?.address || null,
    
    // Chain state  
    chainId,
    isChainSupported: isBASChain(chainId),
    isAttestationSupported: isAttestationChain(chainId),
    
    // Account and chain objects
    account,
    chain,
    
    // Utilities
    supportedChainIds: [bscTestnet.id, bsc.id, sepolia.id, mainnet.id]
  }
} 