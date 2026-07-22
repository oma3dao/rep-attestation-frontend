"use client"

import { FormEvent, useMemo, useState } from "react"
import { ShieldCheck, Search, XCircle, CheckCircle2, ChevronDown } from "lucide-react"
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
import { getActiveChain } from "@/lib/blockchain"
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
  artifact: EnrichedArtifactVerificationResult | null
}

type ResponsibilityClaimVerification = {
  valid: boolean
  responsibleParty: string
  controllerDid: string
  responsibilityTypes: string[]
  subjectLabel?: string
  checks: {
    schemaValid: boolean
    subjectMatches: boolean
    notRevoked: boolean
    currentlyEffective: boolean
    controllerAuthorized: boolean
  }
  reasons: string[]
}

type EnrichedVerifiedResponsibilityClaim = {
  attestation: EnrichedAttestationResult
  verification: ResponsibilityClaimVerification
}

type EnrichedArtifactVerificationResult = {
  artifactDid: string
  responsibilityClaims: EnrichedVerifiedResponsibilityClaim[]
  securityAssessments: EnrichedAttestationResult[]
  certifications: EnrichedAttestationResult[]
  otherAttestations: EnrichedAttestationResult[]
  allAttestations: EnrichedAttestationResult[]
}

const TRUST_PROFILE_SCHEMAS = [
  { id: "user-review", label: "Reviews" },
  { id: "responsibility-claim", label: "Responsibility Claims" },
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
  if (did.startsWith("did:artifact:")) return "Artifact"
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

function formatResponsibilityCheckName(name: keyof ResponsibilityClaimVerification["checks"]) {
  switch (name) {
    case "schemaValid": return "Schema valid"
    case "subjectMatches": return "Subject matches artifact"
    case "notRevoked": return "Not revoked"
    case "currentlyEffective": return "Currently effective"
    case "controllerAuthorized": return "Controller authorized"
    default: return name
  }
}

function getDecodedString(attestation: EnrichedAttestationResult, field: string) {
  const value = attestation.decodedData?.[field]
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : ""
}

function getDecodedStringArray(attestation: EnrichedAttestationResult, field: string) {
  const value = attestation.decodedData?.[field]
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === "string" && value.trim().length > 0) return [value.trim()]
  return []
}

function toTimestampSeconds(value: unknown) {
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "number") return value
  if (typeof value === "string" && value.trim().length > 0) return Number(value)
  return 0
}

function isCurrentlyEffective(attestation: EnrichedAttestationResult) {
  const now = Math.floor(Date.now() / 1000)
  const effectiveAt = toTimestampSeconds(attestation.decodedData?.effectiveAt)
  const expiresAt = toTimestampSeconds(attestation.decodedData?.expiresAt)
  const easExpiration = Number(attestation.expirationTime)

  const effectiveStarted = !effectiveAt || effectiveAt <= now
  const schemaNotExpired = !expiresAt || expiresAt > now
  const easNotExpired = !easExpiration || easExpiration > now

  return effectiveStarted && schemaNotExpired && easNotExpired
}

function isApprovedIssuerForSchema(
  attestation: EnrichedAttestationResult,
  schemaId: string,
  approvedIssuers: Map<string, Set<string>>
) {
  return approvedIssuers.get(attestation.attester.toLowerCase())?.has(schemaId) ?? false
}

function withIssuerPolicyVerification(
  attestation: EnrichedAttestationResult,
  artifactDid: string,
  approvedIssuers: Map<string, Set<string>>
): EnrichedAttestationResult {
  const schemaId = attestation.schemaId ?? ""
  const subject = getDecodedString(attestation, "subject")
  const checks = {
    subjectMatches: subject.toLowerCase() === artifactDid.toLowerCase(),
    notRevoked: attestation.revocationTime === 0,
    currentlyEffective: isCurrentlyEffective(attestation),
    attesterTrustedForSchema: isApprovedIssuerForSchema(attestation, schemaId, approvedIssuers),
  }
  const reasons: string[] = []

  if (!checks.subjectMatches) reasons.push("Attestation subject does not match this artifact DID.")
  if (!checks.notRevoked) reasons.push("Attestation has been revoked.")
  if (!checks.currentlyEffective) reasons.push("Attestation is not currently effective.")
  if (!checks.attesterTrustedForSchema) reasons.push("Attester is not approved for this schema in the trust policy.")

  return {
    ...attestation,
    verification: {
      valid: Object.values(checks).every(Boolean),
      checks,
      reasons,
    },
  }
}

