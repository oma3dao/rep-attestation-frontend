'use client'

import { type Web3AuthContextConfig } from '@web3auth/modal/react'
import { WEB3AUTH_NETWORK, type Web3AuthOptions } from '@web3auth/modal'

// Web3Auth Environment Configuration
const WEB3AUTH_ENV = process.env.NEXT_PUBLIC_WEB3AUTH_ENV === 'mainnet' ? 'mainnet' : 'devnet'

// Web3Auth Configuration
const WEB3AUTH_CONFIG = {
  CLIENT_ID: WEB3AUTH_ENV === 'mainnet'
    ? process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID_MAINNET 
    : process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID_DEVNET,
  
  NETWORK: WEB3AUTH_ENV === 'mainnet' ? 'SAPPHIRE_MAINNET' : 'SAPPHIRE_DEVNET',
  WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
}

// Validation
if (!WEB3AUTH_CONFIG.CLIENT_ID) {
  const requiredVar = WEB3AUTH_ENV === 'mainnet'
    ? 'NEXT_PUBLIC_WEB3AUTH_CLIENT_ID_MAINNET' 
    : 'NEXT_PUBLIC_WEB3AUTH_CLIENT_ID_DEVNET'
  throw new Error(`${requiredVar} is not set`)
}

if (!WEB3AUTH_CONFIG.WALLETCONNECT_PROJECT_ID) {
  throw new Error('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set')
}

// Blockchain Network Configuration (separate from Web3Auth environment)
const BLOCKCHAIN_ENV = 'testnet' // For now, default to testnet

// All available chains
const ALL_CHAINS = {
  // Ethereum chains
  '0x1': { 
    name: 'Ethereum Mainnet', 
    symbol: '🟢', 
    logo: '🔵',
    rpcUrl: 'https://mainnet.infura.io/v3/',
    blockExplorer: 'https://etherscan.io',
    nativeToken: 'ETH',
    environment: 'mainnet'
  },
  '0xaa36a7': { 
    name: 'Sepolia', 
    symbol: '🟡', 
    logo: '🔵',
    rpcUrl: 'https://sepolia.infura.io/v3/',
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeToken: 'ETH',
    environment: 'testnet'
  },
  
  // BSC chains
  '0x38': { 
    name: 'BSC Mainnet', 
    symbol: '🟢', 
    logo: '🟡',
    rpcUrl: 'https://bsc-dataseed.binance.org/',
    blockExplorer: 'https://bscscan.com',
    nativeToken: 'BNB',
    environment: 'mainnet'
  },
  '0x61': { 
    name: 'BSC Testnet', 
    symbol: '🟡', 
    logo: '🟡',
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    blockExplorer: 'https://testnet.bscscan.com',
    nativeToken: 'tBNB',
    environment: 'testnet'
  },
} as const

// Filter chains based on blockchain environment (testnet vs mainnet)
export const SUPPORTED_CHAINS = Object.fromEntries(
  Object.entries(ALL_CHAINS).filter(([_, chain]) => 
    chain.environment === BLOCKCHAIN_ENV
  )
)

// Web3Auth Options
const web3AuthOptions: Web3AuthOptions = {
  clientId: WEB3AUTH_CONFIG.CLIENT_ID!,
  web3AuthNetwork: WEB3AUTH_NETWORK[WEB3AUTH_CONFIG.NETWORK as keyof typeof WEB3AUTH_NETWORK],
  enableLogging: false,
}

// Helper function to get chain info
export function getChainInfo(chainId: string | null) {
  if (!chainId) return { name: 'No Network', symbol: '⚫', logo: '⚫' }
  
  const knownChain = SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS]
  if (knownChain) {
    return knownChain
  }
  
  // Unknown chain - try to make it human readable
  const decimals = parseInt(chainId, 16)
  return { 
    name: `Chain ${decimals}`, 
    symbol: '🟠', 
    logo: '❓',
    rpcUrl: '',
    blockExplorer: '',
    nativeToken: 'Unknown'
  }
}

// Get list of supported chain IDs
export function getSupportedChainIds(): string[] {
  return Object.keys(SUPPORTED_CHAINS)
}

// Future-ready function to fetch available chains
export async function getAvailableChains(): Promise<string[]> {
  return Promise.resolve(getSupportedChainIds())
}

export const web3AuthContextConfig: Web3AuthContextConfig = {
  web3AuthOptions,
}

// Debug info
console.log('🔧 Web3Auth Configuration:', {
  WEB3AUTH_ENV,
  WEB3AUTH_NETWORK: WEB3AUTH_CONFIG.NETWORK,
  BLOCKCHAIN_ENV,
  SUPPORTED_CHAINS: Object.keys(SUPPORTED_CHAINS),
})

export default web3AuthContextConfig 