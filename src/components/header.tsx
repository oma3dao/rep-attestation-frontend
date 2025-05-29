"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useWallet } from "@/lib/wallet-abstraction"
import { Button } from "@/components/ui/button"
import { ChainSwitcher } from "@/components/chain-switcher"

export function Header() {
  const pathname = usePathname()
  const { isConnected, user, connect, disconnect, isConnecting } = useWallet()

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/attest", label: "Create Attestation" },
    { href: "/dashboard", label: "Dashboard" },
  ]

  const handleAuth = async () => {
    try {
      if (isConnected) {
        await disconnect()
      } else {
        await connect()
      }
    } catch (error) {
      console.error("Authentication error:", error)
    }
  }

  const getButtonText = () => {
    if (isConnecting) return "Connecting..."
    if (isConnected) {
      // Show user info if available, otherwise just "Disconnect"
      if (user?.email) return user.email
      if (user?.name) return user.name
      return "Disconnect"
    }
    return "Connect Wallet"
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
            <Button 
              onClick={handleAuth}
              disabled={isConnecting}
              variant={isConnected ? "outline" : "default"}
              size="lg"
              className="min-w-[120px]"
            >
              {getButtonText()}
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}