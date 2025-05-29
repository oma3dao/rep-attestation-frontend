'use client'

import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { useState, useEffect } from "react"
import { useWallet } from "@/lib/wallet-abstraction"

export function ChainSwitcher() {
  const { 
    isConnected, 
    currentChain, 
    supportedChains, 
    switchChain, 
    getChainInfo, 
    isSwitchingChain 
  } = useWallet()
  
  const [isOpen, setIsOpen] = useState(false)

  const handleChainSwitch = async (chainId: string) => {
    if (chainId === currentChain || isSwitchingChain) return
    
    try {
      await switchChain(chainId)
      setIsOpen(false)
    } catch (error) {
      console.error('Failed to switch chain:', error)
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
        disabled={isSwitchingChain}
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
              Available Networks ({supportedChains.length}):
            </div>
            {supportedChains.length === 0 ? (
              <div className="px-4 py-2 text-sm text-gray-500">
                Loading networks...
              </div>
            ) :
              supportedChains.map((chainId) => {
                const chainInfo = getChainInfo(chainId)
                const isCurrentChain = chainId === currentChain
                
                return (
                  <button
                    key={chainId}
                    onClick={() => handleChainSwitch(chainId)}
                    disabled={isSwitchingChain || isCurrentChain}
                    className={`flex items-center gap-3 w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                      isCurrentChain ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    } ${(isSwitchingChain || isCurrentChain) ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            }
            <div className="px-4 py-2 text-xs text-gray-400 border-t">
              💡 Configure chains in Web3Auth Dashboard
            </div>
          </div>
        </div>
      )}
    </div>
  )
}