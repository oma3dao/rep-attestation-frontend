"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import type { AuthDialogRequest } from "@/components/backend-session-provider"
import { useBackendSession } from "@/components/backend-session-provider"
import {
  BackendApiError,
  buildWalletDid,
  createSubject,
  createWalletChallenge,
  deriveDidWebFromInput,
  deriveSubjectUrlHint,
  listSubjects,
  patchAccountMe,
  type BackendSessionMeResponse,
  type BackendSubject,
  verifySubjectOwnership,
  type WalletExecutionMode,
  verifyWalletSession,
} from "@/lib/omatrust-backend"
import { getActiveChain } from "@/lib/blockchain"

interface AuthEntryDialogProps {
  request: AuthDialogRequest
  onOpenChange: (open: boolean) => void
}

type WizardStep =
  | "chooser"
  | "signin"
  | "createSimple"
  | "createSubjectInfo"
  | "createSubjectVerify"
  | "review"
  | "success"

type PendingChallenge = {
  challengeId: string
  siweMessage: string
  walletDid: string
  walletProviderId: string | null
  signature: string
}

type AuthIntent =
  | {
      kind: "signin"
    }
  | {
      kind: "signup"
      executionMode: WalletExecutionMode
      requiresSubjectVerification: boolean
    }

type SubjectVerificationState = "idle" | "verified" | "failed"
type DidWebProofMethod = "dns" | "didDocument"

const SUBJECT_SCOPED_SCHEMA_IDS = new Set([
  "key-binding",
  "linked-identifier",
  "user-review-response",
])

function getInitialStep(request: AuthDialogRequest, isSubjectScoped: boolean): WizardStep {
  if (request.mode === "signin") {
    return "signin"
  }

  if (request.mode === "signup") {
    return isSubjectScoped ? "createSubjectInfo" : "createSimple"
  }

  return "chooser"
}

function getDialogTitle(step: WizardStep) {
  switch (step) {
    case "createSimple":
    case "createSubjectInfo":
      return "Create Account"
    case "createSubjectVerify":
      return "Verify Subject Ownership"
    case "review":
      return "Submit Attestation"
    case "success":
      return "Account Ready"
    case "signin":
    case "chooser":
    default:
      return "Sign In"
  }
}

