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
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center">
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

          <div className="flex items-center space-x-6">
            <nav className="hidden md:flex space-x-5">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-base font-medium transition-colors hover:text-foreground ${
                    pathname === item.href ? "text-foreground" : "text-muted-foreground"
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
              <div className="flex items-center space-x-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-1">
                <span className="text-sm font-medium text-warning-foreground">
                  Wrong Network
                </span>
                <span className="text-xs text-warning-foreground/80">
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
                className="rounded-md px-4 py-2"
                connectButtonProps={{ label: "Sign In" }}
              />
            </div>
          </div>
        </div>
      </div>
      <ReviewWidgetModal open={reviewOpen} onOpenChange={setReviewOpen} />
    </header>
  )
}
