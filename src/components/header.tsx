"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Wallet } from "lucide-react"
import { useState } from "react"

export function Header() {
  const pathname = usePathname()
  const [isConnected, setIsConnected] = useState(false)

  const handleConnectWallet = () => {
    // Placeholder for wallet connection logic
    setIsConnected(!isConnected)
  }

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/attest", label: "Create Attestation" },
    { href: "/dashboard", label: "Dashboard" },
  ]

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center">
              <Image 
                src="/oma3_logo.svg" 
                alt="OMA3 Logo" 
                width={120} 
                height={40} 
                priority
              />
              <span className="ml-2 text-gray-600">Attestation Portal</span>
            </Link>

            <nav className="hidden md:flex space-x-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition-colors hover:text-blue-600 ${
                    pathname === item.href ? "text-blue-600 border-b-2 border-blue-600 pb-4" : "text-gray-600"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <Button
            onClick={handleConnectWallet}
            variant={isConnected ? "outline" : "default"}
            className="flex items-center space-x-2"
          >
            <Wallet className="h-4 w-4" />
            <span>{isConnected ? "Connected" : "Connect Wallet"}</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
