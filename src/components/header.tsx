"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useWallet, createWalletConfig } from "@/lib/wallet-abstraction"
import { useActiveAccount } from "thirdweb/react"
import { ConnectButton } from "thirdweb/react"
import { client } from "@/app/client"
import { sepolia, mainnet, bsc, bscTestnet } from "thirdweb/chains"
import { Button } from "@/components/ui/button"
import { ChainSwitcher } from "@/components/chain-switcher"

export function Header() {
  const pathname = usePathname()
  
  // Wallet abstraction state
  const { 
    isConnected: abstractionConnected, 
    user, 
    connect: abstractionConnect, 
    disconnect: abstractionDisconnect, 
    isConnecting: abstractionConnecting 
  } = useWallet()
  
  // ThirdWeb state (just for detecting connection)
  const thirdwebAccount = useActiveAccount()
  
  // Get the current wallet abstraction provider name
  const walletConfig = createWalletConfig()
  const abstractionProviderName = walletConfig.provider === 'web3auth' ? 'Web3Auth' : 'ThirdWeb'

  // Supported chains for ThirdWeb (matching wallet abstraction)
  const supportedChains = [mainnet, sepolia, bsc, bscTestnet]

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/attest", label: "Create Attestation" },
    { href: "/dashboard", label: "Dashboard" },
  ]

  // Determine which wallet is active
  const activeWallet = abstractionConnected ? 'abstraction' : 
                      thirdwebAccount ? 'thirdweb' : 
                      'none'

  const handleAbstractionConnect = async () => {
    try {
      await abstractionConnect()
    } catch (error) {
      console.error("Wallet abstraction connection error:", error)
    }
  }

  const handleUnifiedDisconnect = async () => {
    try {
      // Only need to clear abstraction state now - ThirdWeb handles its own disconnect
      if (abstractionConnected) await abstractionDisconnect()
    } catch (error) {
      console.error("Disconnect error:", error)
    }
  }

  const getAbstractionButtonText = () => {
    if (abstractionConnecting) return "Connecting..."
    if (abstractionConnected) {
      // Show user info if available, otherwise show address
      if (user?.email) return user.email
      if (user?.name) return user.name
      return "Connected"
    }
    return `Connect with ${abstractionProviderName}`
  }

  const renderWalletButtons = () => {
    if (activeWallet === 'abstraction') {
      // Show abstraction connected state with disconnect button
      return (
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline"
            size="lg"
            className="min-w-[160px]"
          >
            {getAbstractionButtonText()}
          </Button>
          <Button 
            onClick={handleUnifiedDisconnect}
            variant="destructive"
            size="lg"
          >
            Disconnect
          </Button>
        </div>
      )
    }
    
    if (activeWallet === 'thirdweb') {
      // Show only ThirdWeb ConnectButton - it handles disconnect state automatically
      return (
        <ConnectButton 
          client={client}
          chains={supportedChains}
          appMetadata={{
            name: "OMA3 Attestation Portal",
            url: "https://attestation.oma3.org",
            description: "Create and manage attestations for the OMA3 ecosystem",
            logoUrl: "/oma3_logo.svg"
          }}
        />
      )
    }
    
    // Show both buttons when neither is connected
    return (
      <div className="flex items-center space-x-2">
        <Button 
          onClick={handleAbstractionConnect}
          disabled={abstractionConnecting}
          variant="default"
          size="lg"
          className="min-w-[160px]"
        >
          {getAbstractionButtonText()}
        </Button>
        <ConnectButton 
          client={client}
          chains={supportedChains}
          appMetadata={{
            name: "OMA3 Attestation Portal",
            url: "https://attestation.oma3.org",
            description: "Create and manage attestations for the OMA3 ecosystem",
            logoUrl: "/oma3_logo.svg"
          }}
          connectButton={{
            label: "Connect with ThirdWeb"
          }}
        />
      </div>
    )
  }

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
            <ChainSwitcher />
            {renderWalletButtons()}
          </div>
        </div>
      </div>
    </header>
  )
}