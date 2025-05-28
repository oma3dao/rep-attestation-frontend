export interface WalletUser {
  address?: string
  email?: string
  name?: string
  profileImage?: string
  provider?: string
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
  
  // Optional advanced features
  switchNetwork?(chainId: string): Promise<void>
  signMessage?(message: string): Promise<string>
  sendTransaction?(transaction: any): Promise<string>
}

export interface WalletConfig {
  // Provider selection
  provider: 'web3auth' | 'reown' | 'thirdweb'
  
  // Common config
  appName: string
  logo?: string
  theme?: {
    primary: string
    mode?: 'light' | 'dark' | 'auto'
  }
  
  // Provider-specific config
  web3auth?: {
    clientId: string
    network: 'sapphire_mainnet' | 'sapphire_devnet'
  }
  
  reown?: {
    projectId: string
    metadata: {
      name: string
      description: string
      url: string
      icons: string[]
    }
  }
  
  thirdweb?: {
    clientId: string
    appMetadata?: {
      name: string
      url: string
      description: string
      logoUrl: string
    }
  }
}

export type WalletProviderType = 'web3auth' | 'reown' | 'thirdweb' 