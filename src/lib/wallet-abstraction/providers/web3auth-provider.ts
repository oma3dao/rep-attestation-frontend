'use client'

import { WalletProvider, WalletUser, ChainInfo, WalletConfig } from '../types'
import { Web3Auth } from '@web3auth/modal'
import { WEB3AUTH_NETWORK } from '@web3auth/modal'

export class Web3AuthWalletProvider implements WalletProvider {
  private web3auth: Web3Auth | null = null
  private config: NonNullable<WalletConfig['web3auth']>
  
  // Chain configuration
  private readonly ALL_CHAINS = {
    // Ethereum chains
    '0x1': { 
      name: 'Ethereum Mainnet', 
      symbol: '🟢', 
      logo: '🔵',
      rpcUrl: 'https://mainnet.infura.io/v3/',
      blockExplorer: 'https://etherscan.io',
      nativeToken: 'ETH',
      environment: 'mainnet' as const
    },
    '0xaa36a7': { 
      name: 'Sepolia', 
      symbol: '🟡', 
      logo: '🔵',
      rpcUrl: 'https://sepolia.infura.io/v3/',
      blockExplorer: 'https://sepolia.etherscan.io',
      nativeToken: 'ETH',
      environment: 'testnet' as const
    },
    
    // BSC chains
    '0x38': { 
      name: 'BSC Mainnet', 
      symbol: '🟢', 
      logo: '🟡',
      rpcUrl: 'https://bsc-dataseed.binance.org/',
      blockExplorer: 'https://bscscan.com',
      nativeToken: 'BNB',
      environment: 'mainnet' as const
    },
    '0x61': { 
      name: 'BSC Testnet', 
      symbol: '🟡', 
      logo: '🟡',
      rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
      blockExplorer: 'https://testnet.bscscan.com',
      nativeToken: 'tBNB',
      environment: 'testnet' as const
    },
  } as const

  constructor(config: WalletConfig['web3auth']) {
    if (!config) {
      throw new Error('Web3Auth config is required')
    }
    this.config = config
  }

  async initialize(): Promise<void> {
    if (this.web3auth) return

    const clientId = this.config.environment === 'mainnet' 
      ? this.config.clientIdMainnet 
      : this.config.clientIdDevnet

    if (!clientId) {
      const requiredVar = this.config.environment === 'mainnet'
        ? 'clientIdMainnet' 
        : 'clientIdDevnet'
      throw new Error(`Web3Auth ${requiredVar} is not configured`)
    }

    const network = this.config.environment === 'mainnet' 
      ? WEB3AUTH_NETWORK.SAPPHIRE_MAINNET 
      : WEB3AUTH_NETWORK.SAPPHIRE_DEVNET

    this.web3auth = new Web3Auth({
      clientId,
      web3AuthNetwork: network,
      enableLogging: false,
    })

    await this.web3auth.init()
  }

  async connect(): Promise<void> {
    await this.initialize()
    if (!this.web3auth) throw new Error('Web3Auth not initialized')
    
    await this.web3auth.connect()
  }

  async disconnect(): Promise<void> {
    if (!this.web3auth) return
    await this.web3auth.logout()
  }

  isConnected(): boolean {
    return this.web3auth?.connected || false
  }

  async getUser(): Promise<WalletUser | null> {
    if (!this.web3auth?.connected) return null
    
    try {
      const userInfo = await this.web3auth.getUserInfo()
      const address = await this.getAddress()
      
      return {
        address: address || undefined,
        email: userInfo.email ? String(userInfo.email) : undefined,
        name: userInfo.name ? String(userInfo.name) : undefined,
        profileImage: userInfo.profileImage ? String(userInfo.profileImage) : undefined,
        provider: 'web3auth'
      }
    } catch (error) {
      console.error('Failed to get user info:', error)
      return null
    }
  }

  async getAddress(): Promise<string | null> {
    if (!this.web3auth?.connected || !this.web3auth.provider) return null
    
    try {
      const accounts = await this.web3auth.provider.request({ 
        method: 'eth_accounts' 
      }) as string[]
      return accounts[0] || null
    } catch (error) {
      console.error('Failed to get address:', error)
      return null
    }
  }

  getProvider(): any {
    return this.web3auth?.provider || null
  }

  async getCurrentChain(): Promise<string | null> {
    if (!this.web3auth?.connected || !this.web3auth.provider) return null
    
    try {
      const chainId = await this.web3auth.provider.request({ 
        method: 'eth_chainId' 
      }) as string
      return chainId
    } catch (error) {
      console.error('Failed to get current chain:', error)
      return null
    }
  }

  async switchChain(chainId: string): Promise<void> {
    if (!this.web3auth?.connected || !this.web3auth.provider) {
      throw new Error('Wallet not connected')
    }

    try {
      await this.web3auth.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      })
    } catch (error: any) {
      // If the chain is not added, try to add it
      if (error.code === 4902) {
        const chainInfo = this.ALL_CHAINS[chainId as keyof typeof this.ALL_CHAINS]
        if (chainInfo) {
          await this.web3auth.provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId,
              chainName: chainInfo.name,
              nativeCurrency: {
                name: chainInfo.nativeToken,
                symbol: chainInfo.nativeToken,
                decimals: 18,
              },
              rpcUrls: [chainInfo.rpcUrl],
              blockExplorerUrls: [chainInfo.blockExplorer],
            }],
          })
        }
      } else {
        throw error
      }
    }
  }

  getSupportedChains(): string[] {
    // For now, return testnet chains only
    const BLOCKCHAIN_ENV = 'testnet'
    return Object.entries(this.ALL_CHAINS)
      .filter(([_, chain]) => chain.environment === BLOCKCHAIN_ENV)
      .map(([chainId]) => chainId)
  }

  getChainInfo(chainId: string | null): ChainInfo {
    if (!chainId) {
      return { 
        name: 'No Network', 
        symbol: '⚫', 
        logo: '⚫',
        rpcUrl: '',
        blockExplorer: '',
        nativeToken: 'Unknown',
        environment: 'testnet'
      }
    }
    
    const knownChain = this.ALL_CHAINS[chainId as keyof typeof this.ALL_CHAINS]
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
      nativeToken: 'Unknown',
      environment: 'testnet'
    }
  }

  async signMessage(message: string): Promise<string> {
    if (!this.web3auth?.connected || !this.web3auth.provider) {
      throw new Error('Wallet not connected')
    }

    const address = await this.getAddress()
    if (!address) throw new Error('No address available')

    const result = await this.web3auth.provider.request({
      method: 'personal_sign',
      params: [message, address],
    })
    
    return String(result)
  }

  async sendTransaction(transaction: any): Promise<string> {
    if (!this.web3auth?.connected || !this.web3auth.provider) {
      throw new Error('Wallet not connected')
    }

    const result = await this.web3auth.provider.request({
      method: 'eth_sendTransaction',
      params: [transaction],
    })
    
    return String(result)
  }
}