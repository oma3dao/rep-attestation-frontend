"use client"

import { FormEvent, useMemo, useState } from "react"
import { ShieldCheck, Search, XCircle, CheckCircle2 } from "lucide-react"
import { isSameControllerId } from "@oma3/omatrust/identity"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SubjectIdInput } from "@/components/SubjectIdInput"
import { LatestAttestations } from "@/components/latest-attestations"
import {
  getVerifiedAttestationsForDIDWithMetadata,
  sortByCategoryPriority,
  type EnrichedAttestationResult,
} from "@/lib/attestation-queries"
import {
  getControllerConfirmation,
  getPublicTrustAnchors,
  type ControllerConfirmResponse,
} from "@/lib/omatrust-backend"

/** Derived key authorization info for the simplified card. */
type KeyAuthorizationInfo = {
  subjectDid: string
  controllerDid: string
  sources: string[]
  basic: boolean
  intermediate: boolean
  advanced: boolean
}

type VerifyResult = {
  subjectDid: string
  canonicalDid: string
  attestations: EnrichedAttestationResult[]
  keyAuthorization: KeyAuthorizationInfo | null
  keyAuthorizationError: string | null
  /** Approved issuer addresses (lowercased) → set of schema IDs they're approved for */
  approvedIssuers: Map<string, Set<string>>
}

const TRUST_PROFILE_SCHEMAS = [
  { id: "user-review", label: "Reviews" },
  { id: "certification", label: "Certifications" },
  { id: "security-assessment", label: "Security Assessments" },
  { id: "controller-witness", label: "Controller Witnesses" },
  { id: "key-binding", label: "Key Bindings" },
]

function getSubjectType(did: string) {
  if (did.startsWith("did:web:")) return "Web Domain / URL"
  if (did.startsWith("did:pkh:")) return "Blockchain Address"
  if (did.startsWith("did:jwk:")) return "JWK Key"
  if (did.startsWith("did:handle:")) return "Social Handle"
  return "ID"
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge variant={ok ? "success" : "destructive"} className="gap-1">
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </Badge>
  )
}

