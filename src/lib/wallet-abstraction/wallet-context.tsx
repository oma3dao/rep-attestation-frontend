'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { WalletContextType, WalletConfig, WalletProvider, WalletUser, ChainInfo } from './types'
import { Web3AuthWalletProvider } from './providers/web3auth-provider'

const WalletContext = createContext<WalletContextType | undefined>(undefined)

interface WalletProviderProps {
  config: WalletConfig
  children: ReactNode
}

export function WalletContextProvider({ config, children }: WalletProviderProps) {
  const [walletProvider, setWalletProvider] = useState<WalletProvider | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [user, setUser] = useState<WalletUser | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [currentChain, setCurrentChain] = useState<string | null>(null)
  const [supportedChains, setSupportedChains] = useState<string[]>([])
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSwitchingChain, setIsSwitchingChain] = useState(false)

  // Initialize wallet provider based on config
  useEffect(() => {
    const initializeProvider = async () => {
      try {
        let provider: WalletProvider

        switch (config.provider) {
          case 'web3auth':
            if (!config.web3auth) {
              throw new Error('Web3Auth config is required when using web3auth provider')
            }
            provider = new Web3AuthWalletProvider(config.web3auth)
            break
          case 'thirdweb':
            // TODO: Implement ThirdWeb provider
            throw new Error('ThirdWeb provider not implemented yet')
          default:
            throw new Error(`Unsupported wallet provider: ${config.provider}`)
        }

        setWalletProvider(provider)
        setSupportedChains(provider.getSupportedChains())

        // Check if already connected
        if (provider.isConnected()) {
          await updateWalletState(provider)
        }

      } catch (error) {
        console.error('Failed to initialize wallet provider:', error)
      }
    }

    initializeProvider()
  }, [config])

  // Update wallet state
  const updateWalletState = async (provider: WalletProvider) => {
    try {
      const connected = provider.isConnected()
      setIsConnected(connected)

      if (connected) {
        const [userInfo, walletAddress, chain] = await Promise.all([
          provider.getUser(),
          provider.getAddress(),
          provider.getCurrentChain()
        ])
        
        setUser(userInfo)
        setAddress(walletAddress)
        setCurrentChain(chain)
      } else {
        setUser(null)
        setAddress(null)
        setCurrentChain(null)
      }
    } catch (error) {
      console.error('Failed to update wallet state:', error)
    }
  }

  const connect = async () => {
    if (!walletProvider) {
      throw new Error('Wallet provider not initialized')
    }

    setIsConnecting(true)
    try {
      await walletProvider.connect()
      await updateWalletState(walletProvider)
    } catch (error) {
      console.error('Connection error:', error)
      throw error
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    if (!walletProvider) return

    try {
      await walletProvider.disconnect()
      await updateWalletState(walletProvider)
    } catch (error) {
      console.error('Disconnect error:', error)
      throw error
    }
  }

  const switchChain = async (chainId: string) => {
    if (!walletProvider) {
      throw new Error('Wallet provider not initialized')
    }

    setIsSwitchingChain(true)
    try {
      await walletProvider.switchChain(chainId)
      const newChain = await walletProvider.getCurrentChain()
      setCurrentChain(newChain)
    } catch (error) {
      console.error('Chain switch error:', error)
      throw error
    } finally {
      setIsSwitchingChain(false)
    }
  }

  const getChainInfo = (chainId: string | null): ChainInfo => {
    if (!walletProvider) {
      return {
        name: 'No Provider',
        symbol: '⚫',
        logo: '⚫',
        rpcUrl: '',
        blockExplorer: '',
        nativeToken: 'Unknown',
        environment: 'testnet'
      }
    }
    
    return walletProvider.getChainInfo(chainId)
  }

  const getProvider = () => {
    return walletProvider?.getProvider() || null
  }

  const contextValue: WalletContextType = {
    // State
    isConnected,
    user,
    address,
    currentChain,
    supportedChains,
    
    // Actions
    connect,
    disconnect,
    switchChain,
    
    // Utilities
    getChainInfo,
    getProvider,
    
    // Loading states
    isConnecting,
    isSwitchingChain,
  }

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletContextProvider')
  }
  return context
}