'use client'

import { type Web3AuthContextConfig } from '@web3auth/modal/react'
import { WEB3AUTH_NETWORK, type Web3AuthOptions } from '@web3auth/modal'

// Get environment variables
const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

if (!clientId) {
  throw new Error('NEXT_PUBLIC_WEB3AUTH_CLIENT_ID is not set')
}

if (!walletConnectProjectId) {
  throw new Error('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set')
}

// Chain information for supported networks
// In Web3Auth v10, you can either configure these via Dashboard OR override here
export const SUPPORTED_CHAINS = {
  '0x1': { 
    name: 'Ethereum Mainnet', 
    symbol: '🟢', 
    logo: '🔵',
    rpcUrl: 'https://mainnet.infura.io/v3/',
    blockExplorer: 'https://etherscan.io',
    nativeToken: 'ETH'
  },
  '0x38': { 
    name: 'BSC Mainnet', 
    symbol: '🟢', 
    logo: '🟡',
    rpcUrl: 'https://bsc-dataseed.binance.org/',
    blockExplorer: 'https://bscscan.com',
    nativeToken: 'BNB'
  },
  '0x61': { 
    name: 'BSC Testnet', 
    symbol: '🟡', 
    logo: '🟡',
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    blockExplorer: 'https://testnet.bscscan.com',
    nativeToken: 'tBNB'
  },
  // '0x89': { 
  //   name: 'Polygon', 
  //   symbol: '🟢', 
  //   logo: '🟣',
  //   rpcUrl: 'https://polygon-rpc.com/',
  //   blockExplorer: 'https://polygonscan.com',
  //   nativeToken: 'POL'
  // },
  // '0xa': { 
  //   name: 'Optimism', 
  //   symbol: '🟢', 
  //   logo: '🔴',
  //   rpcUrl: 'https://mainnet.optimism.io/',
  //   blockExplorer: 'https://optimistic.etherscan.io',
  //   nativeToken: 'ETH'
  // },
  // '0xa4b1': { 
  //   name: 'Arbitrum One', 
  //   symbol: '🟢', 
  //   logo: '🔵',
  //   rpcUrl: 'https://arb1.arbitrum.io/rpc',
  //   blockExplorer: 'https://arbiscan.io',
  //   nativeToken: 'ETH'
  // },
  // '0x2105': { 
  //   name: 'Base', 
  //   symbol: '🟢', 
  //   logo: '🔵',
  //   rpcUrl: 'https://mainnet.base.org/',
  //   blockExplorer: 'https://basescan.org',
  //   nativeToken: 'ETH'
  // },
  '0xaa36a7': { 
    name: 'Sepolia', 
    symbol: '🟡', 
    logo: '🔵',
    rpcUrl: 'https://sepolia.infura.io/v3/',
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeToken: 'ETH'
  },
} as const

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
// Currently returns static config, but could be extended to fetch from Web3Auth Dashboard API
export async function getAvailableChains(): Promise<string[]> {
  // TODO: When Web3Auth exposes a Dashboard API, implement this:
  // try {
  //   const response = await fetch(`https://api.web3auth.io/dashboard/chains?clientId=${clientId}`)
  //   const chains = await response.json()
  //   return chains.map(chain => chain.chainId)
  // } catch (error) {
  //   console.warn('Failed to fetch chains from Dashboard, using static config:', error)
  //   return getSupportedChainIds()
  // }
  
  // For now, return our static configuration
  return Promise.resolve(getSupportedChainIds())
}

const web3AuthOptions: Web3AuthOptions = {
  clientId,
  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
  uiConfig: {
    appName: 'OMA3 Attestation Portal',
    mode: 'auto', // light, dark or auto
    logoLight: '/oma3_logo.svg',
    logoDark: '/oma3_logo.svg',
    defaultLanguage: 'en',
    theme: {
      primary: '#3B82F6', // Blue primary color
    },
  },
}

export const web3AuthContextConfig: Web3AuthContextConfig = {
  web3AuthOptions,
}

export default web3AuthContextConfig 