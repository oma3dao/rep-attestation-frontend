'use client'

import { useSwitchChain } from "@web3auth/modal/react"
import { useWeb3Auth } from "@web3auth/modal/react"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { useState, useEffect } from "react"
import { getChainInfo, getAvailableChains } from "@/lib/web3auth"

export function ChainSwitcher() {
  const { switchChain } = useSwitchChain()
  const { isConnected, provider } = useWeb3Auth()
  const [currentChain, setCurrentChain] = useState<string | null>(null)
  const [availableChains, setAvailableChains] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Detect current network and get available chains
  useEffect(() => {
    const detectNetworks = async () => {
      if (isConnected && provider) {
        try {
          // Get current chain
          const currentNetwork = await provider.request({ method: 'eth_chainId' }) as string
          console.log('Detected wallet network:', currentNetwork)
          setCurrentChain(currentNetwork)

          // Get available chains (future-ready for Dashboard API)
          const chains = await getAvailableChains()
          setAvailableChains(chains)
          
        } catch (error) {
          console.error('Failed to detect networks:', error)
          setCurrentChain(null)
          // Fallback to static chains on error
          const fallbackChains = await getAvailableChains()
          setAvailableChains(fallbackChains)
        }
      } else {
        setCurrentChain(null)
        setAvailableChains([])
      }
    }

    detectNetworks()
  }, [isConnected, provider])

  const handleChainSwitch = async (chainId: string) => {
    if (chainId === currentChain || isLoading) return
    
    setIsLoading(true)
    try {
      await switchChain(chainId)
      setCurrentChain(chainId)
      setIsOpen(false)
    } catch (error) {
      console.error('Failed to switch chain:', error)
      // Re-detect actual network on failure
      if (isConnected && provider) {
        try {
          const currentNetwork = await provider.request({ method: 'eth_chainId' }) as string
          setCurrentChain(currentNetwork)
        } catch (detectError) {
          console.error('Failed to re-detect network:', detectError)
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Don't show if not connected
  if (!isConnected) {
    return null
  }

  const currentChainInfo = getChainInfo(currentChain)

  return (
    <div className="relative">
      <Button 
        variant="outline" 
        className="flex items-center gap-2" 
        disabled={isLoading}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-xs">{currentChainInfo.logo}</span>
        <span className="text-sm">{currentChainInfo.name}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <div className="py-1">
            <div className="px-4 py-2 text-xs text-gray-500 border-b">
              Available Networks ({availableChains.length}):
            </div>
            {availableChains.length === 0 ? (
              <div className="px-4 py-2 text-sm text-gray-500">
                Loading networks...
              </div>
            ) : (
              availableChains.map((chainId) => {
                const chainInfo = getChainInfo(chainId)
                const isCurrentChain = chainId === currentChain
                
                return (
                  <button
                    key={chainId}
                    onClick={() => handleChainSwitch(chainId)}
                    disabled={isLoading || isCurrentChain}
                    className={`flex items-center gap-3 w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                      isCurrentChain ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    } ${(isLoading || isCurrentChain) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="text-lg">{chainInfo.logo}</span>
                    <div className="flex-1 text-left">
                      <div className="font-medium">{chainInfo.name}</div>
                      <div className="text-xs text-gray-500">
                        {chainInfo.nativeToken} • ID: {chainId}
                      </div>
                    </div>
                    {isCurrentChain && <span className="text-xs">✓</span>}
                  </button>
                )
              })
            )}
            <div className="px-4 py-2 text-xs text-gray-400 border-t">
              💡 Configure chains in Web3Auth Dashboard
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 