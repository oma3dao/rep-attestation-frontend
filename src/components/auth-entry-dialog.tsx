"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useActiveAccount, useActiveWallet, useConnectModal, useDisconnect } from "thirdweb/react"
import { client } from "@/app/client"
import { allWallets, nativeWallets } from "@/config/wallets"
import { clearWalletBrowserState } from "@/lib/wallet-cleanup"
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
  type BackendSessionMeResponse,
  type BackendSubject,
  buildWalletDid,
  createSubject,
  createWalletChallenge,
  deriveDidWebFromInput,
  deriveSubjectUrlHint,
  listSubjects,
  patchAccountMe,
  registerWalletSession,
  verifySubjectOwnership,
  type WalletExecutionMode,
  verifyWalletSession,
} from "@/lib/omatrust-backend"
import { getActiveChain } from "@/lib/blockchain"
import { defineChain } from "thirdweb/chains"

interface AuthEntryDialogProps {
  request: AuthDialogRequest
  onOpenChange: (open: boolean) => void
}

type WizardStep =
  | "chooser"
  | "signin"
  | "createSimple"
  | "setupSubject"
  | "authenticated"

type AuthIntent =
  | { kind: "signin" }
  | { kind: "signup"; executionMode: WalletExecutionMode }

type SubjectVerificationState = "idle" | "verified" | "failed"
type DidWebProofMethod = "dns" | "didDocument"

function getInitialStep(request: AuthDialogRequest): WizardStep {
  if (request.mode === "signin") return "signin"
  if (request.mode === "signup") return "createSimple"
  return "chooser"
}

function getDialogTitle(step: WizardStep) {
  switch (step) {
    case "createSimple": return "Create Account"
    case "setupSubject": return "Verify Subject Ownership"
    case "authenticated": return "Signed In"
    case "signin":
    case "chooser":
    default: return "Sign In"
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
      case "ACCOUNT_NOT_FOUND":
        return "No account found for this wallet. Please create an account first."
      case "ACCOUNT_ALREADY_EXISTS":
        return "This wallet already has an account. Please sign in instead."
      default:
        return error.message
    }
  }
  if (error instanceof Error) return error.message
  return "Something went wrong. Please try again."
}

function formatVerificationMethod(
  method: "dns" | "did-document" | "wallet" | "contract" | "minting-wallet" | "transfer" | null
) {
  switch (method) {
    case "dns": return "DNS TXT"
    case "did-document": return "did.json"
    case "wallet": return "wallet"
    case "contract": return "contract ownership"
    case "minting-wallet": return "minting wallet"
    case "transfer": return "transfer proof"
    default: return "verification"
  }
}

function getDomainFromDidWeb(didWeb: string | null) {
  return didWeb?.replace(/^did:web:/, "") ?? "example.com"
}

function needsSubjectSetup(
  request: AuthDialogRequest,
  currentSession: BackendSessionMeResponse | null
) {
  if (!request.reason || request.reason !== "submission" || !request.subjectScoped) return false
  if (!currentSession?.wallet?.did) return true
  const subjectDid = currentSession.primarySubject?.canonicalDid?.toLowerCase()
  const walletDid = currentSession.wallet.did.toLowerCase()
  return !subjectDid || subjectDid === walletDid
}

