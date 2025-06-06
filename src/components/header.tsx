"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useActiveAccount, useActiveWallet, useActiveWalletChain, useSwitchActiveWalletChain } from "thirdweb/react"
import React, { useEffect, useState } from "react"
import { client } from "@/app/client"
import { SUPPORTED_CHAINS, DEFAULT_CHAIN } from "@/config/chains"
import { useWallet } from "@/lib/blockchain"

// Lazy load the ThirdwebConnectButton to prevent early wallet access
const ThirdwebConnectButton = React.lazy(() => 
  import("thirdweb/react").then(mod => ({ default: mod.ConnectButton }))
)

export function Header() {
  const pathname = usePathname()
  
  // Primary wallet system (ThirdWeb)
  const account = useActiveAccount()
  const wallet = useActiveWallet()
  const activeChain = useActiveWalletChain()
  const switchChain = useSwitchActiveWalletChain()
  const [showSwitchWarning, setShowSwitchWarning] = useState(false)
  
  // Use config for supported and default chains
  const supportedChains = SUPPORTED_CHAINS
  const defaultChain = DEFAULT_CHAIN

  // Use Wallet logic
  const { isConnected, isChainSupported, chain } = useWallet()

  // Attempt auto-switch for browser wallets on connect
  useEffect(() => {
    // (Optional) If you want to auto-switch for browser wallets, you can add logic here
    // For now, just remove isWalletConnect logic and rely on isChainSupported for warnings
  }, [])

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/attest", label: "Create Attestation" },
    { href: "/dashboard", label: "Dashboard" },
  ]

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center">
              <Image 
                src="/oma3_logo.svg" 
                alt="OMA3 Logo" 
                width={120} 
                height={40} 
                priority
              />
              <span className="ml-2 text-gray-600 text-lg">Attestation Portal</span>
            </Link>

            <nav className="hidden md:flex space-x-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-lg font-medium transition-colors hover:text-blue-600 ${
                    pathname === item.href ? "text-blue-600 border-b-2 border-blue-600 pb-4" : "text-gray-600"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {/* Network mismatch warning using useWallet logic */}
            {isConnected && !isChainSupported && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-orange-100 border border-orange-300 rounded-md">
                <span className="text-orange-800 text-sm font-medium">
                  Wrong Network
                </span>
                <span className="text-orange-600 text-xs">
                  Please disconnect your wallet, switch to {defaultChain.name} in your wallet, and then reconnect.  
                </span>
              </div>
            )}
            <React.Suspense fallback={<button className="bg-blue-600 text-white rounded-md px-4 py-2">Connect Wallet</button>}>
              <ThirdwebConnectButton
                client={client}
                appMetadata={{
                  name: "OMA3 Attestation Portal",
                  url: "https://attestation.oma3.org",
                  description: "Create and manage attestations for the OMA3 ecosystem",
                  logoUrl: "/oma3_logo.svg"
                }}
                autoConnect={{ timeout: 15000 }}
                chains={SUPPORTED_CHAINS}
                connectButton={{
                  style: {
                    backgroundColor: "#3b82f6",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px"
                  }
                }}
                connectModal={{
                  size: "wide",
                  showThirdwebBranding: false
                }}
              />
            </React.Suspense>
          </div>
        </div>
      </div>
    </header>
  )
}