function Signal({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-medium ${
      active
        ? "border-primary/25 bg-primary/10 text-primary"
        : "border-border bg-background text-muted-foreground"
    }`}>
      {label}: {active ? "Yes" : "No"}
    </span>
  )
}

/**
 * Build key authorization info from the backend controller-confirm response
 * and the attestation list — same logic as the dashboard's buildServiceKeys.
 */
function buildKeyAuthorization(
  controllerDid: string,
  subjectDid: string,
  confirmation: ControllerConfirmResponse,
  attestations: EnrichedAttestationResult[]
): KeyAuthorizationInfo {
  const sources: string[] = []
  let basic = false
  let intermediate = false
  let hasKeyBinding = false

  // Check if the controller is found in the backend's live evidence
  for (const key of confirmation.controllerKeys) {
    if (isSameControllerId(key.canonicalId, controllerDid)) {
      for (const source of key.sources) {
        const label = source === "dns-txt" ? "DNS TXT"
          : source === "did-json" ? "DID document"
          : source === "account-wallet" ? "Account wallet"
          : source
        if (!sources.includes(label)) sources.push(label)
      }
      basic = key.basic
      break
    }
  }

  // Check attestations for controller witnesses and key bindings
  for (const att of attestations) {
    if (att.schemaId === "controller-witness") {
      const witnessController = att.decodedData?.controller
      if (typeof witnessController === "string" && isSameControllerId(witnessController, controllerDid)) {
        intermediate = true
        if (!sources.includes("Controller witness")) sources.push("Controller witness")
      }
    }
    if (att.schemaId === "key-binding") {
      const keyId = att.decodedData?.keyId
      if (typeof keyId === "string" && isSameControllerId(keyId, controllerDid)) {
        hasKeyBinding = true
        if (!sources.includes("Key binding")) sources.push("Key binding")
      }
    }
  }

  const advanced = intermediate && hasKeyBinding

  return {
    subjectDid,
    controllerDid,
    sources,
    basic,
    intermediate,
    advanced,
  }
}

export default function VerifyPage() {
  const [subjectDid, setSubjectDid] = useState("")
  const [controllerDid, setControllerDid] = useState("")
  const [isArtifactMode, setIsArtifactMode] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VerifyResult | null>(null)

  const trustProfile = useMemo(() => {
    const attestations = result?.attestations ?? []
    return TRUST_PROFILE_SCHEMAS.map((schema) => ({
      ...schema,
      count: attestations.filter((attestation) => attestation.schemaId === schema.id).length,
    }))
  }, [result?.attestations])

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const subject = subjectDid.trim()
    const controller = controllerDid.trim()

    if (!subject) {
      setError("Select a service ID to verify.")
      return
    }

    setIsVerifying(true)
    setError(null)

    try {
      const [attestationsRaw, trustAnchorsResult] = await Promise.allSettled([
        getVerifiedAttestationsForDIDWithMetadata(subject),
        getPublicTrustAnchors(),
      ])

      // If the main attestation query failed, surface the error
      if (attestationsRaw.status === "rejected") {
        throw attestationsRaw.reason instanceof Error
          ? attestationsRaw.reason
          : new Error("Failed to fetch attestations.")
      }

      const attestations = sortByCategoryPriority(attestationsRaw.value)

      // Build approved issuers map from trust anchors
      const approvedIssuers = new Map<string, Set<string>>()
      if (trustAnchorsResult.status === "fulfilled") {
        for (const registry of trustAnchorsResult.value.registries) {
          if (registry.type === "approved-issuers") {
            for (const issuer of registry.issuers) {
              if (issuer.status !== "active") continue
              const key = issuer.address.toLowerCase()
              const existing = approvedIssuers.get(key) ?? new Set<string>()
              for (const schema of issuer.schemas) existing.add(schema)
              approvedIssuers.set(key, existing)
            }
          }
        }
      }

      let keyAuthorization: KeyAuthorizationInfo | null = null
      let keyAuthorizationError: string | null = null

      if (controller) {
        try {
          const confirmation = await getControllerConfirmation({ subjectDid: subject })
          keyAuthorization = buildKeyAuthorization(controller, subject, confirmation, attestations)
        } catch (err) {
          keyAuthorizationError = err instanceof Error
            ? err.message
            : "Controller authorization check failed."
        }
      }

      setResult({
        subjectDid: subject,
        canonicalDid: subject,
        attestations,
        keyAuthorization,
        keyAuthorizationError,
        approvedIssuers,
      })
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : "Verification failed.")
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Trust Verifier</h1>
        </div>
      </div>

      <form onSubmit={handleVerify} className="rounded-xl border border-border/70 bg-card/70 p-5 shadow-sm shadow-slate-950/5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-foreground">Service ID</label>
              <Badge variant="secondary">Required</Badge>
            </div>
            <SubjectIdInput
              value={subjectDid}
              onChange={(did) => setSubjectDid(did ?? "")}
              onMethodChange={(method) => setIsArtifactMode(method === "artifact")}
              allowedMethods={["web", "pkh", "jwk", "artifact"]}
              className="ml-0"
            />
          </div>

          {!isArtifactMode && (
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-foreground">Signing Key</label>
              <Badge variant="outline">Optional</Badge>
            </div>
            <SubjectIdInput
              value={controllerDid}
              onChange={(did) => setControllerDid(did ?? "")}
              allowedMethods={["jwk", "pkh"]}
              className="ml-0"
            />
          </div>
          )}
        </div>

        {error ? (
          <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={isVerifying || !subjectDid.trim()}>
            <Search className="h-4 w-4" />
            {isVerifying ? "Verifying..." : "Verify"}
          </Button>
        </div>
      </form>

      {result ? (
        <div className="mt-8 space-y-8">
          {controllerDid.trim() ? (
            <section className="rounded-xl border border-border/70 bg-card/70 p-5 shadow-sm shadow-slate-950/5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="technical-label text-primary">Signing Key Authorization</p>
                </div>
                {result.keyAuthorization ? (
                  <StatusBadge
                    ok={result.keyAuthorization.basic || result.keyAuthorization.intermediate || result.keyAuthorization.advanced}
                    label={result.keyAuthorization.basic || result.keyAuthorization.intermediate || result.keyAuthorization.advanced ? "Authorized" : "Not authorized"}
                  />
                ) : null}
              </div>

              {result.keyAuthorizationError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {result.keyAuthorizationError}
                </div>
              ) : result.keyAuthorization ? (
                <div className="rounded-xl border border-border/70 bg-background p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm text-foreground break-all">
                        <span className="font-bold">Service ID:</span>{' '}
                        <span className="font-mono text-xs">{result.keyAuthorization.subjectDid}</span>
                      </p>
                      <p className="text-sm text-foreground break-all">
                        <span className="font-bold">Key ID:</span>{' '}
                        <span className="font-mono text-xs">{result.keyAuthorization.controllerDid}</span>
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground/70">
                        Verification Methods: {result.keyAuthorization.sources.length > 0 ? result.keyAuthorization.sources.join(", ") : "None"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Signal active={result.keyAuthorization.basic} label="Basic" />
                      <Signal active={result.keyAuthorization.intermediate} label="Intermediate" />
                      <Signal active={result.keyAuthorization.advanced} label="Advanced" />
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-xl border border-border/70 bg-card/70 p-5 shadow-sm shadow-slate-950/5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="technical-label text-primary">Service Summary</p>
              </div>
              <Badge variant="secondary">{getSubjectType(result.subjectDid)}</Badge>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="min-w-0 rounded-lg border border-border/70 bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Service ID</p>
                <p className="mt-2 break-all font-mono text-sm">{result.subjectDid}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {trustProfile.map((item) => (
                <div key={item.id} className="rounded-lg border border-border/70 bg-background/60 p-4">
                  <p className="text-2xl font-semibold tracking-tight">{item.count}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="rounded-xl border border-border/70 bg-card/70 px-4 py-2 shadow-sm shadow-slate-950/5 sm:px-8">
              <div className="mb-3 pt-4">
                <p className="technical-label text-primary">Attestations</p>
              </div>
              <LatestAttestations
                showHeading={false}
                data={result.attestations}
                approvedIssuers={result.approvedIssuers}
                emptyMessage="No attestations found for this service."
              />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
