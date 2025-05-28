'use client'

import { type Web3AuthContextConfig } from '@web3auth/modal/react'
import { WEB3AUTH_NETWORK, type Web3AuthOptions, CHAIN_NAMESPACES } from '@web3auth/modal'

// Get environment variables
const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

if (!clientId) {
  throw new Error('NEXT_PUBLIC_WEB3AUTH_CLIENT_ID is not set')
}

if (!walletConnectProjectId) {
  throw new Error('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set')
}

// Default permissive chain config (Ethereum mainnet - most compatible)
const defaultChainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: '0x1', // Ethereum mainnet
  rpcTarget: 'https://eth.llamarpc.com', // Public RPC
  displayName: 'Ethereum Mainnet',
  blockExplorerUrl: 'https://etherscan.io/',
  ticker: 'ETH',
  tickerName: 'Ethereum',
  logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
}

// Define chain configurations for switching
export const chainConfigs = {
  // BSC Mainnet
  bsc: {
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    chainId: '0x38', // 56 in decimal
    rpcTarget: 'https://bsc-dataseed.binance.org/',
    displayName: 'BSC Mainnet',
    blockExplorerUrl: 'https://bscscan.com/',
    ticker: 'BNB',
    tickerName: 'Binance Coin',
    logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png'
  },
  
  // BSC Testnet
  bscTestnet: {
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    chainId: '0x61', // 97 in decimal
    rpcTarget: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    displayName: 'BSC Testnet',
    blockExplorerUrl: 'https://testnet.bscscan.com/',
    ticker: 'tBNB',
    tickerName: 'Test BNB',
    logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png'
  },

  // Your custom OMA3 L2 (placeholder - update with real values)
  oma3L2: {
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    chainId: '0x1', // Replace with your actual L2 chain ID
    rpcTarget: 'https://rpc.your-l2.network', // Replace with your L2 RPC URL
    displayName: 'OMA3 L2',
    blockExplorerUrl: 'https://explorer.your-l2.network', // Replace with your L2 explorer
    ticker: 'ETH',
    tickerName: 'Ethereum',
    logo: '/oma3_logo.svg'
  }
}

const web3AuthOptions: Web3AuthOptions = {
  clientId,
  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
  //web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
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