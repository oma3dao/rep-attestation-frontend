import { useActiveAccount, useActiveWalletChain } from 'thirdweb/react'
import { omachainTestnet, omachainMainnet, bscTestnet, bscMainnet, sepolia, mainnet } from '@/config/chains'

// Get default chain from environment variable
function getDefaultChain() {
  const activeChain = process.env.NEXT_PUBLIC_ACTIVE_CHAIN
  
  switch (activeChain) {
    case 'omachain-testnet':
      return omachainTestnet
    case 'omachain-mainnet':
      return omachainMainnet
    case 'bsc-testnet':
      return bscTestnet
    case 'bsc-mainnet':
      return bscMainnet
    case 'sepolia':
      return sepolia
    case 'mainnet':
      return mainnet
    default:
      return omachainTestnet // Fallback to OMAchain testnet
  }
}

/**
 * Pure ThirdWeb wallet integration
 * Provides wallet state and chain information using ThirdWeb hooks
 */
export function useWallet() {
  const account = useActiveAccount()
  const chain = useActiveWalletChain()
  
  // Check if current chain is supported by EAS
  const isEASChain = (chainId?: number): boolean => {
    return chainId === omachainTestnet.id || chainId === omachainMainnet.id
  }
  
  // Check if current chain is supported by BAS
  const isBASChain = (chainId?: number): boolean => {
    return chainId === bscTestnet.id || chainId === bscMainnet.id
  }
  
  // Check if current chain supports any attestation service
  const isAttestationChain = (chainId?: number): boolean => {
    return isEASChain(chainId) || isBASChain(chainId)
  }
  
  // Use current chain or default from environment variable
  const defaultChain = getDefaultChain()
  const chainId = chain?.id || defaultChain.id
  
  return {
    // Wallet connection state
    isConnected: !!account,
    address: account?.address || null,
    
    // Chain state  
    chainId,
    isChainSupported: isAttestationChain(chainId),
    isAttestationSupported: isAttestationChain(chainId),
    
    // Account and chain objects
    account,
    chain,
    
    // Utilities
    supportedChainIds: [omachainTestnet.id, omachainMainnet.id, bscTestnet.id, bscMainnet.id, sepolia.id, mainnet.id]
  }
} 