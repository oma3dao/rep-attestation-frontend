"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DidWebInput } from "@/components/did-web-input"
import { Caip10Input } from "@/components/caip10-input"
import { DidHandleInput } from "@/components/did-handle-input"
import { DidKeyInput } from "@/components/did-key-input"
import {
  BackendApiError,
  createSubject,
  type BackendSubject,
  type SubjectVerificationMethod,
  verifySubjectOwnership,
} from "@/lib/omatrust-backend"

type SupportedDidMethod = "did:web" | "did:pkh" | "did:handle" | "did:key"
type DidWebProofMethod = "dns" | "didDocument"

interface SubjectConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  walletDid: string | null
  existingSubjectDids: string[]
  onSubjectCreated: (subject: BackendSubject) => void
  initialMessage?: string | null
}

function getDidMethod(value: string): SupportedDidMethod | "" {
  if (value.startsWith("did:web:")) return "did:web"
  if (value.startsWith("did:pkh:")) return "did:pkh"
  if (value.startsWith("did:handle:")) return "did:handle"
  if (value.startsWith("did:key:")) return "did:key"
  return ""
}

function extractDidWebDomain(did: string | null) {
  return did?.startsWith("did:web:") ? did.replace(/^did:web:/, "") : ""
}

function formatVerificationMethod(method: SubjectVerificationMethod) {
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

export function SubjectConfirmationDialog({
  open,
  onOpenChange,
  walletDid,
  existingSubjectDids,
  onSubjectCreated,
  initialMessage,
}: SubjectConfirmationDialogProps) {
  const [subjectDid, setSubjectDid] = useState("")
  const [selectedMethod, setSelectedMethod] = useState<SupportedDidMethod>("did:web")
  const [didWebProofMethod, setDidWebProofMethod] = useState<DidWebProofMethod>("dns")
  const [verificationState, setVerificationState] = useState<"idle" | "verified" | "failed">("idle")
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(initialMessage ?? null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setSubjectDid("")
      setSelectedMethod("did:web")
      setDidWebProofMethod("dns")
      setVerificationState("idle")
      setVerificationMessage(null)
      setErrorMessage(null)
      setIsVerifying(false)
      setIsSubmitting(false)
    } else if (initialMessage) {
      setErrorMessage(initialMessage)
    }
  }, [open, initialMessage])

  const currentMethod = useMemo(() => {
    const inferred = getDidMethod(subjectDid)
    return inferred || selectedMethod
  }, [selectedMethod, subjectDid])

  const caip10Value = subjectDid.startsWith("did:pkh:") ? subjectDid.replace("did:pkh:", "") : ""
  const subjectDomain = extractDidWebDomain(subjectDid)
  const normalizedExistingDids = useMemo(
    () => new Set(existingSubjectDids.map((did) => did.toLowerCase())),
    [existingSubjectDids]
  )

  const unsupportedMethodMessage =
    currentMethod === "did:handle"
      ? "Social-handle confirmation is not available in the portal yet. Use a web domain or blockchain subject for now."
      : currentMethod === "did:key"
        ? "did:key confirmation is not available in the portal yet. Use a web domain or blockchain subject for now."
        : null

  function handleDidMethodChange(method: SupportedDidMethod) {
    setSelectedMethod(method)
    setSubjectDid("")
    setVerificationState("idle")
    setVerificationMessage(null)
    setErrorMessage(null)
  }

  function setDidValue(nextDid: string | null) {
    setSubjectDid(nextDid ?? "")
    setVerificationState("idle")
    setVerificationMessage(null)
    setErrorMessage(null)
  }

  async function handleVerify() {
    if (!walletDid) {
      setErrorMessage("Connect your wallet before verifying a subject.")
      return
    }

    if (!subjectDid) {
      setErrorMessage("Enter a subject identifier before verifying.")
      return
    }

    if (unsupportedMethodMessage) {
      setErrorMessage(unsupportedMethodMessage)
      return
    }

    if (subjectDid.toLowerCase() === walletDid.toLowerCase()) {
      setErrorMessage("This matches your default wallet subject. Add a separate subject identifier instead.")
      return
    }

    if (normalizedExistingDids.has(subjectDid.toLowerCase())) {
      setErrorMessage("This subject is already attached to your account.")
      return
    }

    setIsVerifying(true)
    setErrorMessage(null)
    setVerificationState("idle")
    setVerificationMessage(null)

    try {
      const verification = await verifySubjectOwnership({
        subjectDid,
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
    } catch (error) {
      setVerificationState("failed")
      setVerificationMessage(null)
      if (error instanceof BackendApiError) {
        console.error("[subject-confirmation] verification request failed", {
          status: error.status,
          code: error.code,
          message: error.message,
          details: error.details,
          subjectDid,
          walletDid,
        })
        setErrorMessage(
          error.status >= 500
            ? "There is a problem with the verification service. Please try again later."
            : error.details || error.message
        )
      } else {
        setErrorMessage(error instanceof Error ? error.message : "Failed to verify subject ownership.")
      }
    } finally {
      setIsVerifying(false)
    }
  }

  async function handleSubmit() {
    if (!subjectDid) {
      setErrorMessage("Enter a subject identifier before submitting.")
      return
    }

    if (verificationState !== "verified") {
      setErrorMessage("Verify ownership before adding this subject.")
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await createSubject({ did: subjectDid })
      onSubjectCreated(result.subject)
      onOpenChange(false)
    } catch (error) {
      if (error instanceof BackendApiError) {
        console.error("[subject-confirmation] subject create failed", {
          status: error.status,
          code: error.code,
          message: error.message,
          details: error.details,
          subjectDid,
          walletDid,
        })
        setErrorMessage(error.details || error.message)
      } else {
        setErrorMessage(error instanceof Error ? error.message : "Failed to add subject.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function renderSubjectInput() {
    if (currentMethod === "did:web") {
      return <DidWebInput value={subjectDid} onChange={setDidValue} />
    }

    if (currentMethod === "did:pkh") {
      return (
        <Caip10Input
          value={caip10Value}
          onChange={(caip10) => setDidValue(caip10 ? `did:pkh:${caip10}` : null)}
        />
      )
    }

    if (currentMethod === "did:handle") {
      return <DidHandleInput value={subjectDid} onChange={setDidValue} />
    }

    return <DidKeyInput value={subjectDid} onChange={setDidValue} />
  }

  function renderInstructions() {
    if (currentMethod === "did:web") {
      return (
        <div className="space-y-3 rounded-xl border border-border/80 bg-muted/30 p-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Verification method</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDidWebProofMethod("dns")}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  didWebProofMethod === "dns"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-background text-foreground"
                }`}
              >
                DNS TXT
              </button>
              <button
                type="button"
                onClick={() => setDidWebProofMethod("didDocument")}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  didWebProofMethod === "didDocument"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-background text-foreground"
                }`}
              >
                did.json
              </button>
            </div>
          </div>

          {didWebProofMethod === "dns" ? (
            <>
              <p>Add a TXT record at <span className="font-mono text-xs">_controllers.{subjectDomain || "example.com"}</span>.</p>
              <p className="break-all font-mono text-xs">
                v=1;controller={walletDid ?? "did:pkh:eip155:<chain-id>:0x..."}
              </p>
            </>
          ) : (
            <>
              <p>Host a DID document at <span className="font-mono text-xs">https://{subjectDomain || "example.com"}/.well-known/did.json</span>.</p>
              <p className="break-all font-mono text-xs">
                controller: {walletDid ?? "did:pkh:eip155:<chain-id>:0x..."}
              </p>
            </>
          )}
        </div>
      )
    }

    if (currentMethod === "did:pkh") {
      return (
        <div className="space-y-2 rounded-xl border border-border/80 bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">How verification works</p>
          <p>
            The wallet you are signed in with must either match this subject DID directly or control the contract through a standard ownership pattern such as <span className="font-mono text-xs">owner()</span>, <span className="font-mono text-xs">admin()</span>, or <span className="font-mono text-xs">getOwner()</span>.
          </p>
        </div>
      )
    }

    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {unsupportedMethodMessage}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Verify Subject Ownership</DialogTitle>
          <DialogDescription>
            Choose a DID method, confirm ownership, and then submit the subject to your account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="subject-did-method">DID method</Label>
            <Select value={selectedMethod} onValueChange={(value) => handleDidMethodChange(value as SupportedDidMethod)}>
              <SelectTrigger id="subject-did-method">
                <SelectValue placeholder="Select a DID method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="did:web">did:web</SelectItem>
                <SelectItem value="did:pkh">did:pkh</SelectItem>
                <SelectItem value="did:handle">did:handle</SelectItem>
                <SelectItem value="did:key">did:key</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {renderSubjectInput()}
          {renderInstructions()}

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

          {errorMessage ? (
            <div className="status-panel-error px-4 py-3 text-sm">{errorMessage}</div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleVerify}
              disabled={isVerifying || isSubmitting || !subjectDid}
            >
              {isVerifying ? "Verifying…" : verificationState === "verified" ? "Verified" : "Verify"}
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || verificationState !== "verified"}
            >
              {isSubmitting ? "Adding Subject…" : "Submit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
