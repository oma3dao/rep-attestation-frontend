'use client'

import { useSwitchChain } from "@web3auth/modal/react"
import { useWeb3Auth } from "@web3auth/modal/react"
import { chainConfigs } from "@/lib/web3auth"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { useState, useEffect } from "react"

// Simple dropdown without shadcn for now to avoid import issues
export function ChainSwitcher() {
  const { switchChain } = useSwitchChain()
  const { isConnected, provider } = useWeb3Auth()
  const [currentChain, setCurrentChain] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Detect user's current network after connection
  useEffect(() => {
    const detectCurrentNetwork = async () => {
      if (isConnected && provider) {
        try {
          const currentNetwork = await provider.request({ method: 'eth_chainId' })
          console.log('Detected wallet network:', currentNetwork)
          
          // Find matching chain in our supported configs
          const matchingChain = Object.entries(chainConfigs).find(
            ([, config]) => config.chainId === currentNetwork
          )
          
          if (matchingChain) {
            console.log('Network supported:', matchingChain[0])
            setCurrentChain(matchingChain[0])
          } else {
            console.log('Network not in our supported list:', currentNetwork)
            setCurrentChain('unsupported')
          }
        } catch (error) {
          console.error('Failed to detect wallet network:', error)
          setCurrentChain(null)
        }
      } else {
        // Reset when disconnected
        setCurrentChain(null)
      }
    }

    detectCurrentNetwork()
  }, [isConnected, provider])

  const handleChainSwitch = async (chainKey: string) => {
    if (chainKey === currentChain) return
    
    setIsLoading(true)
    try {
      const chainConfig = chainConfigs[chainKey as keyof typeof chainConfigs]
      await switchChain(chainConfig.chainId)
      setCurrentChain(chainKey)
      setIsOpen(false)
    } catch (error) {
      console.error('Failed to switch chain:', error)
      // If switch fails, re-detect the actual network
      if (isConnected && provider) {
        try {
          const currentNetwork = await provider.request({ method: 'eth_chainId' })
          const matchingChain = Object.entries(chainConfigs).find(
            ([, config]) => config.chainId === currentNetwork
          )
          if (matchingChain) {
            setCurrentChain(matchingChain[0])
          }
        } catch (detectError) {
          console.error('Failed to re-detect network:', detectError)
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  const getCurrentChainName = () => {
    if (!currentChain) return 'No Network'
    if (currentChain === 'unsupported') return 'Unsupported Network'
    return chainConfigs[currentChain as keyof typeof chainConfigs]?.displayName || 'Unknown Network'
  }

  const getChainIndicator = () => {
    if (!currentChain) return '⚫' // Gray for no network
    if (currentChain === 'unsupported') return '🟠' // Orange for unsupported
    return '🟢' // Green for supported
  }

  // Don't show chain switcher if not connected
  if (!isConnected) {
    return null
  }

  return (
    <div className="relative">
      <Button 
        variant="outline" 
        className="flex items-center gap-2" 
        disabled={isLoading}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-xs">{getChainIndicator()}</span>
        <span className="text-sm">{getCurrentChainName()}</span>
        <ChevronDown className="h-4 w-4" />
      </Button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <div className="py-1">
            {currentChain === 'unsupported' && (
              <div className="px-4 py-2 text-xs text-orange-600 border-b">
                Current network not supported. Switch to:
              </div>
            )}
            <button
              onClick={() => handleChainSwitch('bsc')}
              className={`flex items-center gap-3 w-full px-4 py-2 text-sm hover:bg-gray-100 ${
                currentChain === 'bsc' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">
                <span className="text-xs font-bold text-white">B</span>
              </div>
              <span>BSC Mainnet</span>
              {currentChain === 'bsc' && <span className="ml-auto text-xs">✓</span>}
            </button>
            <button
              onClick={() => handleChainSwitch('bscTestnet')}
              className={`flex items-center gap-3 w-full px-4 py-2 text-sm hover:bg-gray-100 ${
                currentChain === 'bscTestnet' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center">
                <span className="text-xs font-bold text-white">T</span>
              </div>
              <span>BSC Testnet</span>
              {currentChain === 'bscTestnet' && <span className="ml-auto text-xs">✓</span>}
            </button>
            <button
              onClick={() => handleChainSwitch('oma3L2')}
              className={`flex items-center gap-3 w-full px-4 py-2 text-sm hover:bg-gray-100 ${
                currentChain === 'oma3L2' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-xs font-bold text-white">O</span>
              </div>
              <span>OMA3 L2</span>
              {currentChain === 'oma3L2' && <span className="ml-auto text-xs">✓</span>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
} 