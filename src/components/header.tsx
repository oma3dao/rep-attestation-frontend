"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AuthEntryDialog } from "@/components/auth-entry-dialog"
import { useBackendSession } from "@/components/backend-session-provider"

type NavLink = {
  label: string
  href: string
  external?: boolean
}

const navLinks: NavLink[] = [
  { label: "Activity", href: "/" },
  { label: "Publish", href: "/publish" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Docs", href: "https://docs.omatrust.org/", external: true },
]

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { session, authDialog, closeAuthDialog, openAuthDialog: openBackendAuthDialog } = useBackendSession()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const isSignedIn = !!session
  const displayName = session?.account?.displayName
  const walletAddress = session?.wallet?.did
  const headerLabel = isSignedIn
    ? displayName || (walletAddress ? `${walletAddress.slice(-8)}` : "Account")
    : "Sign In"

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    if (searchParams.get("action") !== "signin") {
      return
    }

    // Don't open the sign-in modal if the user already has a session
    if (!isSignedIn) {
      openBackendAuthDialog({ mode: "chooser" })
    }

    const params = new URLSearchParams(searchParams.toString())
    params.delete("action")
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
    router.replace(nextUrl, { scroll: false })
  }, [isSignedIn, openBackendAuthDialog, pathname, router, searchParams])

  const openAuthDialog = () => {
    setMobileOpen(false)
    openBackendAuthDialog({ mode: "chooser" })
  }

  return (
    <>
      <nav
        className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border"
          : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link
            href="https://www.omatrust.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2"
          >
            <span className="text-xl font-bold tracking-tight text-foreground">
              OMATrust
            </span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className={`group relative text-sm font-medium transition-colors hover:text-foreground ${
                  !link.external && pathname === link.href
                    ? "text-foreground"
                    : "text-foreground/70"
                }`}
              >
                {link.label}
                <span
                  className={`absolute -bottom-1 left-0 h-px bg-primary transition-all group-hover:w-full ${
                    !link.external && pathname === link.href ? "w-full" : "w-0"
                  }`}
                />
              </Link>
            ))}
            {isSignedIn ? (
              <Link
                href="/account"
                className="ml-2 rounded-md border border-primary/25 bg-background/80 px-4 py-2 text-sm font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/5"
              >
                {headerLabel}
              </Link>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="ml-2 border-primary/25 bg-background/80 text-foreground hover:border-primary/50 hover:bg-primary/5"
                onClick={openAuthDialog}
              >
                Sign In
              </Button>
            )}
          </div>

          <button
            className="text-foreground md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-b border-border bg-background/95 px-6 pb-6 backdrop-blur-xl md:hidden">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className={`block border-b border-border/50 py-3 text-sm transition-colors hover:text-foreground ${
                  !link.external && pathname === link.href
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {isSignedIn ? (
              <Link
                href="/account"
                className="mt-4 block w-full rounded-md border border-primary/25 bg-background/80 px-4 py-2 text-center text-sm font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/5"
                onClick={() => setMobileOpen(false)}
              >
                {headerLabel}
              </Link>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full border-primary/25 bg-background/80 text-foreground hover:border-primary/50 hover:bg-primary/5"
                onClick={openAuthDialog}
              >
                Sign In
              </Button>
            )}
          </div>
        )}
      </nav>

      {authDialog.open && (
        <AuthEntryDialog
          request={authDialog}
          onOpenChange={(open) => {
            if (open) {
              openBackendAuthDialog({
                mode: authDialog.mode,
                reason: authDialog.reason,
                schemaId: authDialog.schemaId,
                schemaTitle: authDialog.schemaTitle,
                subjectScoped: authDialog.subjectScoped,
                subjectHint: authDialog.subjectHint,
              })
              return
            }
            closeAuthDialog()
          }}
        />
      )}
    </>
  )
}
