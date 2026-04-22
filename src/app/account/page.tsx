"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useBackendSession } from "@/components/backend-session-provider"

export default function AccountPage() {
  const router = useRouter()
  const { session, isSessionLoading } = useBackendSession()

  // Redirect to home when session is lost (e.g., after wallet disconnect)
  React.useEffect(() => {
    if (!isSessionLoading && !session) {
      router.replace("/")
    }
  }, [isSessionLoading, session, router])

  if (isSessionLoading || !session) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-foreground">Account</h1>

      <div className="space-y-6">
        <div className="rounded-xl border border-border/80 bg-card p-5">
          <h2 className="mb-1 text-sm font-medium text-muted-foreground">Display Name</h2>
          <p className="text-foreground">{session.account.displayName || "—"}</p>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-5">
          <h2 className="mb-1 text-sm font-medium text-muted-foreground">Wallet</h2>
          <p className="break-all font-mono text-xs tracking-wide text-foreground">
            {session.wallet?.did || "—"}
          </p>
          {session.wallet?.walletProviderId && (
            <p className="mt-1 text-sm text-muted-foreground">
              Provider: {session.wallet.walletProviderId}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-5">
          <h2 className="mb-1 text-sm font-medium text-muted-foreground">Subscription</h2>
          <p className="text-foreground">
            {session.subscription?.plan ?? "free"} — {session.subscription?.status ?? "active"}
          </p>
        </div>

        {session.primarySubject && (
          <div className="rounded-xl border border-border/80 bg-card p-5">
            <h2 className="mb-1 text-sm font-medium text-muted-foreground">Primary Subject</h2>
            <p className="break-all font-mono text-xs tracking-wide text-foreground">
              {session.primarySubject.canonicalDid}
            </p>
          </div>
        )}

        <div className="rounded-xl border border-border/80 bg-card p-5">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Wallet Management</h2>
          <div id="account-connect">
            <Button
              isConnectButton
              variant="outline"
              connectButtonProps={{ label: "Manage Wallet" }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
