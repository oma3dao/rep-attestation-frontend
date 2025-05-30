// Blockchain network configurations
export interface ChainConfig {
  id: number
  name: string
  shortName: string
  rpcUrl: string
  blockExplorer: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  testnet: boolean
}

// Chain definitions
export const BSC_TESTNET: ChainConfig = {
  id: 97,
  name: 'BNB Smart Chain Testnet',
  shortName: 'BSC Testnet',
  rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545',
  blockExplorer: 'https://testnet.bscscan.com',
  nativeCurrency: {
    name: 'Test BNB',
    symbol: 'tBNB',
    decimals: 18
  },
  testnet: true
}

export const BSC_MAINNET: ChainConfig = {
  id: 56,
  name: 'BNB Smart Chain',
  shortName: 'BSC',
  rpcUrl: 'https://bsc-dataseed1.binance.org',
  blockExplorer: 'https://bscscan.com',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18
  },
  testnet: false
}

export const ETHEREUM_MAINNET: ChainConfig = {
  id: 1,
  name: 'Ethereum',
  shortName: 'ETH',
  rpcUrl: 'https://ethereum-rpc.publicnode.com',
  blockExplorer: 'https://etherscan.io',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18
  },
  testnet: false
}

export const SEPOLIA_TESTNET: ChainConfig = {
  id: 11155111,
  name: 'Sepolia',
  shortName: 'Sepolia',
  rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
  blockExplorer: 'https://sepolia.etherscan.io',
  nativeCurrency: {
    name: 'Sepolia Ether',
    symbol: 'SEP',
    decimals: 18
  },
  testnet: true
}

// All available chains
export const ALL_CHAINS: Record<number, ChainConfig> = {
  [BSC_TESTNET.id]: BSC_TESTNET,
  [BSC_MAINNET.id]: BSC_MAINNET,
  [ETHEREUM_MAINNET.id]: ETHEREUM_MAINNET,
  [SEPOLIA_TESTNET.id]: SEPOLIA_TESTNET
}

// Helper functions
export function getChain(chainId: number): ChainConfig | undefined {
  return ALL_CHAINS[chainId]
}

export function getTestnetChains(): ChainConfig[] {
  return Object.values(ALL_CHAINS).filter(chain => chain.testnet)
}

export function getMainnetChains(): ChainConfig[] {
  return Object.values(ALL_CHAINS).filter(chain => !chain.testnet)
}

export function getAllChainIds(): number[] {
  return Object.keys(ALL_CHAINS).map(Number)
} 