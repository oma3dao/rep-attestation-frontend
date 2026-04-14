"use client"

import React, { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { MessageSquarePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DEFAULT_CHAIN } from "@/config/chains"
import { useWallet } from "@/lib/blockchain"
import { ReviewWidgetModal } from "@/components/review-widget-modal"

export function Header() {
  const pathname = usePathname()
  const { isConnected, isChainSupported } = useWallet()
  const [reviewOpen, setReviewOpen] = useState(false)

  const navItems = [
    { href: "/", label: "Home", external: false },
    { href: "/dashboard", label: "My Attestations", external: false },
    { href: "https://registry.omatrust.org", label: "Registry", external: true },
    { href: "https://docs.omatrust.org/reputation/reputation-model", label: "Docs", external: true },
    // { href: "/attest", label: "Create Attestation" }, // Redundant with home page
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
            />
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
            {isConnected && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-md px-3"
                onClick={() => setReviewOpen(true)}
              >
                <MessageSquarePlus className="h-4 w-4 mr-1.5" />
                Review
              </Button>
            )}
            <div id="header-connect">
              <Button 
                isConnectButton 
                className="bg-black text-white hover:bg-black/80 rounded-md px-4 py-2"
                connectButtonProps={{ label: "Sign In" }}
              />
              <style>{`
                #header-connect .tw-connect-wallet {
                  height: 2.25rem !important;
                  padding: 0 0.75rem !important;
                  background-color: rgb(0 0 0) !important;
                  color: white !important;
                  border-radius: 0.375rem !important;
                  font-weight: 500 !important;
                  font-size: 0.875rem !important;
                  border: none !important;
                }
                #header-connect .tw-connect-wallet:hover {
                  background-color: rgb(0 0 0 / 0.8) !important;
                }
              `}</style>
            </div>
          </div>
        </div>
      </div>
      <ReviewWidgetModal open={reviewOpen} onOpenChange={setReviewOpen} />
    </header>
  )
}