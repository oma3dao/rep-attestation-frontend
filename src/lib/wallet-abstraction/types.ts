export interface WalletUser {
  address?: string
  email?: string
  name?: string
  profileImage?: string
  provider?: string
}

export interface ChainInfo {
  name: string
  symbol: string
  logo: string
  rpcUrl: string
  blockExplorer: string
  nativeToken: string
  environment: 'mainnet' | 'testnet'
}

export interface WalletProvider {
  // Core functionality
  connect(): Promise<void>
  disconnect(): Promise<void>
  
  // State
  isConnected(): boolean
  getUser(): Promise<WalletUser | null>
  getAddress(): Promise<string | null>
  getProvider(): any // Raw provider for specific integrations
  
  // Chain management
  getCurrentChain(): Promise<string | null>
  switchChain(chainId: string): Promise<void>
  getSupportedChains(): string[]
  getChainInfo(chainId: string | null): ChainInfo
  
  // Optional advanced features
  signMessage?(message: string): Promise<string>
  sendTransaction?(transaction: any): Promise<string>
}

export interface WalletConfig {
  // Provider selection
  provider: 'web3auth'
  
  // Common config
  appName: string
  logo?: string
  theme?: {
    primary: string
    mode?: 'light' | 'dark' | 'auto'
  }
  
  // Provider-specific config
  web3auth?: {
    clientIdDevnet: string
    clientIdMainnet: string
    environment: 'devnet' | 'mainnet'
    walletConnectProjectId: string
  }
}

export type WalletProviderType = 'web3auth'

export interface WalletContextType {
  // State
  isConnected: boolean
  user: WalletUser | null
  address: string | null
  currentChain: string | null
  supportedChains: string[]
  
  // Actions
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  switchChain: (chainId: string) => Promise<void>
  
  // Utilities
  getChainInfo: (chainId: string | null) => ChainInfo
  getProvider: () => any
  
  // Loading states
  isConnecting: boolean
  isSwitchingChain: boolean
}