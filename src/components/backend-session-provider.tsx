"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react"
import type { BackendSessionMeResponse } from "@/lib/omatrust-backend"
import { BackendApiError, getSessionMe, isBackendNetworkError } from "@/lib/omatrust-backend"

type AuthDialogMode = "chooser" | "signin" | "signup"

export interface AuthDialogRequest {
  open: boolean
  mode: AuthDialogMode
  reason?: "navigation" | "submission"
  schemaId?: string
  schemaTitle?: string
  subjectScoped?: boolean
  subjectHint?: string
  onSubmitAfterAuth?: (() => Promise<void>) | null
}

interface BackendSessionContextValue {
  session: BackendSessionMeResponse | null
  isSessionLoading: boolean
  authDialog: AuthDialogRequest
  openAuthDialog: (request?: Partial<Omit<AuthDialogRequest, "open">>) => void
  closeAuthDialog: () => void
  refreshSession: () => Promise<BackendSessionMeResponse | null>
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
  onSubmitAfterAuth: null,
}

const BackendSessionContext = createContext<BackendSessionContextValue | null>(null)

export function BackendSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<BackendSessionMeResponse | null>(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)
  const [authDialog, setAuthDialog] = useState<AuthDialogRequest>(defaultAuthDialog)
  const activeAccount = useActiveAccount()
  const activeAddress = activeAccount?.address ?? null
  const activeWallet = useActiveWallet()
  const { disconnect } = useDisconnect()

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

  useEffect(() => {
    // Only check for a backend session if a wallet is connected.
    // No wallet means no session cookie could exist.
    if (!activeAddress) {
      setSession(null)
      setIsSessionLoading(false)
      return
    }

    let cancelled = false

    async function loadSession() {
      try {
        const response = await refreshSession()
        if (cancelled) {
          return
        }
        setSession(response)
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

    setIsSessionLoading(true)
    void loadSession()

    return () => {
      cancelled = true
    }
  }, [activeAddress, refreshSession])

  // Auto-disconnect the Thirdweb wallet if there's no valid backend session.
  // This keeps wallet connection state in sync with the backend session.
  // Skip disconnecting while the auth dialog is open (user is in the sign-up flow).
  useEffect(() => {
    if (activeWallet && !isSessionLoading && !session && !authDialog.open) {
      console.debug("[backend-session] No session, disconnecting wallet")
      disconnect(activeWallet)
    }
  }, [activeWallet, isSessionLoading, session, authDialog.open, disconnect])

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

  const value = useMemo<BackendSessionContextValue>(() => ({
    session,
    isSessionLoading,
    authDialog,
    openAuthDialog,
    closeAuthDialog,
    refreshSession,
    setSession,
  }), [authDialog, closeAuthDialog, isSessionLoading, openAuthDialog, refreshSession, session])

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
