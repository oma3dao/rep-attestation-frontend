import { WalletConfig } from './types'

export function createWalletConfig(): WalletConfig {
  // Wallet provider selection
  const walletProvider = process.env.NEXT_PUBLIC_WALLET_PROVIDER || 'web3auth'
  
  // Validate provider
  if (!['web3auth', 'thirdweb'].includes(walletProvider)) {
    console.error(`Invalid wallet provider: ${walletProvider}. Must be 'web3auth' or 'thirdweb'. Falling back to 'web3auth'.`)
  }
  
  const validProvider = ['web3auth', 'thirdweb'].includes(walletProvider) 
    ? walletProvider as 'web3auth' | 'thirdweb'
    : 'web3auth'

  // Environment variables
  const web3authEnv = process.env.NEXT_PUBLIC_WEB3AUTH_ENV === 'mainnet' ? 'mainnet' : 'devnet'
  const web3authClientIdDevnet = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID_DEVNET
  const web3authClientIdMainnet = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID_MAINNET
  const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

  // Validation with helpful error messages
  if (!web3authClientIdDevnet) {
    if (typeof window === 'undefined') {
      // During build time, provide a placeholder
      console.warn('NEXT_PUBLIC_WEB3AUTH_CLIENT_ID_DEVNET is not set - using placeholder for build')
    } else {
      throw new Error('NEXT_PUBLIC_WEB3AUTH_CLIENT_ID_DEVNET is not set. Please add it to your .env.local file.')
    }
  }
  
  if (!web3authClientIdMainnet) {
    if (typeof window === 'undefined') {
      // During build time, provide a placeholder
      console.warn('NEXT_PUBLIC_WEB3AUTH_CLIENT_ID_MAINNET is not set - using placeholder for build')
    } else {
      throw new Error('NEXT_PUBLIC_WEB3AUTH_CLIENT_ID_MAINNET is not set. Please add it to your .env.local file.')
    }
  }

  if (!walletConnectProjectId) {
    if (typeof window === 'undefined') {
      // During build time, provide a placeholder
      console.warn('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set - using placeholder for build')
    } else {
      throw new Error('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. Please add it to your .env.local file.')
    }
  }

  return {
    provider: validProvider,
    appName: 'OMA3 Attestation Portal',
    logo: '/oma3_logo.svg',
    theme: {
      primary: '#3b82f6',
      mode: 'light'
    },
    web3auth: {
      clientIdDevnet: web3authClientIdDevnet || 'placeholder-devnet-id',
      clientIdMainnet: web3authClientIdMainnet || 'placeholder-mainnet-id',
      environment: web3authEnv,
      walletConnectProjectId: walletConnectProjectId || 'placeholder-walletconnect-id'
    }
  }
}

// Debug info (only in browser)
if (typeof window !== 'undefined') {
  const config = createWalletConfig()
  console.log('🔧 Wallet Configuration:', {
    provider: config.provider,
    providerSource: process.env.NEXT_PUBLIC_WALLET_PROVIDER ? 'env' : 'default',
    web3authEnv: config.web3auth?.environment,
    hasDevnetId: !!config.web3auth?.clientIdDevnet && config.web3auth.clientIdDevnet !== 'placeholder-devnet-id',
    hasMainnetId: !!config.web3auth?.clientIdMainnet && config.web3auth.clientIdMainnet !== 'placeholder-mainnet-id',
    hasWalletConnect: !!config.web3auth?.walletConnectProjectId && config.web3auth.walletConnectProjectId !== 'placeholder-walletconnect-id'
  })
}