async function verifyResponsibilityClaimForArtifact(
  attestation: EnrichedAttestationResult,
  artifactDid: string
): Promise<EnrichedVerifiedResponsibilityClaim> {
  const responsibleParty = getDecodedString(attestation, "responsibleParty")
  const subject = getDecodedString(attestation, "subject")
  const responsibilityTypes = getDecodedStringArray(attestation, "responsibilityType")
  const subjectLabel = getDecodedString(attestation, "subjectLabel")
  const controllerDid = `did:pkh:eip155:${getActiveChain().id}:${attestation.attester.toLowerCase()}`

  const checks = {
    schemaValid: attestation.schemaId === "responsibility-claim" && !!responsibleParty && !!subject && responsibilityTypes.length > 0,
    subjectMatches: subject.toLowerCase() === artifactDid.toLowerCase(),
    notRevoked: attestation.revocationTime === 0,
    currentlyEffective: isCurrentlyEffective(attestation),
    controllerAuthorized: false,
  }
  const reasons: string[] = []

  if (!checks.schemaValid) reasons.push("Responsibility claim is missing required fields.")
  if (!checks.subjectMatches) reasons.push("Responsibility claim subject does not match this artifact DID.")
  if (!checks.notRevoked) reasons.push("Responsibility claim has been revoked.")
  if (!checks.currentlyEffective) reasons.push("Responsibility claim is not currently effective.")

  if (responsibleParty) {
    try {
      const confirmation = await getControllerConfirmation({ subjectDid: responsibleParty })
      checks.controllerAuthorized = confirmation.controllerKeys.some((key) => (
        isSameControllerId(key.canonicalId, controllerDid)
      ))
      if (!checks.controllerAuthorized) {
        reasons.push("Attester is not an authorized controller for the responsible party.")
      }
    } catch (err) {
      reasons.push(err instanceof Error ? err.message : "Controller authorization check failed.")
    }
  }

  return {
    attestation,
    verification: {
      valid: Object.values(checks).every(Boolean),
      responsibleParty,
      controllerDid,
      responsibilityTypes,
      subjectLabel: subjectLabel || undefined,
      checks,
      reasons,
    },
  }
}

async function buildArtifactVerification(
  artifactDid: string,
  attestations: EnrichedAttestationResult[],
  approvedIssuers: Map<string, Set<string>>
): Promise<EnrichedArtifactVerificationResult> {
  const responsibilityClaims = await Promise.all(
    attestations
      .filter(attestation => attestation.schemaId === "responsibility-claim")
      .map(attestation => verifyResponsibilityClaimForArtifact(attestation, artifactDid))
  )
  const securityAssessments = attestations
    .filter(attestation => attestation.schemaId === "security-assessment")
    .map(attestation => withIssuerPolicyVerification(attestation, artifactDid, approvedIssuers))
  const certifications = attestations
    .filter(attestation => attestation.schemaId === "certification")
    .map(attestation => withIssuerPolicyVerification(attestation, artifactDid, approvedIssuers))
  const otherAttestations = attestations.filter(attestation => (
    attestation.schemaId !== "responsibility-claim" &&
    attestation.schemaId !== "security-assessment" &&
    attestation.schemaId !== "certification"
  ))

  return {
    artifactDid,
    responsibilityClaims,
    securityAssessments,
    certifications,
    otherAttestations,
    allAttestations: [
      ...responsibilityClaims.map(claim => claim.attestation),
      ...securityAssessments,
      ...certifications,
      ...otherAttestations,
    ],
  }
}

