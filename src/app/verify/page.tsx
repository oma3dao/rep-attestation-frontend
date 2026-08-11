"use client"

import { FormEvent, useMemo, useRef, useState } from "react"
import {
  Search,
  Upload,
  X,
  XCircle,
  CheckCircle2,
  ChevronDown,
} from "lucide-react"
import {
  isSameControllerId,
  artifactDidFromJson,
  artifactDidFromBytes,
} from "@oma3/omatrust/identity"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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

type DidMethod = "web" | "pkh" | "jwk" | "handle" | "artifact" | "key" | "unknown"

type TrustScore = {
  value: number
  max: number
  label: string
  detail: string
}

type AuthorizedParty = {
  id: string
  label: string
  sources: string[]
  basic: boolean
  intermediate: boolean
  advanced: boolean
}

type WebsiteClaim = {
  website: string
  domain: string
  responsibilityTypes: string[]
  subjectLabel?: string
  valid: boolean
  reasons: string[]
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
  websiteClaims: WebsiteClaim[]
}

type VerifyResult = {
  query: string
  subjectDid: string
  method: DidMethod
  score: TrustScore
  attestations: EnrichedAttestationResult[]
  approvedIssuers: Map<string, Set<string>>
  authorizedParties: AuthorizedParty[]
  authorizationError: string | null
  artifact: EnrichedArtifactVerificationResult | null
}

function detectDidMethod(did: string): DidMethod {
  if (did.startsWith("did:web:")) return "web"
  if (did.startsWith("did:pkh:")) return "pkh"
  if (did.startsWith("did:jwk:")) return "jwk"
  if (did.startsWith("did:handle:")) return "handle"
  if (did.startsWith("did:artifact:")) return "artifact"
  if (did.startsWith("did:key:")) return "key"
  return "unknown"
}

function getSubjectTypeLabel(method: DidMethod) {
  switch (method) {
    case "web": return "Web Domain / URL"
    case "pkh": return "Blockchain Address"
    case "jwk": return "JWK Key"
    case "handle": return "Social Handle"
    case "artifact": return "Artifact"
    case "key": return "Key"
    default: return "ID"
  }
}

function sourceLabel(source: string) {
  if (source === "dns-txt") return "DNS TXT"
  if (source === "did-json") return "DID document"
  if (source === "account-wallet") return "Account wallet"
  return source
}

/** Resolve free-text or DID input into a canonical DID when possible. */
function resolveQueryToDid(raw: string, chainId: number): string | null {
  const query = raw.trim()
  if (!query) return null

  if (query.startsWith("did:")) return query

  if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
    return `did:pkh:eip155:${chainId}:${query.toLowerCase()}`
  }

  const withoutProtocol = query.replace(/^https?:\/\//i, "").replace(/\/+$/, "")
  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:].*)?$/i.test(withoutProtocol)) {
    return `did:web:${withoutProtocol.replace(/\//g, ":")}`
  }

  return query
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

