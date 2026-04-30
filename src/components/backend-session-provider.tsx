"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { useActiveAccount, useActiveWallet, useAutoConnect, useDisconnect } from "thirdweb/react"
import { client } from "@/app/client"
import { allWallets } from "@/config/wallets"
import { clearWalletBrowserState } from "@/lib/wallet-cleanup"
import type { BackendSessionMeResponse } from "@/lib/omatrust-backend"
import { BackendApiError, getSessionMe, isBackendNetworkError, logoutSession } from "@/lib/omatrust-backend"

type AuthDialogMode = "chooser" | "signin" | "signup"

export interface AuthDialogRequest {
  open: boolean
  mode: AuthDialogMode
  reason?: "navigation" | "submission"
  schemaId?: string
  schemaTitle?: string
  subjectScoped?: boolean
  subjectHint?: string
  hintMessage?: string | null
}

interface BackendSessionContextValue {
  session: BackendSessionMeResponse | null
  isSessionLoading: boolean
  authDialog: AuthDialogRequest
  openAuthDialog: (request?: Partial<Omit<AuthDialogRequest, "open">>) => void
  closeAuthDialog: () => void
  refreshSession: () => Promise<BackendSessionMeResponse | null>
  logout: () => Promise<void>
  setSession: (session: BackendSessionMeResponse | null) => void
}

const defaultAuthDialog: AuthDialogRequest = {
  open: false,
  mode: "chooser",
  reason: "navigation",
  schemaId: undefined,
  schemaTitle: undefined,
  subjectScoped: false,
  subjectHint: "",
  hintMessage: null,
}

const BackendSessionContext = createContext<BackendSessionContextValue | null>(null)

export function BackendSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<BackendSessionMeResponse | null>(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)
  const [authDialog, setAuthDialog] = useState<AuthDialogRequest>(defaultAuthDialog)
  const activeAccount = useActiveAccount()
  const activeWallet = useActiveWallet()
  const { disconnect } = useDisconnect()
  const sessionRef = React.useRef<BackendSessionMeResponse | null>(null)
  const suppressNextDisconnectLogoutRef = React.useRef(false)

  // ---------------------------------------------------------------------------
  // Provider-level autoConnect — single attempt on app mount.
  // Replaces per-ConnectButton autoConnect props.
  // ---------------------------------------------------------------------------
  const autoConnect = useAutoConnect({
    client,
    wallets: allWallets,
    timeout: 15000,
  })
  const isAutoConnectDone = !autoConnect.isLoading

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const refreshSession = useCallback(async () => {
    try {
      const response = await getSessionMe()
      setSession(response)
      return response
    } catch (error) {
      if (error instanceof BackendApiError && error.status === 401) {
        setSession(null)
        return null
      }
      if (isBackendNetworkError(error)) {
        setSession(null)
        return null
      }
      throw error
    }
  }, [])

  const logout = useCallback(async () => {
    suppressNextDisconnectLogoutRef.current = true
    setIsSessionLoading(true)

    try {
      if (sessionRef.current) {
        try {
          await logoutSession()
        } catch (error) {
          if (!(error instanceof BackendApiError && error.status === 401) && !isBackendNetworkError(error)) {
            throw error
          }
        }
      }

      setSession(null)

      if (activeWallet) {
        await disconnect(activeWallet)
      }

      // Best-effort cleanup of wallet browser state.
      // Some deletes may be blocked by open connections (e.g., WalletConnect Core),
      // but ensureWalletConnected will clean up before the next sign-in.
      clearWalletBrowserState()
    } finally {
      suppressNextDisconnectLogoutRef.current = false
      setIsSessionLoading(false)
    }
  }, [activeWallet, disconnect])

  // ---------------------------------------------------------------------------
  // Session check — runs exactly once after autoConnect finishes.
  //
  // This is the only place that calls session/me on startup. All other
  // session state changes are handled imperatively (performChallengeSignVerify,
  // logout, refreshSession). Wallet state changes do NOT trigger this effect.
  //
  // Sequencing:
  //   1. useAutoConnect attempts wallet restoration
  //   2. Wait for autoConnect to resolve (isAutoConnectDone === true)
  //   3. Call GET /api/private/session/me once
  //   4. If session exists but wallet is not connected, clear the stale session
  // ---------------------------------------------------------------------------
  const initialSessionCheckDone = React.useRef(false)

  useEffect(() => {
    if (!isAutoConnectDone) return
    if (initialSessionCheckDone.current) return

    initialSessionCheckDone.current = true
    let cancelled = false

    async function checkSession() {
      try {
        // If autoConnect didn't restore a wallet, there's no point checking
        // for a session. Even if a cookie exists, the session is stale
        // (can't sign anything without a wallet) and we'd clear it anyway.
        if (!activeAccount) {
          setSession(null)
          return
        }

        const response = await refreshSession()
        if (cancelled) return

        // Session restored and wallet connected — happy path
      } catch (error) {
        if (!cancelled && !isBackendNetworkError(error)) {
          console.error("[backend-session] Failed to load session", error)
        }
        if (!cancelled) {
          setSession(null)
        }
      } finally {
        if (!cancelled) {
          setIsSessionLoading(false)
        }
      }
    }

    void checkSession()

    return () => { cancelled = true }
  }, [isAutoConnectDone]) // eslint-disable-line react-hooks/exhaustive-deps
  // activeAccount and refreshSession are intentionally excluded — this effect
  // must run exactly once after autoConnect finishes, not on every wallet change.

  // ---------------------------------------------------------------------------
  // Auto-disconnect effect REMOVED.
  //
  // A connected wallet with no session is harmless — the submission gate
  // will route through the auth dialog when the user tries to submit.
  // A session without a wallet is handled above (stale session clearing).
  // ---------------------------------------------------------------------------

  const openAuthDialog = useCallback((request?: Partial<Omit<AuthDialogRequest, "open">>) => {
    setAuthDialog({
      ...defaultAuthDialog,
      ...request,
      open: true,
    })
  }, [])

  const closeAuthDialog = useCallback(() => {
    setAuthDialog(defaultAuthDialog)
  }, [])

  // ---------------------------------------------------------------------------
  // Close the auth dialog on page navigation.
  // The provider persists across Next.js client-side navigations (it's in the
  // layout), so the dialog would stay open unless we explicitly close it.
  // ---------------------------------------------------------------------------
  const pathname = usePathname()
  useEffect(() => {
    setAuthDialog((current) => (current.open ? defaultAuthDialog : current))
  }, [pathname])

  const value = useMemo<BackendSessionContextValue>(() => ({
    session,
    isSessionLoading,
    authDialog,
    openAuthDialog,
    closeAuthDialog,
    refreshSession,
    logout,
    setSession,
  }), [authDialog, closeAuthDialog, isSessionLoading, logout, openAuthDialog, refreshSession, session])

  return (
    <BackendSessionContext.Provider value={value}>
      {children}
    </BackendSessionContext.Provider>
  )
}

export function useBackendSession() {
  const context = useContext(BackendSessionContext)
  if (!context) {
    throw new Error("useBackendSession must be used within BackendSessionProvider")
  }
  return context
}
