"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { SubjectConfirmationDialog } from "@/components/subject-confirmation-dialog"
import { useBackendSession } from "@/components/backend-session-provider"
import {
  createSubscriptionCheckoutSession,
  getAccountMe,
  getCurrentSubscription,
  listSubjects,
  patchAccountMe,
  type BackendAccountMeResponse,
  type BackendSubject,
  type BackendSubscriptionCurrentResponse,
} from "@/lib/omatrust-backend"

function formatDate(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function getWalletTypeLabel(isManagedWallet: boolean | undefined) {
  return isManagedWallet ? "Managed wallet" : "Self-custodial wallet"
}

export default function AccountPage() {
  const router = useRouter()
  const { session, isSessionLoading, refreshSession, logout } = useBackendSession()
  const [account, setAccount] = React.useState<BackendAccountMeResponse | null>(null)
  const [subscription, setSubscription] = React.useState<BackendSubscriptionCurrentResponse["subscription"] | null>(null)
  const [subjects, setSubjects] = React.useState<BackendSubject[]>([])
  const [isPageLoading, setIsPageLoading] = React.useState(false)
  const [pageError, setPageError] = React.useState<string | null>(null)
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = React.useState(false)
  const [isUpgradeLoading, setIsUpgradeLoading] = React.useState(false)
  const [isLogoutLoading, setIsLogoutLoading] = React.useState(false)
  const [isEditingName, setIsEditingName] = React.useState(false)
  const [editNameValue, setEditNameValue] = React.useState("")
  const [isSavingName, setIsSavingName] = React.useState(false)

  React.useEffect(() => {
    if (!isSessionLoading && !session) {
      router.replace("/")
    }
  }, [isSessionLoading, session, router])

  const loadAccountData = React.useCallback(async () => {
    if (!session) {
      return
    }

    setIsPageLoading(true)
    setPageError(null)

    try {
      const [accountResponse, subscriptionResponse, subjectsResponse] = await Promise.all([
        getAccountMe(),
        getCurrentSubscription(),
        listSubjects(),
      ])

      setAccount(accountResponse)
      setSubscription(subscriptionResponse.subscription)
      setSubjects(subjectsResponse.subjects)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to load account details.")
    } finally {
      setIsPageLoading(false)
    }
  }, [session])

  React.useEffect(() => {
    void loadAccountData()
  }, [loadAccountData])

  const walletDid = session?.wallet?.did ?? null
  const visibleSubject = React.useMemo(() => {
    const normalizedWalletDid = walletDid?.toLowerCase()
    const nonWalletSubjects = subjects.filter(
      (subject) => subject.canonicalDid.toLowerCase() !== normalizedWalletDid
    )

    if (nonWalletSubjects.length > 0) {
      return nonWalletSubjects.find((subject) => subject.isDefault) ?? nonWalletSubjects[0]
    }

    if (
      account?.primarySubject &&
      account.primarySubject.canonicalDid.toLowerCase() !== normalizedWalletDid
    ) {
      return {
        id: account.primarySubject.id,
        canonicalDid: account.primarySubject.canonicalDid,
        subjectDidHash: account.primarySubject.subjectDidHash,
        displayName: account.primarySubject.displayName,
        isDefault: true,
      } satisfies BackendSubject
    }

    return null
  }, [account?.primarySubject, subjects, walletDid])

  const readsLeft = subscription
    ? Math.max(0, subscription.annualPremiumReadLimit - subscription.premiumReadsUsedCurrentYear)
    : null
  const writesLeft = subscription
    ? Math.max(0, subscription.annualSponsoredWriteLimit - subscription.sponsoredWritesUsedCurrentYear)
    : null
  const renewalDateLabel = formatDate(subscription?.entitlementPeriodEnd ?? null)
  const isFreePlan = (subscription?.plan ?? session?.subscription?.plan ?? "free").toLowerCase() === "free"

  function startEditingName() {
    setEditNameValue(account?.account.displayName || session?.account.displayName || "")
    setIsEditingName(true)
    setPageError(null)
  }

  function cancelEditingName() {
    setIsEditingName(false)
    setEditNameValue("")
  }

  async function handleSaveName() {
    const trimmed = editNameValue.trim()
    setIsSavingName(true)
    setPageError(null)

    try {
      const updated = await patchAccountMe({ displayName: trimmed || null })
      setAccount((prev) =>
        prev
          ? { ...prev, account: { ...prev.account, displayName: updated.account.displayName } }
          : prev
      )
      setIsEditingName(false)
      setEditNameValue("")
      await refreshSession().catch(() => null)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to update display name.")
    } finally {
      setIsSavingName(false)
    }
  }

  async function handleUpgrade() {
    setIsUpgradeLoading(true)
    setPageError(null)

    try {
      const currentUrl = typeof window !== "undefined" ? window.location.href : "/account"
      const response = await createSubscriptionCheckoutSession({
        plan: "paid",
        successUrl: currentUrl,
        cancelUrl: currentUrl,
      })

      window.location.href = response.checkoutUrl
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to start upgrade flow.")
      setIsUpgradeLoading(false)
    }
  }

  async function handleSubjectCreated(subject: BackendSubject) {
    setSubjects((current) => {
      const next = current.filter((item) => item.id !== subject.id)
      next.unshift(subject)
      return next
    })

    await Promise.all([loadAccountData(), refreshSession().catch(() => null)])
  }

  async function handleLogout() {
    setIsLogoutLoading(true)
    setPageError(null)

    try {
      await logout()
      // Full page navigation (not Next.js client-side) to ensure all browser
      // state is released — WalletConnect Core singleton, IndexedDB connections,
      // in-memory wallet state. This guarantees a clean slate.
      window.location.href = "/"
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to log out.")
      setIsLogoutLoading(false)
    }
  }

  if (isSessionLoading || !session) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-muted-foreground sm:px-6 lg:px-8">
        Loading…
      </div>
    )
  }

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-3 max-w-2xl">
          <h1 className="technical-label uppercase text-primary">Account</h1>
        </div>

        <div className="mt-3 max-w-7xl space-y-6">
          {pageError ? (
            <div className="status-panel-error px-4 py-3 text-sm">{pageError}</div>
          ) : null}

          <div className="rounded-xl border border-border/80 bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-medium text-muted-foreground">Name</h2>
                {isEditingName ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleSaveName()
                        if (e.key === "Escape") cancelEditingName()
                      }}
                      disabled={isSavingName}
                      className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none transition focus:border-primary"
                      placeholder="Your name or organization"
                      autoFocus
                    />
                  </div>
                ) : (
                  <p className="mt-1 text-foreground">
                    {account?.account.displayName || session.account.displayName || "—"}
                  </p>
                )}
              </div>
              <div className="shrink-0 pt-5">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={cancelEditingName}
                      disabled={isSavingName}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleSaveName()}
                      disabled={isSavingName}
                    >
                      {isSavingName ? "Saving…" : "Save"}
                    </Button>
                  </div>
                ) : (
                  <Button type="button" size="sm" variant="ghost" onClick={startEditingName}>
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-5">
            <h2 className="text-sm font-medium text-muted-foreground">Subject Identifier</h2>
            {isPageLoading ? (
              <div className="mt-3 text-sm text-muted-foreground">Loading…</div>
            ) : visibleSubject ? (
              <div className="mt-3 space-y-2">
                <p className="break-all font-mono text-xs tracking-wide text-foreground">
                  {visibleSubject.canonicalDid}
                </p>
                {visibleSubject.displayName ? (
                  <p className="text-sm text-muted-foreground">{visibleSubject.displayName}</p>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Add a URL that you own to represent you or your organization.
                </p>
                <div className="flex justify-end">
                  <Button type="button" onClick={() => setIsSubjectDialogOpen(true)}>
                    Add your Subject Identifier.
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3">
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground">Wallet</h2>
                  <p className="mt-1 break-all font-mono text-xs tracking-wide text-foreground">
                    {walletDid ?? "—"}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Wallet Type</h3>
                  <p className="mt-1 text-foreground">
                    {getWalletTypeLabel(session.wallet?.isManagedWallet)}
                  </p>
                </div>
              </div>

              <div className="w-full sm:w-56">
                <div className="space-y-3">
                  <div className="omatrust-connect w-full">
                    <Button
                      isConnectButton
                      className="w-full"
                      connectHideDisconnect
                      connectButtonProps={{ label: "Manage Wallet" }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full"
                    onClick={handleLogout}
                    disabled={isLogoutLoading}
                  >
                    {isLogoutLoading ? "Logging Out…" : "Log Out"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-4">
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground">Subscription</h2>
                  <p className="mt-1 text-foreground">
                    {(subscription?.plan ?? session.subscription?.plan ?? "free").toUpperCase()}{" "}
                    <span className="text-muted-foreground">
                      — {subscription?.status ?? session.subscription?.status ?? "active"}
                    </span>
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Reads Left</p>
                    <p className={`mt-1 ${readsLeft === 0 ? "font-semibold text-destructive" : "text-foreground"}`}>
                      {readsLeft ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Writes Left</p>
                    <p className={`mt-1 ${writesLeft === 0 ? "font-semibold text-destructive" : "text-foreground"}`}>
                      {writesLeft ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  {renewalDateLabel ? (
                    <p>
                      Renews on {renewalDateLabel}. Your reads and writes reset when the subscription renews.
                    </p>
                  ) : (
                    <p>Your reads and writes reset when the subscription renews.</p>
                  )}
                </div>
              </div>

              {isFreePlan ? (
                <div className="w-full sm:w-56">
                  <Button type="button" className="w-full" onClick={handleUpgrade} disabled={isUpgradeLoading}>
                    {isUpgradeLoading ? "Opening Checkout…" : "Upgrade"}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          {isPageLoading ? (
            <div className="text-sm text-muted-foreground">Refreshing account details…</div>
          ) : null}
        </div>
      </div>

      <SubjectConfirmationDialog
        open={isSubjectDialogOpen}
        onOpenChange={setIsSubjectDialogOpen}
        walletDid={walletDid}
        existingSubjectDids={subjects.map((subject) => subject.canonicalDid)}
        onSubjectCreated={(subject) => {
          void handleSubjectCreated(subject)
        }}
      />
    </>
  )
}