function domainFromDidWeb(did: string) {
  if (!did.startsWith("did:web:")) return did
  return did.slice("did:web:".length).split(":")[0]
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function computeScore(params: {
  method: DidMethod
  attestations: EnrichedAttestationResult[]
  authorizedParties: AuthorizedParty[]
  artifact: EnrichedArtifactVerificationResult | null
}): TrustScore {
  const { method, attestations, authorizedParties, artifact } = params

  if (method === "pkh") {
    const hasBasic = authorizedParties.some((party) => party.basic)
    const hasIntermediate = authorizedParties.some((party) => party.intermediate)
    const hasAdvanced = authorizedParties.some((party) => party.advanced)
    let value = authorizedParties.length > 0 ? 25 : 0
    if (hasBasic) value += 25
    if (hasIntermediate) value += 25
    if (hasAdvanced) value += 25
    value = clampScore(value)
    return {
      value,
      max: 100,
      label: hasAdvanced ? "Strong authorization" : hasIntermediate ? "Witnessed" : hasBasic ? "Basic authorization" : authorizedParties.length ? "Partial" : "No authorization",
      detail: authorizedParties.length
        ? `${authorizedParties.length} authorizing part${authorizedParties.length === 1 ? "y" : "ies"} found`
        : "No authorizing party found for this contract or key",
    }
  }

  if (method === "artifact" && artifact) {
    const verifiedClaims = artifact.websiteClaims.filter((claim) => claim.valid).length
    const verifiedAssessments = artifact.securityAssessments.filter((att) => att.verification?.valid).length
    const verifiedCerts = artifact.certifications.filter((att) => att.verification?.valid).length
    const value = clampScore(verifiedClaims * 30 + verifiedAssessments * 20 + verifiedCerts * 15)
    return {
      value,
      max: 100,
      label: verifiedClaims > 0 ? "Claimed" : value > 0 ? "Assessed" : "Unclaimed",
      detail: verifiedClaims > 0
        ? `${verifiedClaims} verified website claim${verifiedClaims === 1 ? "" : "s"}`
        : "No verified website claims yet",
    }
  }

  const reviews = attestations.filter((att) => att.schemaId === "user-review").length
  const certs = attestations.filter((att) => att.schemaId === "certification").length
  const assessments = attestations.filter((att) => att.schemaId === "security-assessment").length
  const witnesses = attestations.filter((att) => att.schemaId === "controller-witness").length
  const bindings = attestations.filter((att) => att.schemaId === "key-binding").length
  const value = clampScore(bindings * 20 + witnesses * 20 + assessments * 15 + certs * 15 + Math.min(reviews, 5) * 4)

  return {
    value,
    max: 100,
    label: value >= 70 ? "Strong" : value >= 40 ? "Moderate" : value > 0 ? "Emerging" : "No signals",
    detail: `${attestations.length} attestation${attestations.length === 1 ? "" : "s"} in trust profile`,
  }
}

function buildAuthorizedParties(
  subjectDid: string,
  confirmation: ControllerConfirmResponse | null,
  attestations: EnrichedAttestationResult[]
): AuthorizedParty[] {
  const parties = new Map<string, AuthorizedParty>()

  const upsert = (id: string, patch: Partial<AuthorizedParty>) => {
    const existing = parties.get(id.toLowerCase()) ?? {
      id,
      label: id,
      sources: [],
      basic: false,
      intermediate: false,
      advanced: false,
    }
    const sources = [...existing.sources]
    for (const source of patch.sources ?? []) {
      if (!sources.includes(source)) sources.push(source)
    }
    parties.set(id.toLowerCase(), {
      ...existing,
      ...patch,
      id: existing.id || id,
      sources,
      basic: existing.basic || !!patch.basic,
      intermediate: existing.intermediate || !!patch.intermediate,
      advanced: existing.advanced || !!patch.advanced,
    })
  }

  if (confirmation) {
    for (const key of confirmation.controllerKeys) {
      upsert(key.canonicalId || key.id, {
        id: key.canonicalId || key.id,
        label: key.label || key.canonicalId || key.id,
        sources: key.sources.map(sourceLabel),
        basic: key.basic,
      })
    }
  }

  for (const att of attestations) {
    if (att.revocationTime > 0) continue

    if (att.schemaId === "controller-witness") {
      const controller = getDecodedString(att, "controller")
      const subject = getDecodedString(att, "subject")
      // Attestation about this subject authorizing a controller, or this key being witnessed for a service
      if (
        controller &&
        (isSameControllerId(subject, subjectDid) || isSameControllerId(controller, subjectDid))
      ) {
        const partyId = isSameControllerId(controller, subjectDid) ? subject || att.attester : controller
        upsert(partyId, {
          id: partyId,
          label: partyId,
          sources: ["Controller witness"],
          intermediate: true,
        })
      }
    }

    if (att.schemaId === "key-binding") {
      const keyId = getDecodedString(att, "keyId")
      const subject = getDecodedString(att, "subject")
      if (
        keyId &&
        (isSameControllerId(subject, subjectDid) || isSameControllerId(keyId, subjectDid))
      ) {
        const partyId = isSameControllerId(keyId, subjectDid) ? subject || att.attester : keyId
        const existing = parties.get(partyId.toLowerCase())
        upsert(partyId, {
          id: partyId,
          label: partyId,
          sources: ["Key binding"],
          advanced: !!existing?.intermediate,
        })
      }
    }
  }

  // Advanced = intermediate + key binding on same party
  for (const [key, party] of parties) {
    const hasWitness = party.sources.includes("Controller witness") || party.intermediate
    const hasBinding = party.sources.includes("Key binding")
    if (hasWitness && hasBinding) {
      parties.set(key, { ...party, intermediate: true, advanced: true })
    }
  }

  return Array.from(parties.values())
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
      .filter((attestation) => attestation.schemaId === "responsibility-claim")
      .map((attestation) => verifyResponsibilityClaimForArtifact(attestation, artifactDid))
  )
  const securityAssessments = attestations
    .filter((attestation) => attestation.schemaId === "security-assessment")
    .map((attestation) => withIssuerPolicyVerification(attestation, artifactDid, approvedIssuers))
  const certifications = attestations
    .filter((attestation) => attestation.schemaId === "certification")
    .map((attestation) => withIssuerPolicyVerification(attestation, artifactDid, approvedIssuers))
  const otherAttestations = attestations.filter((attestation) => (
    attestation.schemaId !== "responsibility-claim" &&
    attestation.schemaId !== "security-assessment" &&
    attestation.schemaId !== "certification"
  ))

  const websiteClaims: WebsiteClaim[] = responsibilityClaims
    .filter((claim) => claim.verification.responsibleParty.startsWith("did:web:"))
    .map((claim) => ({
      website: claim.verification.responsibleParty,
      domain: domainFromDidWeb(claim.verification.responsibleParty),
      responsibilityTypes: claim.verification.responsibilityTypes,
      subjectLabel: claim.verification.subjectLabel,
      valid: claim.verification.valid,
      reasons: claim.verification.reasons,
    }))

  return {
    artifactDid,
    responsibilityClaims,
    securityAssessments,
    certifications,
    otherAttestations,
    allAttestations: [
      ...responsibilityClaims.map((claim) => claim.attestation),
      ...securityAssessments,
      ...certifications,
      ...otherAttestations,
    ],
    websiteClaims,
  }
}