function ResponsibilityClaimCard({
  claim,
}: {
  claim: EnrichedArtifactVerificationResult["responsibilityClaims"][number]
}) {
  const { attestation, verification } = claim
  const date = new Date(attestation.time * 1000).toLocaleDateString()

  return (
    <div className="rounded-lg border border-border/70 bg-background/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">Responsibility Claim</p>
            <Badge variant={verification.valid ? "success" : "destructive"} className="gap-1">
              {verification.valid ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {verification.valid ? "Verified" : "Needs review"}
            </Badge>
          </div>
          <p className="break-all text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Responsible Party:</span>{" "}
            <span className="font-mono text-xs">{verification.responsibleParty || String(attestation.decodedData?.responsibleParty ?? "")}</span>
          </p>
          {verification.subjectLabel ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Subject Label:</span> {verification.subjectLabel}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {verification.responsibilityTypes.map((type) => (
              <Badge key={type} variant="secondary">{type}</Badge>
            ))}
          </div>
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">{date}</span>
      </div>

      <details className="group mt-4 rounded-md border border-border/70 bg-muted/30 p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">
          Verification checks
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(verification.checks).map(([name, passed]) => (
            <Badge key={name} variant={passed ? "success" : "secondary"}>
              {formatResponsibilityCheckName(name as keyof ResponsibilityClaimVerification["checks"])}
            </Badge>
          ))}
        </div>
        {verification.reasons.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {verification.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
      </details>
    </div>
  )
}

function ArtifactVerificationResults({
  result,
  approvedIssuers,
}: {
  result: EnrichedArtifactVerificationResult
  approvedIssuers: Map<string, Set<string>>
}) {
  const verifiedSecurityAssessments = result.securityAssessments.filter(att => att.verification?.valid).length

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border/70 bg-card/70 p-5 shadow-sm shadow-slate-950/5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="technical-label text-primary">Security Assessments Summary</p>
          <Badge variant={verifiedSecurityAssessments > 0 ? "success" : "secondary"}>
            {verifiedSecurityAssessments} verified
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/70 bg-background/60 p-4">
            <p className="text-2xl font-semibold tracking-tight">{result.securityAssessments.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">Total security assessments</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/60 p-4">
            <p className="text-2xl font-semibold tracking-tight">{verifiedSecurityAssessments}</p>
            <p className="mt-1 text-sm text-muted-foreground">Trusted issuer assessments</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-card/70 p-5 shadow-sm shadow-slate-950/5 sm:p-6">
        <div className="mb-5">
          <p className="technical-label text-primary">Responsibility Claims</p>
        </div>
        {result.responsibilityClaims.length > 0 ? (
          <div className="space-y-3">
            {result.responsibilityClaims.map((claim) => (
              <ResponsibilityClaimCard key={claim.attestation.uid} claim={claim} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No responsibility claims found for this artifact.</p>
        )}
      </section>

      <section className="rounded-xl border border-border/70 bg-card/70 px-4 py-2 shadow-sm shadow-slate-950/5 sm:px-8">
        <div className="mb-3 pt-4">
          <p className="technical-label text-primary">Certifications</p>
        </div>
        <LatestAttestations
          showHeading={false}
          data={result.certifications}
          approvedIssuers={approvedIssuers}
          emptyMessage="No certifications found for this artifact."
        />
      </section>

      <section className="rounded-xl border border-border/70 bg-card/70 px-4 py-2 shadow-sm shadow-slate-950/5 sm:px-8">
        <div className="mb-3 pt-4">
          <p className="technical-label text-primary">Other Attestations</p>
        </div>
        <LatestAttestations
          showHeading={false}
          data={result.otherAttestations}
          approvedIssuers={approvedIssuers}
          emptyMessage="No other attestations found for this artifact."
        />
      </section>
    </div>
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
    const schemas = result?.artifact
      ? TRUST_PROFILE_SCHEMAS.filter(schema => schema.id !== "responsibility-claim")
      : TRUST_PROFILE_SCHEMAS

    return schemas.map((schema) => ({
      ...schema,
      count: attestations.filter((attestation) => attestation.schemaId === schema.id).length,
    }))
  }, [result?.attestations, result?.artifact])
  const effectiveArtifactMode = isArtifactMode || subjectDid.trim().startsWith("did:artifact:")

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
      const artifactMode = subject.startsWith("did:artifact:")
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

      const baseAttestations = sortByCategoryPriority(attestationsRaw.value)

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
      const artifact = artifactMode
        ? await buildArtifactVerification(subject, baseAttestations, approvedIssuers)
        : null
      const attestations = artifact ? sortByCategoryPriority(artifact.allAttestations) : baseAttestations

      if (controller && !artifactMode) {
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
        artifact,
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

          {!effectiveArtifactMode && (
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

          {result.artifact ? (
            <ArtifactVerificationResults result={result.artifact} approvedIssuers={result.approvedIssuers} />
          ) : (
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
          )}
        </div>
      ) : null}
    </div>
  )
}
