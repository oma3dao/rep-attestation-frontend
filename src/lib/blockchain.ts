import { useActiveAccount, useActiveWalletChain } from 'thirdweb/react'
import { defineChain } from 'thirdweb/chains'
import { omachainTestnet, omachainMainnet, bscTestnet, bscMainnet, sepolia, mainnet, baseSepolia, base } from '@/config/chains'

/**
 * Get active chain from environment variable
 * This is the authoritative chain - NOT determined by user's wallet
 */
export function getActiveChain() {
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
 * Get active chain as Thirdweb chain object
 * Required for Thirdweb's ethers adapter
 */
export function getActiveThirdwebChain() {
  const chain = getActiveChain()
  return defineChain({
    id: chain.id,
    rpc: chain.rpc,
    name: chain.name,
    nativeCurrency: chain.nativeCurrency,
    blockExplorers: chain.blockExplorers,
  })
}

/**
 * Pure ThirdWeb wallet integration
 * Provides wallet state and chain information using ThirdWeb hooks
 * 
 * IMPORTANT: Chain is determined by NEXT_PUBLIC_ACTIVE_CHAIN environment variable,
 * NOT by the user's wallet. The wallet is only used for identity and signing.
 */
export function useWallet() {
  const account = useActiveAccount()
  const walletChain = useActiveWalletChain()
  
  // Always use environment-determined chain
  const activeChain = getActiveChain()
  
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
  
  // Use environment chain (not wallet chain)
  const chainId = activeChain.id
  
  return {
    // Wallet connection state
    isConnected: !!account,
    address: account?.address || null,
    
    // Chain state (environment-determined)
    chainId,
    chain: activeChain,
    isChainSupported: isAttestationChain(chainId),
    isAttestationSupported: isAttestationChain(chainId),
    
    // Wallet's actual chain (for informational purposes only)
    walletChainId: walletChain?.id,
    
    // Account object
    account,
    
    // Utilities
    supportedChainIds: [omachainTestnet.id, omachainMainnet.id, bscTestnet.id, bscMainnet.id, sepolia.id, mainnet.id, baseSepolia.id, base.id]
  }
} 