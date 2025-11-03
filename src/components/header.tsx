"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { DEFAULT_CHAIN } from "@/config/chains"
import { useWallet } from "@/lib/blockchain"

export function Header() {
  const pathname = usePathname()
  const { isConnected, isChainSupported } = useWallet()

  const navItems = [
    { href: "/", label: "Home", external: false },
    { href: "https://registry.omatrust.org", label: "Developers", external: true },
    { href: "https://docs.oma3.org/attestations", label: "Docs", external: true },
    // { href: "/attest", label: "Create Attestation" }, // Redundant with home page
    // { href: "/dashboard", label: "Dashboard" }, // TODO: Re-enable when dashboard is implemented
  ]

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-20">
          <Link href="/" className="flex items-center">
            <Image 
              src="/oma3_logo.svg" 
              alt="OMA3 Logo" 
              width={120} 
              height={40} 
              priority
              style={{ width: 'auto', height: '40px' }}
            />
            <span className="ml-2 text-gray-600 text-lg">Attestation Portal</span>
          </Link>

          <div className="flex-1" />

          <div className="flex items-center space-x-8">
            <nav className="hidden md:flex space-x-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-lg font-medium transition-colors hover:text-blue-600 ${
                    pathname === item.href ? "text-blue-600" : "text-gray-600"
                  }`}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Network mismatch warning */}
            {isConnected && !isChainSupported && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-orange-100 border border-orange-300 rounded-md">
                <span className="text-orange-800 text-sm font-medium">
                  Wrong Network
                </span>
                <span className="text-orange-600 text-xs">
                  Please disconnect your wallet, switch to {DEFAULT_CHAIN.name} in your wallet, and then reconnect.  
                </span>
              </div>
            )}
            <Button 
              isConnectButton 
              className="bg-blue-600 text-white hover:bg-blue-700 rounded-md px-4 py-2"
              connectButtonProps={{ label: "Sign In" }}
            />
          </div>
        </div>
      </div>
    </header>
  )
}