function getFriendlyError(error: unknown) {
  if (error instanceof BackendApiError) {
    switch (error.code) {
      case "BACKEND_UNREACHABLE":
        return "The OMATrust backend is not reachable right now."
      case "EXECUTION_MODE_REQUIRED":
        return "Choose how this wallet should publish before we finish creating your account."
      case "EXECUTION_MODE_ALREADY_SET":
        return "This wallet already has an execution mode configured. Sign in with the same choice you used before."
      case "SUBJECT_ALREADY_EXISTS":
        return "This subject is already attached to your account."
      case "SUBJECT_OWNED_BY_ANOTHER_ACCOUNT":
        return "That subject is already associated with another OMATrust account."
      case "INVALID_CHALLENGE":
        return "Your sign-in request expired or became invalid. Please try again."
      case "CHALLENGE_EXPIRED":
        return "Your sign-in request expired. Please try again."
      default:
        return error.message
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Something went wrong. Please try again."
}

function formatVerificationMethod(
  method: "dns" | "did-document" | "wallet" | "contract" | "minting-wallet" | "transfer" | null
) {
  switch (method) {
    case "dns":
      return "DNS TXT"
    case "did-document":
      return "did.json"
    case "wallet":
      return "wallet"
    case "contract":
      return "contract ownership"
    case "minting-wallet":
      return "minting wallet"
    case "transfer":
      return "transfer proof"
    default:
      return "verification"
  }
}

function getDomainFromDidWeb(didWeb: string | null) {
  return didWeb?.replace(/^did:web:/, "") ?? "example.com"
}

export function AuthEntryDialog({ request, onOpenChange }: AuthEntryDialogProps) {
  const { refreshSession, session, setSession } = useBackendSession()
  const activeAccount = useActiveAccount()
  const activeWallet = useActiveWallet()
  const { disconnect } = useDisconnect()

  const isSubmissionFlow = request.reason === "submission"
  const isSubjectScoped =
    !!request.subjectScoped || SUBJECT_SCOPED_SCHEMA_IDS.has(request.schemaId ?? "")

  const [step, setStep] = useState<WizardStep>(getInitialStep(request, isSubjectScoped))
  const [accountName, setAccountName] = useState("")
  const [subjectUrl, setSubjectUrl] = useState("")
  const [authIntent, setAuthIntent] = useState<AuthIntent | null>(null)
  const [pendingChallenge, setPendingChallenge] = useState<PendingChallenge | null>(null)
  const [lastAttemptKey, setLastAttemptKey] = useState<string | null>(null)
  const [subjectRecord, setSubjectRecord] = useState<BackendSubject | null>(null)
  const [verificationMethod, setVerificationMethod] = useState<DidWebProofMethod>("dns")
  const [verificationState, setVerificationState] = useState<SubjectVerificationState>("idle")
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null)
  const [isBootstrappingChallenge, setIsBootstrappingChallenge] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isVerifyingSubject, setIsVerifyingSubject] = useState(false)
  const [isAddingSubject, setIsAddingSubject] = useState(false)
  const [isSubmittingFinalStep, setIsSubmittingFinalStep] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [authenticatedWalletKey, setAuthenticatedWalletKey] = useState<string | null>(null)
  const challengeFlowActiveRef = useRef(false)

  useEffect(() => {
    if (!request.open) {
      return
    }

    setStep(getInitialStep(request, isSubjectScoped))
    setAccountName("")
    setSubjectUrl(deriveSubjectUrlHint(request.subjectHint))
    setAuthIntent(null)
    setPendingChallenge(null)
    setLastAttemptKey(null)
    setSubjectRecord(null)
    setVerificationMethod("dns")
    setVerificationState("idle")
    setVerificationMessage(null)
    setIsBootstrappingChallenge(false)
    setIsAuthenticating(false)
    setIsVerifyingSubject(false)
    setIsAddingSubject(false)
    setIsSubmittingFinalStep(false)
    setErrorMessage(null)
    setAuthenticatedWalletKey(null)
  }, [isSubjectScoped, request])

  const derivedDidWeb = useMemo(() => deriveDidWebFromInput(subjectUrl), [subjectUrl])
  const activeChainId = getActiveChain().id
  const walletProviderId = activeWallet?.id ?? null
  const walletDid =
    activeAccount?.address
      ? buildWalletDid(activeAccount.address, activeChainId)
      : null
  const selectedExecutionMode = authIntent?.kind === "signup" ? authIntent.executionMode : null
  const subjectDomain = getDomainFromDidWeb(derivedDidWeb)
  const challengeIsReady =
    !!pendingChallenge &&
    pendingChallenge.walletDid === walletDid &&
    pendingChallenge.walletProviderId === walletProviderId

  const closeDialog = () => {
    onOpenChange(false)
  }

  const resetFlowFeedback = () => {
    setErrorMessage(null)
    setVerificationState("idle")
    setVerificationMessage(null)
  }

  const goToCreateAccount = () => {
    resetFlowFeedback()
    setStep(isSubjectScoped ? "createSubjectInfo" : "createSimple")
  }

  const openChooser = () => {
    resetFlowFeedback()
    setAuthIntent(null)
    setPendingChallenge(null)
    setLastAttemptKey(null)
    setStep("chooser")
  }

  const ensureCompatibleConnectedWallet = (executionMode?: WalletExecutionMode) => {
    if (!executionMode || walletProviderId !== "inApp") {
      return true
    }

    if (executionMode === "native") {
      setErrorMessage(
        "The connected wallet is a managed wallet. Disconnect it in the wallet menu and choose a self-custody wallet to pay with OMA."
      )
      return false
    }

    return true
  }

  const beginAuthIntent = (intent: AuthIntent) => {
    resetFlowFeedback()

    if (intent.kind === "signup" && !ensureCompatibleConnectedWallet(intent.executionMode)) {
      return
    }

    setAuthIntent(intent)

    // For subject-scoped signup flows, don't auto-start challenge+sign yet.
    // The user needs to complete subject verification first.
    if (intent.kind === "signup" && intent.requiresSubjectVerification) {
      return
    }

    // If wallet is already connected, start the flow immediately.
    // If not (connectOnConnect callback), the wallet state isn't available yet.
    // The effect below will pick it up once the wallet hooks update.
    if (activeAccount && walletProviderId && walletDid) {
      void performChallengeSignVerify(intent)
    }
  }

  // When authIntent is set but the wallet wasn't ready yet (connectOnConnect timing),
  // this effect starts the flow once the wallet state becomes available.
  useEffect(() => {
    if (
      !authIntent ||
      !activeAccount ||
      !walletProviderId ||
      !walletDid ||
      session ||
      isBootstrappingChallenge ||
      isAuthenticating ||
      pendingChallenge ||
      authenticatedWalletKey ||
      errorMessage ||
      challengeFlowActiveRef.current
    ) {
      return
    }

    if (authIntent.kind === "signup" && authIntent.requiresSubjectVerification) {
      return
    }

    console.debug("[auth-entry-dialog] wallet ready, starting deferred challenge flow")
    void performChallengeSignVerify(authIntent)
  }, [activeAccount, walletProviderId, walletDid, authIntent, session, isBootstrappingChallenge, isAuthenticating, pendingChallenge, authenticatedWalletKey, errorMessage])

  const advanceAfterAuthenticatedFlow = () => {
    if (isSubmissionFlow) {
      setStep("review")
      return
    }

    if (authIntent?.kind === "signin" || request.mode === "signin") {
      closeDialog()
      return
    }

    setStep("success")
  }

  const ensureSubjectForAccount = async () => {
    if (!derivedDidWeb) {
      throw new Error("Enter your organization URL to continue.")
    }

    try {
      const result = await createSubject({
        did: derivedDidWeb,
        displayName: accountName.trim() || null,
      })
      setSubjectRecord(result.subject)
      return result.subject
    } catch (error) {
      if (error instanceof BackendApiError && error.code === "SUBJECT_ALREADY_EXISTS") {
        const existing = await listSubjects()
        const match = existing.subjects.find((subject) => subject.canonicalDid === derivedDidWeb) ?? null
        if (match) {
          setSubjectRecord(match)
          return match
        }
      }
      throw error
    }
  }

  const hydrateSessionAfterVerify = async () => {
    const response = await refreshSession()
    if (!response) {
      throw new Error(
        "Sign-in succeeded but the session could not be established. " +
        "This may be a cookie or cross-origin issue. Please try again."
      )
    }
    setSession(response)
    return response
  }

  const completeWalletSession = async (requestedExecutionMode: WalletExecutionMode | null) => {
    if (!pendingChallenge) {
      throw new Error("Connect a wallet first.")
    }

    setIsAuthenticating(true)
    setErrorMessage(null)

    try {
      await verifyWalletSession({
        challengeId: pendingChallenge.challengeId,
        walletDid: pendingChallenge.walletDid,
        signature: pendingChallenge.signature,
        siweMessage: pendingChallenge.siweMessage,
        walletProviderId: pendingChallenge.walletProviderId,
        executionMode: requestedExecutionMode,
      })

      if (accountName.trim()) {
        await patchAccountMe({
          displayName: accountName.trim(),
        })
      }

      const currentSession = await hydrateSessionAfterVerify()
      setAuthenticatedWalletKey(
        `${pendingChallenge.walletDid}:${requestedExecutionMode ?? "signin"}`
      )
      setPendingChallenge(null)
      return currentSession
    } finally {
      setIsAuthenticating(false)
    }
  }

  /**
   * Imperative challenge → sign → verify flow.
   * Called directly from button callbacks, not from effects.
   */
  const performChallengeSignVerify = async (intent: AuthIntent) => {
    if (!activeAccount || !walletProviderId || !walletDid) {
      setErrorMessage("Connect a wallet first.")
      return
    }

    challengeFlowActiveRef.current = true
    setIsBootstrappingChallenge(true)
    setErrorMessage(null)

    try {
      // Step 1: Get challenge from backend
      console.debug("[auth-entry-dialog] requesting challenge")
      const challenge = await createWalletChallenge({
        walletDid,
        chainId: activeChainId,
        domain: window.location.host,
        uri: window.location.origin,
      })

      // Step 2: Sign SIWE message in wallet
      console.debug("[auth-entry-dialog] requesting wallet signature")
      const signature = await activeAccount.signMessage({
        message: challenge.siweMessage,
      })

      console.debug("[auth-entry-dialog] signature received, verifying session")
      setIsBootstrappingChallenge(false)
      setIsAuthenticating(true)

      // Step 3: Verify with backend (creates account + session)
      const executionMode = intent.kind === "signup" ? intent.executionMode : null
      await verifyWalletSession({
        challengeId: challenge.challengeId,
        walletDid,
        signature,
        siweMessage: challenge.siweMessage,
        walletProviderId,
        executionMode,
      })

      // Step 4: Update display name if provided
      if (accountName.trim()) {
        await patchAccountMe({ displayName: accountName.trim() })
      }

      // Step 5: Hydrate session
      console.debug("[auth-entry-dialog] session verified, hydrating")
      const currentSession = await hydrateSessionAfterVerify()
      setAuthenticatedWalletKey(`${walletDid}:${executionMode ?? "signin"}`)
      setPendingChallenge(null)

      // Step 6: Advance the wizard
      advanceAfterAuthenticatedFlow()
      return currentSession
    } catch (error) {
      setErrorMessage(getFriendlyError(error))
      // Disconnect the wallet on failure so the UI doesn't show a
      // connected wallet with no session (confusing state)
      if (activeWallet) {
        disconnect(activeWallet)
      }
    } finally {
      challengeFlowActiveRef.current = false
      setIsBootstrappingChallenge(false)
      setIsAuthenticating(false)
    }
  }

  // Old effect-based challenge/verify flow removed.
  // Challenge → sign → verify is now handled by performChallengeSignVerify()
  // called from beginAuthIntent() or the deferred wallet-ready effect above.

  const handleContinueSubjectInfo = () => {
    resetFlowFeedback()

    if (!accountName.trim()) {
      setErrorMessage("Organization name is required.")
      return
    }

    if (!derivedDidWeb) {
      setErrorMessage("Organization URL is required.")
      return
    }

    setStep("createSubjectVerify")
  }

  const handleVerifySubject = async () => {
    if (!derivedDidWeb) {
      setErrorMessage("Organization URL is required.")
      return
    }

    if (!walletDid) {
      setErrorMessage("Connect the wallet you want to use before verifying subject ownership.")
      return
    }

    if (!authIntent || authIntent.kind !== "signup") {
      setErrorMessage("Choose how you want to create the account before verifying.")
      return
    }

    if (!challengeIsReady) {
      setErrorMessage("Finish connecting your wallet before verifying subject ownership.")
      return
    }

    setIsVerifyingSubject(true)
    setErrorMessage(null)
    setVerificationState("idle")
    setVerificationMessage(null)

    try {
      const verification = await verifySubjectOwnership({
        subjectDid: derivedDidWeb,
        connectedWalletDid: walletDid,
      })

      if (!verification.ok) {
        setVerificationState("failed")
        setVerificationMessage(
          verification.error ||
            verification.details ||
            "Ownership verification did not succeed yet. Update your proof and try again."
        )
        return
      }

      setVerificationState("verified")
      setVerificationMessage(
        `Ownership verified via ${formatVerificationMethod(
          verification.method ?? (verificationMethod === "didDocument" ? "did-document" : "dns")
        )}.`
      )

      const currentSession = await completeWalletSession(authIntent.executionMode)

      setIsAddingSubject(true)
      try {
        await ensureSubjectForAccount()
      } finally {
        setIsAddingSubject(false)
      }

      if (currentSession) {
        setSession({
          ...currentSession,
          primarySubject: {
            canonicalDid: derivedDidWeb,
            subjectDidHash: currentSession.primarySubject?.subjectDidHash ?? "",
          },
        })
      }

      advanceAfterAuthenticatedFlow()
    } catch (error) {
      setVerificationState("failed")
      setVerificationMessage(null)
      setErrorMessage(getFriendlyError(error))
    } finally {
      setIsVerifyingSubject(false)
    }
  }

  const handleFinalSubmit = async () => {
    if (!request.onSubmitAfterAuth) {
      closeDialog()
      return
    }

    setIsSubmittingFinalStep(true)
    setErrorMessage(null)

    try {
      await request.onSubmitAfterAuth()
      closeDialog()
    } catch (error) {
      setErrorMessage(getFriendlyError(error))
    } finally {
      setIsSubmittingFinalStep(false)
    }
  }

  const renderConnectedWallet = () => {
    // Removed — wallet info is shown on the /account page, not in the auth dialog
    return null
  }

  const renderSignInAction = () => (
    <div className="space-y-3">
      <div className="omatrust-connect">
        <Button
          isConnectButton
          className="w-full"
          connectMode="all"
          connectButtonProps={{ label: "Sign In" }}
          connectOnConnect={() => beginAuthIntent({ kind: "signin" })}
        />
      </div>
      {activeAccount ? (
        <Button
          className="w-full"
          onClick={() => beginAuthIntent({ kind: "signin" })}
          disabled={isBootstrappingChallenge || isAuthenticating}
        >
          Continue Sign In
        </Button>
      ) : null}
    </div>
  )

  const renderAccountCreationActions = (requiresSubjectVerification: boolean) => {
    const managedIntent: AuthIntent = {
      kind: "signup",
      executionMode: "subscription",
      requiresSubjectVerification,
    }
    const nativeIntent: AuthIntent = {
      kind: "signup",
      executionMode: "native",
      requiresSubjectVerification,
    }

    const hasName = accountName.trim().length > 0

    return (
      <div className="space-y-3">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          {activeAccount ? (
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={!hasName || isBootstrappingChallenge || isAuthenticating}
              onClick={() => beginAuthIntent(managedIntent)}
            >
              Create Account
            </Button>
          ) : (
            <div className="omatrust-connect w-full sm:w-auto">
              <Button
                isConnectButton
                className="w-full sm:w-auto"
                disabled={!hasName || isBootstrappingChallenge || isAuthenticating}
                connectMode="all"
                connectButtonProps={{ label: "Create Account" }}
                connectOnConnect={() => beginAuthIntent(managedIntent)}
              />
            </div>
          )}

          {activeAccount ? (
            <button
              type="button"
              className="text-sm font-semibold text-primary transition hover:text-primary/85 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!hasName || isBootstrappingChallenge || isAuthenticating}
              onClick={() => beginAuthIntent(nativeIntent)}
            >
              Pay transactions with OMA tokens instead →
            </button>
          ) : (
            <div className="omatrust-inline-connect">
              <Button
                isConnectButton
                variant="link"
                disabled={!hasName || isBootstrappingChallenge || isAuthenticating}
                connectMode="native"
                connectButtonProps={{ label: "Pay transactions with OMA tokens instead →" }}
                connectOnConnect={() => beginAuthIntent(nativeIntent)}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  const isManagedWallet = walletProviderId === "inApp"
  const isSigningIn = authIntent?.kind === "signin"

  const renderBusyState = () => {
    if (!isBootstrappingChallenge && !isAuthenticating && !isVerifyingSubject && !isAddingSubject) {
      return null
    }

    if (isVerifyingSubject) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Verifying subject ownership…
        </div>
      )
    }

    if (isAddingSubject) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving subject to your account…
        </div>
      )
    }

    if (isManagedWallet) {
      return (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            {isSigningIn ? "Signing in…" : "Creating your account…"}
          </div>
        </div>
      )
    }

    // Self-custody wallet — needs to sign the SIWE message
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Check your wallet to continue
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {isSigningIn
            ? "Sign a message in your wallet app to verify ownership and sign in to your account. This is free — no gas required."
            : "Sign a message in your wallet app to verify ownership and create your account. This is free — no gas required."}
        </p>
      </div>
    )
  }

  const renderChooser = () => (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/80 bg-card p-5 shadow-sm shadow-slate-950/5">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">Existing account</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to your existing account with your wallet, email, or social login.
          </p>
          <div className="mt-4 space-y-4">
            {renderSignInAction()}
            {step === "chooser" ? renderConnectedWallet() : null}
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-5 shadow-sm shadow-slate-950/5">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">New account</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a new account to start using OMATrust.
          </p>
          <div className="mt-4">
            <Button className="w-full" onClick={goToCreateAccount}>
              Create Account
            </Button>
          </div>
        </div>
      </div>
      {renderBusyState()}
    </div>
  )

  const renderSignIn = () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/80 bg-card p-5 shadow-sm shadow-slate-950/5">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">Existing account</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to your existing account with your wallet, email, or social login.
        </p>
        <div className="mt-4 space-y-4">
          {renderSignInAction()}
          {renderConnectedWallet()}
        </div>
      </div>
      {renderBusyState()}
    </div>
  )

  const renderCreateSimple = () => (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <input
          id="displayName"
          value={accountName}
          onChange={(event) => setAccountName(event.target.value)}
          className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none transition focus:border-primary"
          placeholder="Your name or organization"
        />
      </div>

      {renderConnectedWallet()}
      {renderAccountCreationActions(false)}
      {renderBusyState()}

      {request.mode === "chooser" ? (
        <div className="flex justify-start">
          <Button type="button" variant="ghost" onClick={openChooser}>
            Back
          </Button>
        </div>
      ) : null}
    </div>
  )

  const renderCreateSubjectInfo = () => (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="organizationName">Organization name</Label>
        <input
          id="organizationName"
          value={accountName}
          onChange={(event) => setAccountName(event.target.value)}
          className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none transition focus:border-primary"
          placeholder="Example Inc."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="organizationUrl">Organization URL</Label>
        <input
          id="organizationUrl"
          value={subjectUrl}
          onChange={(event) => setSubjectUrl(event.target.value)}
          className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none transition focus:border-primary"
          placeholder="example.com"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        {request.mode === "chooser" ? (
          <Button type="button" variant="ghost" onClick={openChooser}>
            Back
          </Button>
        ) : (
          <div />
        )}
        <Button type="button" onClick={handleContinueSubjectInfo}>
          Continue
        </Button>
      </div>
    </div>
  )

  const renderVerificationInstructions = () => {
    if (!derivedDidWeb) {
      return null
    }

    if (verificationMethod === "dns") {
      return (
        <div className="muted-panel space-y-2 px-4 py-3 text-sm text-muted-foreground">
          <p>Add a TXT record at <span className="font-mono text-xs">_controllers.{subjectDomain}</span>.</p>
          <p className="break-all font-mono text-xs">
            v=1;controller={walletDid ?? "did:pkh:eip155:<chain-id>:0x..."}
          </p>
        </div>
      )
    }

    return (
      <div className="muted-panel space-y-2 px-4 py-3 text-sm text-muted-foreground">
        <p>Host a DID document at <span className="font-mono text-xs">https://{subjectDomain}/.well-known/did.json</span>.</p>
        <p className="break-all font-mono text-xs">
          controller: {walletDid ?? "did:pkh:eip155:<chain-id>:0x..."}
        </p>
      </div>
    )
  }

  const renderCreateSubjectVerify = () => (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/80 bg-card px-4 py-3 text-sm">
        <p className="font-medium text-foreground">{accountName.trim()}</p>
        <p className="mt-1 break-all font-mono text-xs tracking-wide text-muted-foreground">
          {derivedDidWeb ?? "did:web:example.com"}
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Proof method</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setVerificationMethod("dns")}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              verificationMethod === "dns"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-background text-foreground"
            }`}
          >
            DNS TXT
          </button>
          <button
            type="button"
            onClick={() => setVerificationMethod("didDocument")}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              verificationMethod === "didDocument"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-background text-foreground"
            }`}
          >
            did.json
          </button>
        </div>
      </div>

      {renderVerificationInstructions()}
      {renderConnectedWallet()}
      {renderAccountCreationActions(true)}
      {renderBusyState()}

      <div className="space-y-3">
        <Button
          type="button"
          className="w-full"
          disabled={!derivedDidWeb || !walletDid || !challengeIsReady || isVerifyingSubject || isAuthenticating || isAddingSubject}
          onClick={handleVerifySubject}
        >
          {verificationState === "verified" ? "Verified" : "Verify Ownership"}
        </Button>

        {verificationMessage ? (
          <div
            className={
              verificationState === "verified"
                ? "status-panel-success px-4 py-3 text-sm"
                : "status-panel-error px-4 py-3 text-sm"
            }
          >
            {verificationMessage}
          </div>
        ) : null}
      </div>

      <div className="flex justify-start">
        <Button type="button" variant="ghost" onClick={() => setStep("createSubjectInfo")}>
          Back
        </Button>
      </div>
    </div>
  )

  const renderReview = () => (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/80 bg-card p-4">
        <p className="font-medium text-foreground">
          {request.schemaTitle ? `Ready to publish ${request.schemaTitle}` : "You’re ready to continue"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account is active and the attestation is ready for signature and submission.
        </p>
      </div>

      {session?.wallet ? (
        <div className="rounded-xl border border-border/80 bg-muted/30 p-4 text-sm text-muted-foreground">
          <p>
            Execution mode: <span className="font-mono text-xs uppercase tracking-wide">{session.wallet.executionMode}</span>
          </p>
          <p className="mt-1">
            Wallet provider: <span className="font-mono text-xs">{session.wallet.walletProviderId ?? "unknown"}</span>
          </p>
          {subjectRecord?.canonicalDid || session.primarySubject?.canonicalDid ? (
            <p className="mt-1 break-all">
              Subject:{" "}
              <span className="font-mono text-xs">
                {subjectRecord?.canonicalDid ?? session.primarySubject?.canonicalDid}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" onClick={handleFinalSubmit} disabled={isSubmittingFinalStep}>
          {isSubmittingFinalStep ? "Submitting…" : "Submit Attestation"}
        </Button>
      </div>
    </div>
  )

  const renderSuccess = () => (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/80 bg-card p-5">
        <p className="font-medium text-foreground">Your OMATrust account is ready.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          You can start publishing trust data or move to the dashboard to manage trust for your own service.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Link href="/publish" onClick={closeDialog}>
          <Button className="w-full">Go to Publish</Button>
        </Link>
        <Link href="/dashboard" onClick={closeDialog}>
          <Button variant="outline" className="w-full">
            Open Dashboard
          </Button>
        </Link>
      </div>
    </div>
  )

  return (
    <Dialog open={request.open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="text-2xl">{getDialogTitle(step)}</DialogTitle>
          <DialogDescription className="sr-only">
            Connect a wallet, create an account, or verify subject ownership to continue with OMATrust.
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        {step === "chooser" ? renderChooser() : null}
        {step === "signin" ? renderSignIn() : null}
        {step === "createSimple" ? renderCreateSimple() : null}
        {step === "createSubjectInfo" ? renderCreateSubjectInfo() : null}
        {step === "createSubjectVerify" ? renderCreateSubjectVerify() : null}
        {step === "review" ? renderReview() : null}
        {step === "success" ? renderSuccess() : null}
      </DialogContent>
    </Dialog>
  )
}