function ScoreHero({ score, method }: { score: TrustScore; method: DidMethod }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-end sm:text-left">
      <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(score.value / score.max) * 264} 264`}
            className="transition-[stroke-dasharray] duration-700 ease-out"
          />
        </svg>
        <div className="relative text-center">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{score.value}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">/ {score.max}</p>
        </div>
      </div>
      <div className="min-w-0 space-y-1">
        <Badge variant="secondary">{getSubjectTypeLabel(method)}</Badge>
        <p className="text-xl font-semibold tracking-tight text-foreground">{score.label}</p>
        <p className="text-sm text-muted-foreground">{score.detail}</p>
      </div>
    </div>
  )
}

function AuthorizedPartiesSection({ parties, error }: { parties: AuthorizedParty[]; error: string | null }) {
  return (
    <section className="space-y-4">
      <div>
        <p className="technical-label text-primary">Who authorized this</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Controllers and services that authorized this contract or key.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {parties.length > 0 ? (
        <ul className="space-y-3">
          {parties.map((party) => (
            <li key={party.id} className="rounded-lg border border-border/70 bg-background/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="break-all font-mono text-sm text-foreground">{party.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {party.sources.length > 0 ? party.sources.join(", ") : "No verification methods"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {party.basic ? <Badge variant="success">Basic</Badge> : null}
                  {party.intermediate ? <Badge variant="success">Intermediate</Badge> : null}
                  {party.advanced ? <Badge variant="success">Advanced</Badge> : null}
                  {!party.basic && !party.intermediate && !party.advanced ? (
                    <Badge variant="secondary">Listed</Badge>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : !error ? (
        <p className="text-sm text-muted-foreground">No authorizing parties found.</p>
      ) : null}
    </section>
  )
}

function WebsiteClaimsSection({ claims }: { claims: WebsiteClaim[] }) {
  return (
    <section className="space-y-4">
      <div>
        <p className="technical-label text-primary">Websites that claim this</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Domains with responsibility claims for this artifact.
        </p>
      </div>

      {claims.length > 0 ? (
        <ul className="space-y-3">
          {claims.map((claim) => (
            <li key={`${claim.website}-${claim.responsibilityTypes.join(",")}`} className="rounded-lg border border-border/70 bg-background/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <p className="text-lg font-medium text-foreground">{claim.domain}</p>
                  <p className="break-all font-mono text-xs text-muted-foreground">{claim.website}</p>
                  {claim.subjectLabel ? (
                    <p className="text-sm text-muted-foreground">{claim.subjectLabel}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-1.5">
                    {claim.responsibilityTypes.map((type) => (
                      <Badge key={type} variant="secondary">{type}</Badge>
                    ))}
                  </div>
                  {claim.reasons.length > 0 ? (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {claim.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <Badge variant={claim.valid ? "success" : "destructive"} className="gap-1">
                  {claim.valid ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {claim.valid ? "Verified" : "Needs review"}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No websites claim this artifact yet.</p>
      )}
    </section>
  )
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

function ArtifactDetails({
  result,
  approvedIssuers,
}: {
  result: EnrichedArtifactVerificationResult
  approvedIssuers: Map<string, Set<string>>
}) {
  const verifiedSecurityAssessments = result.securityAssessments.filter((att) => att.verification?.valid).length

  return (
    <div className="space-y-8">
      <WebsiteClaimsSection claims={result.websiteClaims} />

      <section className="space-y-3">
        <p className="technical-label text-primary">Security Assessments</p>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-border/70 bg-background/60 px-4 py-3">
            <p className="text-2xl font-semibold tracking-tight">{result.securityAssessments.length}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/60 px-4 py-3">
            <p className="text-2xl font-semibold tracking-tight">{verifiedSecurityAssessments}</p>
            <p className="text-sm text-muted-foreground">
              <span className="sr-only">{verifiedSecurityAssessments} </span>
              verified
            </p>
          </div>
        </div>
      </section>

      {result.responsibilityClaims.some((claim) => !claim.verification.responsibleParty.startsWith("did:web:")) ? (
        <section className="space-y-3">
          <p className="technical-label text-primary">Other responsibility claims</p>
          <div className="space-y-3">
            {result.responsibilityClaims
              .filter((claim) => !claim.verification.responsibleParty.startsWith("did:web:"))
              .map((claim) => (
                <ResponsibilityClaimCard key={claim.attestation.uid} claim={claim} />
              ))}
          </div>
        </section>
      ) : null}

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

export default function VerifyPage() {
  const [query, setQuery] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)
  const [isProcessingFile, setIsProcessingFile] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const detectedMethod = useMemo(() => {
    const resolved = resolveQueryToDid(query, getActiveChain().id)
    return resolved ? detectDidMethod(resolved) : null
  }, [query])

  const handleFileSelect = async (file: File) => {
    setFileName(file.name)
    setIsProcessingFile(true)
    setError(null)

    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      const textExtensions = [".json", ".md", ".txt", ".yaml", ".yml", ".toml", ".xml", ".csv", ".html", ".css", ".js", ".ts"]
      const isTextFile = textExtensions.some((ext) => file.name.toLowerCase().endsWith(ext)) || file.type.startsWith("text/")

      let did: string
      if (isTextFile) {
        const text = new TextDecoder().decode(bytes)
        try {
          JSON.parse(text)
          did = await artifactDidFromJson(text)
        } catch {
          did = await artifactDidFromBytes(bytes)
        }
      } else {
        did = await artifactDidFromBytes(bytes)
      }

      setQuery(did)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process file")
      setFileName(null)
    } finally {
      setIsProcessingFile(false)
    }
  }

  const clearFile = () => {
    setFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const runVerify = async (rawQuery: string) => {
    const resolved = resolveQueryToDid(rawQuery, getActiveChain().id)
    if (!resolved) {
      setError("Enter a DID, address, domain, or upload a file.")
      return
    }

    setIsVerifying(true)
    setError(null)

    try {
      const method = detectDidMethod(resolved)
      const artifactMode = method === "artifact"

      const [attestationsRaw, trustAnchorsResult, confirmationResult] = await Promise.allSettled([
        getVerifiedAttestationsForDIDWithMetadata(resolved),
        getPublicTrustAnchors(),
        getControllerConfirmation({ subjectDid: resolved }),
      ])

      if (attestationsRaw.status === "rejected") {
        throw attestationsRaw.reason instanceof Error
          ? attestationsRaw.reason
          : new Error("Failed to fetch attestations.")
      }

      const baseAttestations = sortByCategoryPriority(attestationsRaw.value)

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

      let authorizationError: string | null = null
      let confirmation: ControllerConfirmResponse | null = null
      if (confirmationResult.status === "fulfilled") {
        confirmation = confirmationResult.value
      } else if (method === "pkh" || method === "web") {
        authorizationError = confirmationResult.reason instanceof Error
          ? confirmationResult.reason.message
          : "Controller authorization check failed."
      }

      const artifact = artifactMode
        ? await buildArtifactVerification(resolved, baseAttestations, approvedIssuers)
        : null
      const attestations = artifact ? sortByCategoryPriority(artifact.allAttestations) : baseAttestations
      const authorizedParties = artifactMode
        ? []
        : buildAuthorizedParties(resolved, confirmation, attestations)

      const score = computeScore({
        method,
        attestations,
        authorizedParties,
        artifact,
      })

      setResult({
        query: rawQuery.trim(),
        subjectDid: resolved,
        method,
        score,
        attestations,
        approvedIssuers,
        authorizedParties,
        authorizationError,
        artifact,
      })
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : "Verification failed.")
    } finally {
      setIsVerifying(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await runVerify(query)
  }

  const hasResult = !!result
  const searchForm = (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="flex items-center gap-1 rounded-full border border-border/80 bg-card px-3 py-2 shadow-sm shadow-slate-950/5 transition focus-within:border-primary/40 focus-within:shadow-md">
        <Search className="ml-2 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          aria-label="Search DID"
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            if (fileName && !event.target.value.startsWith("did:artifact:")) clearFile()
          }}
          placeholder="Paste a DID, address, or domain"
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base text-foreground outline-none placeholder:text-muted-foreground"
          autoComplete="off"
          spellCheck={false}
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => {
              setQuery("")
              clearFile()
              setResult(null)
              setError(null)
            }}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Upload file"
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessingFile}
        >
          <Upload className="h-4 w-4" />
        </button>
        <Button
          type="submit"
          size="sm"
          className="ml-1 rounded-full px-4"
          disabled={isVerifying || isProcessingFile || !query.trim()}
        >
          {isVerifying ? "Verifying..." : "Verify"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          aria-label="Upload artifact file"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleFileSelect(file)
          }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {fileName ? (
          <span className="inline-flex items-center gap-1.5">
            <Upload className="h-3 w-3" />
            {fileName}
            {isProcessingFile ? " · hashing…" : ""}
          </span>
        ) : (
          <span>
            <button
              type="button"
              className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile}
            >
              Upload a file
            </button>
            {" "}to verify its artifact DID
          </span>
        )}
        {detectedMethod ? (
          <span className="text-foreground/70">Detected: {getSubjectTypeLabel(detectedMethod)}</span>
        ) : null}
      </div>
    </form>
  )

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
      {!hasResult ? (
        <div className="flex min-h-[70vh] flex-col items-center justify-center pb-24">
          <div className="mb-10 text-center">
            <p className="text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
              OMATrust
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Verify a service, key, contract, or artifact
            </p>
          </div>
          {searchForm}
          {error ? (
            <div className="mt-6 w-full max-w-2xl rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="pb-16 pt-8">
          <div className="mb-8 flex justify-center">{searchForm}</div>

          {error ? (
            <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="space-y-8">
            <section className="rounded-xl border border-border/70 bg-card/70 p-5 shadow-sm shadow-slate-950/5 sm:p-6">
              <ScoreHero score={result.score} method={result.method} />
              <p className="mt-5 break-all font-mono text-xs text-muted-foreground">{result.subjectDid}</p>
            </section>

            {result.method === "pkh" ? (
              <div className="rounded-xl border border-border/70 bg-card/70 p-5 shadow-sm shadow-slate-950/5 sm:p-6">
                <AuthorizedPartiesSection
                  parties={result.authorizedParties}
                  error={result.authorizationError}
                />
              </div>
            ) : null}

            {result.method === "web" && result.authorizedParties.length > 0 ? (
              <div className="rounded-xl border border-border/70 bg-card/70 p-5 shadow-sm shadow-slate-950/5 sm:p-6">
                <AuthorizedPartiesSection
                  parties={result.authorizedParties}
                  error={result.authorizationError}
                />
              </div>
            ) : null}

            {result.artifact ? (
              <ArtifactDetails result={result.artifact} approvedIssuers={result.approvedIssuers} />
            ) : result.method !== "pkh" ? (
              <section className="rounded-xl border border-border/70 bg-card/70 px-4 py-2 shadow-sm shadow-slate-950/5 sm:px-8">
                <div className="mb-3 pt-4">
                  <p className="technical-label text-primary">Attestations</p>
                </div>
                <LatestAttestations
                  showHeading={false}
                  data={result.attestations}
                  approvedIssuers={result.approvedIssuers}
                  emptyMessage="No attestations found for this service."
                />
              </section>
            ) : (
              <section className="rounded-xl border border-border/70 bg-card/70 px-4 py-2 shadow-sm shadow-slate-950/5 sm:px-8">
                <div className="mb-3 pt-4">
                  <p className="technical-label text-primary">Related attestations</p>
                </div>
                <LatestAttestations
                  showHeading={false}
                  data={result.attestations}
                  approvedIssuers={result.approvedIssuers}
                  emptyMessage="No attestations found for this contract or key."
                />
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
