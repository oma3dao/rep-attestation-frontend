"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useActiveAccount } from "thirdweb/react"
import { ConnectButton } from "thirdweb/react"
import { client } from "@/app/client"
import { sepolia, mainnet, bsc, bscTestnet } from "thirdweb/chains"

export function Header() {
  const pathname = usePathname()
  
  // Primary wallet system (ThirdWeb)
  const account = useActiveAccount()
  
  // Define supported chains for wallet provider
  const supportedChains = [bscTestnet, bsc, sepolia, mainnet]

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
            {/* Wallet ConnectButton with built-in network switching */}
            <ConnectButton 
              client={client}
              chains={supportedChains}
              appMetadata={{
                name: "OMA3 Attestation Portal",
                url: "https://attestation.oma3.org",
                description: "Create and manage attestations for the OMA3 ecosystem",
                logoUrl: "/oma3_logo.svg"
              }}
              theme="light"
              connectButton={{
                style: {
                  backgroundColor: "#3b82f6",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px"
                }
              }}
            />
          </div>
        </div>
      </div>
    </header>
  )
}