export function AuthEntryDialog({ request, onOpenChange }: AuthEntryDialogProps) {
  const { refreshSession, session, setSession } = useBackendSession()
  const activeAccount = useActiveAccount()
  const activeWallet = useActiveWallet()
  const { disconnect } = useDisconnect()
  const connectModal = useConnectModal()
  const router = useRouter()

  const isSubmissionFlow = request.reason === "submission"

  const [step, setStep] = useState<WizardStep>(getInitialStep(request))
  const [accountName, setAccountName] = useState("")
  const [subjectUrl, setSubjectUrl] = useState("")
  const [authIntent, setAuthIntent] = useState<AuthIntent | null>(null)
  const [verificationMethod, setVerificationMethod] = useState<DidWebProofMethod>("dns")
  const [verificationState, setVerificationState] = useState<SubjectVerificationState>("idle")
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null)
  const [isBootstrappingChallenge, setIsBootstrappingChallenge] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isVerifyingSubject, setIsVerifyingSubject] = useState(false)
  const [isAddingSubject, setIsAddingSubject] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const challengeFlowActiveRef = useRef(false)

  // Reset state when the dialog opens
  useEffect(() => {
    if (!request.open) return
    setStep(getInitialStep(request))
    setAccountName("")
    setSubjectUrl(deriveSubjectUrlHint(request.subjectHint))
    setAuthIntent(null)
    setVerificationMethod("dns")
    setVerificationState("idle")
    setVerificationMessage(null)
    setIsBootstrappingChallenge(false)
    setIsAuthenticating(false)
    setIsVerifyingSubject(false)
    setIsAddingSubject(false)
    setErrorMessage(null)
  }, [request])

  const derivedDidWeb = useMemo(() => deriveDidWebFromInput(subjectUrl), [subjectUrl])
  const activeChainId = getActiveChain().id
  const walletProviderId = activeWallet?.id ?? null
  const walletDid = activeAccount?.address
    ? buildWalletDid(activeAccount.address, activeChainId)
    : null
  const subjectDomain = getDomainFromDidWeb(derivedDidWeb)

  const closeDialog = () => { onOpenChange(false) }

  const resetFlowFeedback = () => {
    setErrorMessage(null)
    setVerificationState("idle")
    setVerificationMessage(null)
  }

  const goToCreateAccount = () => {
    resetFlowFeedback()
    setStep("createSimple")
  }

  const openChooser = () => {
    resetFlowFeedback()
    setAuthIntent(null)
    setStep("chooser")
  }

  const advanceAfterAuthenticatedFlow = useCallback((currentSession: BackendSessionMeResponse | null, intent: AuthIntent | null) => {
    // Submission flow — show success, user will close dialog and submit again
    if (isSubmissionFlow) {
      if (needsSubjectSetup(request, currentSession)) {
        setStep("setupSubject")
        return
      }
      setStep("authenticated")
      return
    }

    // Non-submission — navigate immediately
    if (intent?.kind === "signin" || request.mode === "signin") {
      router.push("/dashboard")
      return
    }
    router.push("/account")
  }, [isSubmissionFlow, request, router])

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

  /**
   * Ensure a wallet is connected, opening the Thirdweb modal if needed.
   * Returns the account and wallet, or null if the user canceled.
   */
  const ensureWalletConnected = async (mode: "all" | "native" = "all") => {
    // If already connected, use the current wallet
    if (activeAccount && activeWallet) {
      return { account: activeAccount, wallet: activeWallet }
    }

    // Open the Thirdweb wallet picker as an overlay
    try {
      // Clear stale wallet browser state before connecting.
      // No wallet is connected at this point, so IndexedDB connections are closed
      // and the delete succeeds immediately.
      clearWalletBrowserState()

      const wallet = await connectModal.connect({
        client,
        chain: defineChain({
          id: activeChainId,
        }),
        wallets: mode === "native" ? nativeWallets : allWallets,
        size: "wide",
        showThirdwebBranding: false,
        appMetadata: {
          name: "OMATrust Portal",
          url: "https://app.omatrust.org",
          description: "Publish trust data and manage service trust with OMATrust",
          logoUrl: "/oma3_logo.svg",
        },
      })

      // After connect resolves, the Thirdweb hooks will update.
      // The wallet object is returned directly — we can read the account from it.
      const account = wallet.getAccount()
      if (!account) {
        throw new Error("Wallet connected but no account available.")
      }
      return { account, wallet }
    } catch {
      // User closed the wallet picker without connecting
      return null
    }
  }

  /**
   * Imperative challenge → sign → verify flow.
   * Ensures a wallet is connected first via useConnectModal, then runs SIWE.
   */
  const performChallengeSignVerify = async (intent: AuthIntent) => {
    challengeFlowActiveRef.current = true
    setAuthIntent(intent)
    setIsBootstrappingChallenge(true)
    setErrorMessage(null)

    try {
      // Step 1: Ensure wallet is connected
      const walletMode = intent.kind === "signup" && intent.executionMode === "native" ? "native" : "all"
      const connected = await ensureWalletConnected(walletMode)
      if (!connected) {
        // User canceled the wallet picker
        setIsBootstrappingChallenge(false)
        return
      }

      const { account, wallet } = connected
      const connectedAddress = account.address
      const connectedWalletDid = buildWalletDid(connectedAddress, activeChainId)
      const connectedWalletProviderId = wallet.id

      // Step 2: Check managed wallet compatibility with native execution mode
      if (intent.kind === "signup" && intent.executionMode === "native" && connectedWalletProviderId === "inApp") {
        setErrorMessage(
          "The connected wallet is a managed wallet. Disconnect it in the wallet menu and choose a self-custody wallet to pay with OMA."
        )
        return
      }

      // Step 3: Get challenge from backend
      console.debug("[auth-entry-dialog] requesting challenge")
      const challenge = await createWalletChallenge({
        walletDid: connectedWalletDid,
        chainId: activeChainId,
        domain: window.location.host,
        uri: window.location.origin,
      })

      // Step 4: Sign SIWE message in wallet
      console.debug("[auth-entry-dialog] requesting wallet signature")
      const signature = await account.signMessage({
        message: challenge.siweMessage,
      })

      console.debug("[auth-entry-dialog] signature received, verifying session")
      setIsBootstrappingChallenge(false)
      setIsAuthenticating(true)

      // Step 5: Call the right backend endpoint based on intent
      const executionMode = intent.kind === "signup" ? intent.executionMode : null
      if (intent.kind === "signup") {
        await registerWalletSession({
          challengeId: challenge.challengeId,
          walletDid: connectedWalletDid,
          signature,
          siweMessage: challenge.siweMessage,
          walletProviderId: connectedWalletProviderId,
          executionMode,
        })

        // Only set display name for newly created accounts
        if (accountName.trim()) {
          await patchAccountMe({ displayName: accountName.trim() })
        }
      } else {
        await verifyWalletSession({
          challengeId: challenge.challengeId,
          walletDid: connectedWalletDid,
          signature,
          siweMessage: challenge.siweMessage,
          walletProviderId: connectedWalletProviderId,
        })
      }

      // Step 7: Hydrate session
      console.debug("[auth-entry-dialog] session verified, hydrating")
      const currentSession = await hydrateSessionAfterVerify()

      // Step 8: Advance the wizard
      advanceAfterAuthenticatedFlow(currentSession, intent)
      return currentSession
    } catch (error) {
      // If the user tried to create an account but one already exists,
      // switch to the sign-in view instead of showing an error in the create form.
      if (error instanceof BackendApiError && error.code === "ACCOUNT_ALREADY_EXISTS") {
        setErrorMessage(getFriendlyError(error))
        setAuthIntent(null)
        setStep("signin")
        return
      }

      // If the user tried to sign in but no account exists,
      // switch to the create account view.
      if (error instanceof BackendApiError && error.code === "ACCOUNT_NOT_FOUND") {
        setErrorMessage(getFriendlyError(error))
        setAuthIntent(null)
        setStep("createSimple")
        return
      }

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

  const handleVerifyAndAttachSubject = async () => {
    if (!walletDid) {
      setErrorMessage("Connect a wallet before verifying a subject.")
      return
    }

    if (!derivedDidWeb) {
      setErrorMessage("Enter a valid organization URL before verifying.")
      return
    }

    if (derivedDidWeb.toLowerCase() === walletDid.toLowerCase()) {
      setErrorMessage("Add a subject identifier that is different from your wallet DID.")
      return
    }

    setErrorMessage(null)
    setVerificationState("idle")
    setVerificationMessage(null)
    setIsVerifyingSubject(true)

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
        `Ownership verified via ${formatVerificationMethod(verification.method ?? null)}.`
      )
      setIsAddingSubject(true)

      let attachedSubject: BackendSubject | null = null

      try {
        const result = await createSubject({
          did: derivedDidWeb,
          displayName: accountName.trim() || session?.account.displayName || null,
        })
        attachedSubject = result.subject
      } catch (error) {
        if (error instanceof BackendApiError && error.code === "SUBJECT_ALREADY_EXISTS") {
          const existing = await listSubjects()
          attachedSubject =
            existing.subjects.find(
              (subject) => subject.canonicalDid.toLowerCase() === derivedDidWeb.toLowerCase()
            ) ?? null
        } else {
          throw error
        }
      }

      if (!attachedSubject) {
        throw new Error("The subject could not be attached to your account.")
      }

      const refreshedSession = await refreshSession()
      if (refreshedSession) {
        setSession(refreshedSession)
      }

      // Subject attached — show success, user will close dialog and submit again
      setStep("authenticated")
    } catch (error) {
      if (error instanceof BackendApiError) {
        if (error.status >= 500) {
          console.error("[auth-entry-dialog] subject verification service failed", {
            status: error.status,
            code: error.code,
            message: error.message,
            details: error.details,
            subjectDid: derivedDidWeb,
            walletDid,
          })
          setErrorMessage("There is a problem with the verification service. Please try again later.")
        } else {
          setErrorMessage(error.details || error.message)
        }
      } else {
        setErrorMessage(getFriendlyError(error))
      }
    } finally {
      setIsVerifyingSubject(false)
      setIsAddingSubject(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const isManagedWallet = walletProviderId === "inApp"
  const isSigningIn = authIntent?.kind === "signin"
  const isBusy = isBootstrappingChallenge || isAuthenticating || connectModal.isConnecting

  const renderBusyState = () => {
    if (!isBusy && !isVerifyingSubject && !isAddingSubject) return null

    if (isVerifyingSubject || isAddingSubject) {
      return (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            {isAddingSubject ? "Adding your subject…" : "Verifying subject ownership…"}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Keep this dialog open while we confirm control of your subject and attach it to your account.
          </p>
        </div>
      )
    }

    if (connectModal.isConnecting) {
      return (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Connecting wallet…
          </div>
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

    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Check your wallet to continue
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sign a message to verify wallert ownership. This is free — no gas required.
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
          <div className="mt-4">
            <Button
              className="w-full"
              disabled={isBusy}
              onClick={() => void performChallengeSignVerify({ kind: "signin" })}
            >
              Sign In
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-5 shadow-sm shadow-slate-950/5">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">New account</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a new account to start using OMATrust.
          </p>
          <div className="mt-4">
            <Button className="w-full" onClick={goToCreateAccount} disabled={isBusy}>
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
        <div className="mt-4">
          <Button
            className="w-full"
            disabled={isBusy}
            onClick={() => void performChallengeSignVerify({ kind: "signin" })}
          >
            Sign In
          </Button>
        </div>
      </div>
      {renderBusyState()}
    </div>
  )

  const renderCreateSimple = () => {
    const hasName = accountName.trim().length > 0

    return (
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

        <div className="space-y-3">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={!hasName || isBusy}
              onClick={() => void performChallengeSignVerify({ kind: "signup", executionMode: "subscription" })}
            >
              Create Account
            </Button>
            <button
              type="button"
              className="text-sm font-semibold text-primary transition hover:text-primary/85 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!hasName || isBusy}
              onClick={() => void performChallengeSignVerify({ kind: "signup", executionMode: "native" })}
            >
              Pay transactions with OMA tokens instead →
            </button>
          </div>
        </div>

        {renderBusyState()}

        {request.mode === "chooser" ? (
          <div className="flex justify-start">
            <Button type="button" variant="ghost" onClick={openChooser} disabled={isBusy}>
              Back
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  const renderSetupSubject = () => {
    const subjectReady = !!derivedDidWeb

    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <p className="font-medium text-foreground">Add your Subject Identifier.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This attestation needs a verified subject before it can be submitted. Add a URL you control for yourself or your organization.
          </p>
          {derivedDidWeb ? (
            <p className="mt-3 break-all text-xs text-muted-foreground">
              Subject: <span className="font-mono">{derivedDidWeb}</span>
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="subjectUrl">Organization URL</Label>
          <input
            id="subjectUrl"
            value={subjectUrl}
            onChange={(event) => {
              setSubjectUrl(event.target.value)
              setVerificationState("idle")
              setVerificationMessage(null)
              setErrorMessage(null)
            }}
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none transition focus:border-primary"
            placeholder="example.com"
          />
        </div>

        <div className="space-y-3 rounded-xl border border-border/80 bg-muted/30 p-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Verification method</p>
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

          {verificationMethod === "dns" ? (
            <>
              <p>
                Add a TXT record at <span className="font-mono text-xs">_controllers.{subjectDomain || "example.com"}</span>.
              </p>
              <p className="break-all font-mono text-xs">
                v=1;controller={walletDid ?? "did:pkh:eip155:<chain-id>:0x..."}
              </p>
            </>
          ) : (
            <>
              <p>
                Host a DID document at{" "}
                <span className="font-mono text-xs">
                  https://{subjectDomain || "example.com"}/.well-known/did.json
                </span>.
              </p>
              <p className="break-all font-mono text-xs">
                controller: {walletDid ?? "did:pkh:eip155:<chain-id>:0x..."}
              </p>
            </>
          )}
        </div>

        {verificationMessage ? (
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              verificationState === "verified"
                ? "border border-primary/20 bg-primary/5 text-foreground"
                : "border border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {verificationMessage}
          </div>
        ) : null}

        {renderBusyState()}

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => void handleVerifyAndAttachSubject()}
            disabled={!subjectReady || isVerifyingSubject || isAddingSubject}
          >
            Verify and Add Subject
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={request.open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl overflow-x-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">{getDialogTitle(step)}</DialogTitle>
          <DialogDescription className="sr-only">
            Connect a wallet, create an account, or continue with OMATrust.
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
        {step === "setupSubject" ? renderSetupSubject() : null}
        {step === "authenticated" ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <p className="font-medium text-foreground">You&apos;re signed in.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Close this dialog and click Submit Attestation to publish.
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={closeDialog}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
