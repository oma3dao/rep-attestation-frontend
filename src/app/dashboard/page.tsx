"use client"

import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { normalizeDid } from "@oma3/omatrust/identity"
import * as reputation from "@oma3/omatrust/reputation"
import type { Hex } from "@oma3/omatrust/reputation"
import { useActiveAccount } from "thirdweb/react"
import { ethers6Adapter } from "thirdweb/adapters/ethers6"
import { ExternalLink, RefreshCw } from "lucide-react"
import { client } from "@/app/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AttestationDetailModal } from "@/components/attestation-detail-modal"
import { RevokeConfirmationDialog } from "@/components/revoke-confirmation-dialog"
import { PublishButton } from "@/components/dashboard/PublishButton"
import { useBackendSession } from "@/components/backend-session-provider"
import { StarRating } from "@/components/star-rating"
import {
  getControllerConfirmation,
  resolvePublicIdentities,
  type BackendSessionMeResponse,
  type IdentityResolution,
  type ControllerConfirmResponse,
} from "@/lib/omatrust-backend"
import {
  getAttestationsByAttesterWithMetadata,
  getAttestationsForDIDWithMetadata,
  type EnrichedAttestationResult,
} from "@/lib/attestation-queries"
import { getActiveThirdwebChain, useWallet } from "@/lib/blockchain"
import { getContractAddress } from "@/config/attestation-services"
import { getChainById } from "@/config/chains"
import { keyBindingSchema, userReviewSchema } from "@/config/schemas"
import { callControllerWitness } from "@/lib/controller-witness-client"

const activeThirdwebChain = getActiveThirdwebChain()

// ---------------------------------------------------------------------------
// Dashboard context
// ---------------------------------------------------------------------------

type DashboardContext = "default" | "review" | "service-management" | "issuer"

function getDashboardContext(searchParams: Pick<URLSearchParams, "get">): DashboardContext {
  const ctx = searchParams.get("context")
  if (ctx === "review" || ctx === "service-management" || ctx === "issuer") return ctx
  return "default"
}

interface SectionContext {
  context: DashboardContext
  hasReviews: boolean
  hasServiceRecords: boolean
  hasIssuerRecords: boolean
}

function getVisibleSections(ctx: SectionContext) {
  return {
    reviews: ctx.context === "review" || (ctx.context === "default" && ctx.hasReviews),
    serviceTrust:
      ctx.context === "service-management" ||
      ctx.context === "issuer" ||
      (ctx.context === "default" && (ctx.hasServiceRecords || ctx.hasIssuerRecords)),
    issuerTools: ctx.context === "issuer" || (ctx.context === "default" && ctx.hasIssuerRecords),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateMiddle(value: string, head: number = 12, tail: number = 8): string {
  if (value.length <= head + tail + 3) return value
  return `${value.slice(0, head)}...${value.slice(-tail)}`
}

function getRecipientLabel(attestation: EnrichedAttestationResult): string {
  const subject = attestation.decodedData?.subject
  if (typeof subject === "string" && subject.length > 0) return subject
  return attestation.recipient
}

function canRevoke(attestation: EnrichedAttestationResult, connectedAddress: string | null): boolean {
  if (!connectedAddress) return false
  return (
    attestation.revocable &&
    attestation.revocationTime === 0 &&
    attestation.attester.toLowerCase() === connectedAddress.toLowerCase()
  )
}

function formatValue(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "Not set"
}

function isIssuerAttestation(attestation: EnrichedAttestationResult): boolean {
  return ["security-assessment", "certification"].includes(attestation.schemaId ?? "")
}

function getDecodedString(attestation: EnrichedAttestationResult, names: string[]): string | null {
  for (const name of names) {
    const value = attestation.decodedData?.[name]
    if (typeof value === "string" && value.trim().length > 0) return value.trim()
  }
  return null
}

function getServiceDidFromAttestation(attestation: EnrichedAttestationResult): string | null {
  const value = getDecodedString(attestation, ["subject", "organization", "recipient"])
  if (value?.startsWith("did:")) return value
  return null
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => !!value && value.trim().length > 0)))
}

function serviceMatchesAttestation(attestation: EnrichedAttestationResult, serviceDid: string): boolean {
  const candidates = [
    getDecodedString(attestation, ["subject", "organization"]),
    attestation.recipient,
  ]
  return candidates.some((candidate) => candidate?.toLowerCase() === serviceDid.toLowerCase())
}

function canonicalIdentifier(value: string): string {
  try {
    return normalizeDid(value).toLowerCase()
  } catch {
    return value.trim().toLowerCase()
  }
}

function getReviewRating(attestation: EnrichedAttestationResult): string | number | null {
  const value = attestation.decodedData?.ratingValue
  if (typeof value === "bigint") return Number(value)
  return typeof value === "string" || typeof value === "number" ? value : null
}

function getIdentityLabel(resolutions: Record<string, IdentityResolution>, value: string | null | undefined) {
  if (!value) return "Not set"
  return resolutions[canonicalIdentifier(value)]?.label ?? truncateMiddle(value, 16, 8)
}

// ---------------------------------------------------------------------------
// Service Management action cards
// ---------------------------------------------------------------------------

const ISSUER_ACTIONS = [
  {
    title: "Publish a security assessment",
    description: "Publish an assessment that helps others understand a service\u2019s security posture.",
    href: "/publish/security-assessment",
  },
  {
    title: "Issue a certification",
    description: "Issue a formal certification under a program or certification process.",
    href: "/publish/certification",
  },
]

const REVIEW_ACTIONS = [
  {
    title: "Review an app or service",
    description: "Submit a public review with verifiable trust data for a service you used.",
    href: "/publish/user-review",
  },
]

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------

function ActionGrid({ title, description, actions, children }: {
  title: string
  description: string
  actions: { title: string; description: string; href: string }[]
  children?: ReactNode
}) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <div key={action.href} className="rounded-xl border border-border/70 bg-muted/40 p-4">
            <h3 className="font-semibold tracking-tight text-foreground">{action.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{action.description}</p>
            <Link href={action.href} className="mt-4 inline-flex">
              <Button variant="outline" size="sm">Open</Button>
            </Link>
          </div>
        ))}
      </CardContent>
      {children ? <CardContent className="pt-0">{children}</CardContent> : null}
    </Card>
  )
}

function AccountSection({
  session,
  serviceDids,
}: {
  session: BackendSessionMeResponse
  serviceDids: string[]
}) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>
          Your OMATrust account and service identities.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Display name</div>
            <div className="mt-2 break-words font-medium text-foreground">
              {formatValue(session.account.displayName)}
            </div>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/40 p-4 md:col-span-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {serviceDids.length > 1 ? "Service identities" : "Subject ID"}
            </div>
            <div className="mt-2 space-y-1">
              {serviceDids.length > 0 ? (
                serviceDids.map((did) => (
                  <div key={did} className="break-all font-mono text-sm text-foreground">{did}</div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No service identity configured yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" asChild>
            <Link href="/account">Manage account</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ApprovedIssuerRequest({
  address,
  walletDid,
  shouldCheck,
  approvedIssuerStatus,
}: {
  address: string | null
  walletDid: string | null
  shouldCheck: boolean
  approvedIssuerStatus: ControllerConfirmResponse["approvedIssuer"]["status"] | null
}) {
  const [showForm, setShowForm] = useState(false)
  const [wallets, setWallets] = useState(walletDid || address || "")
  const [schemas, setSchemas] = useState<string[]>(["security-assessment", "certification"])
  const [email, setEmail] = useState("")

  useEffect(() => {
    setWallets(walletDid || address || "")
  }, [address, walletDid])

  if (!shouldCheck || approvedIssuerStatus === null || approvedIssuerStatus === "approved") return null

  const toggleSchema = (schemaId: string) => {
    setSchemas((current) =>
      current.includes(schemaId)
        ? current.filter((item) => item !== schemaId)
        : [...current, schemaId]
    )
  }

  const submitRequest = (event: FormEvent) => {
    event.preventDefault()
    const subject = "OMA3 authorized issuer request"
    const body = [
      "Make your wallets an OMA3-authorized issuer to increase trust in your attestations.",
      "",
      `Wallets: ${wallets}`,
      `Schemas: ${schemas.join(", ") || "Not specified"}`,
      `Email: ${email || "Not specified"}`,
    ].join("\n")

    window.location.href = `mailto:authorizations@oma3.org?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold tracking-tight text-foreground">Request approved issuer status</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Make your wallets an OMA3-authorized issuer to increase trust in your attestations.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowForm((open) => !open)}>
          Request
        </Button>
      </div>

      {showForm ? (
        <form className="mt-4 space-y-4" onSubmit={submitRequest}>
          <div className="space-y-2">
            <label htmlFor="issuer-wallets" className="text-sm font-medium text-foreground">Wallets</label>
            <textarea
              id="issuer-wallets"
              value={wallets}
              onChange={(event) => setWallets(event.target.value)}
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="did:pkh:eip155:..."
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">Attestation schemas</div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={schemas.includes("security-assessment")}
                onChange={() => toggleSchema("security-assessment")}
              />
              Security audit
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={schemas.includes("certification")}
                onChange={() => toggleSchema("certification")}
              />
              Certification
            </label>
          </div>

          <div className="space-y-2">
            <label htmlFor="issuer-email" className="text-sm font-medium text-foreground">Email address</label>
            <input
              id="issuer-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="you@example.com"
            />
          </div>

          <Button type="submit" disabled={!wallets.trim() || schemas.length === 0}>
            Open email request
          </Button>
        </form>
      ) : null}
    </div>
  )
}

type ServiceKey = {
  keyDid: string
  canonicalKeyDid: string
  label: string
  sources: string[]
  basic: boolean
  intermediate: boolean
  advanced: boolean
  controllerWitnessUid?: string
  keyBindingUid?: string
  keyBindingSchemaUid?: string
}

function buildServiceKeys({
  attestations,
  serviceDid,
  accountWalletDid,
  controllerSummary,
}: {
  attestations: EnrichedAttestationResult[]
  serviceDid: string | null
  accountWalletDid: string | null
  controllerSummary: ControllerConfirmResponse | null
}): ServiceKey[] {
  const keyMap = new Map<string, ServiceKey>()

  const ensureKey = (keyDid: string, source: string, label?: string) => {
    const canonicalKeyDid = canonicalIdentifier(keyDid)
    const existing = keyMap.get(canonicalKeyDid) ?? {
      keyDid,
      canonicalKeyDid,
      label: label ?? truncateMiddle(keyDid, 16, 8),
      sources: [],
      basic: false,
      intermediate: false,
      advanced: false,
    }
    if (!existing.sources.includes(source)) existing.sources.push(source)
    keyMap.set(canonicalKeyDid, existing)
    return existing
  }

  if (accountWalletDid) {
    ensureKey(accountWalletDid, "Account wallet")
  }

  for (const controllerKey of controllerSummary?.controllerKeys ?? []) {
    const key = ensureKey(controllerKey.canonicalId, controllerKey.sources.join(", "), controllerKey.label)
    key.basic = key.basic || controllerKey.basic
  }

  for (const attestation of attestations) {
    if (!serviceDid || !serviceMatchesAttestation(attestation, serviceDid)) continue

    if (attestation.schemaId === "key-binding") {
      const keyDid = getDecodedString(attestation, ["keyId"])
      if (!keyDid) continue
      const key = ensureKey(keyDid, "Key binding")
      key.advanced = true
      key.keyBindingUid = attestation.uid
      key.keyBindingSchemaUid = attestation.schema
      continue
    }

    if (attestation.schemaId === "controller-witness") {
      const keyDid = getDecodedString(attestation, ["controller"])
      if (!keyDid) continue
      const key = ensureKey(keyDid, "Controller witness")
      key.intermediate = true
      key.controllerWitnessUid = attestation.uid
    }
  }

  return Array.from(keyMap.values()).sort((a, b) => {
    const score = (key: ServiceKey) => Number(key.advanced) * 3 + Number(key.intermediate) * 2 + Number(key.basic)
    return score(b) - score(a) || a.keyDid.localeCompare(b.keyDid)
  })
}

function ServiceKeyCard({
  keyInfo,
  serviceDid,
  chainId,
  onControllerWitnessSubmitted,
}: {
  keyInfo: ServiceKey
  serviceDid: string | null
  chainId: number
  onControllerWitnessSubmitted?: () => Promise<void> | void
}) {
  const [isSubmittingWitness, setIsSubmittingWitness] = useState(false)
  const [witnessMessage, setWitnessMessage] = useState<string | null>(null)
  const [witnessError, setWitnessError] = useState<string | null>(null)
  const [showWitnessConfirm, setShowWitnessConfirm] = useState(false)
  const publishParams = serviceDid
    ? `subject=${encodeURIComponent(serviceDid)}&keyId=${encodeURIComponent(keyInfo.keyDid)}`
    : null
  const keyBindingSchemaUid = keyInfo.keyBindingSchemaUid ?? keyBindingSchema.deployedUIDs?.[chainId]
  const easContract = getContractAddress("eas", chainId)

  // Controller witness: available for any key that doesn't have one yet.
  // The API will check endpoint evidence (DNS/DID.json) server-side.
  const canSubmitControllerWitness = Boolean(
    serviceDid &&
    !keyInfo.intermediate &&
    keyBindingSchemaUid &&
    keyBindingSchemaUid !== "0x".padEnd(66, "0") &&
    easContract
  )

  const submitControllerWitness = async () => {
    if (!serviceDid || !keyBindingSchemaUid || !easContract) return

    setShowWitnessConfirm(false)
    setIsSubmittingWitness(true)
    setWitnessMessage(null)
    setWitnessError(null)

    try {
      const result = await callControllerWitness({
        chainId,
        easContract,
        schemaUid: keyBindingSchemaUid,
        subject: serviceDid,
        controller: keyInfo.keyDid,
      })

      if (!result) {
        setWitnessError("The controller witness API could not confirm endpoint evidence for this key.")
        return
      }

      setWitnessMessage("Controller witness submitted.")
      await onControllerWitnessSubmitted?.()
    } catch (error) {
      setWitnessError(error instanceof Error ? error.message : "Failed to submit controller witness.")
    } finally {
      setIsSubmittingWitness(false)
    }
  }

  const Signal = ({ active, label }: { active: boolean; label: string }) => (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
      active
        ? "border-primary/25 bg-primary/10 text-primary"
        : "border-border bg-background text-muted-foreground"
    }`}>
      {label}: {active ? "Yes" : "No"}
    </span>
  )

  return (
    <div className="rounded-xl border border-border/70 bg-background p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h4 className="font-semibold tracking-tight text-foreground">Authorized key</h4>
          <p className="mt-1 font-medium text-foreground">{keyInfo.label}</p>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{keyInfo.keyDid}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Sources: {keyInfo.sources.join(", ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Signal active={keyInfo.basic} label="Basic" />
          <Signal active={keyInfo.intermediate} label="Intermediate" />
          <Signal active={keyInfo.advanced} label="Advanced" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {canSubmitControllerWitness ? (
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => setShowWitnessConfirm(true)}
            disabled={isSubmittingWitness}
          >
            {isSubmittingWitness ? "Submitting witness..." : "Add controller witness"}
          </Button>
        ) : null}
        {!keyInfo.advanced && publishParams ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/publish/key-binding?${publishParams}`}>
              Publish key binding
            </Link>
          </Button>
        ) : null}
      </div>

      {showWitnessConfirm ? (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-medium text-foreground">Confirm controller witness</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This will submit a blockchain transaction using one of your sponsored writes.
            A trusted third party will verify your endpoint evidence (DNS or DID document)
            and anchor the controller relationship on-chain.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              type="button"
              onClick={() => { void submitControllerWitness() }}
              disabled={isSubmittingWitness}
            >
              Confirm
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setShowWitnessConfirm(false)}
              disabled={isSubmittingWitness}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {witnessMessage ? (
        <p className="mt-3 text-sm text-primary">{witnessMessage}</p>
      ) : null}
      {witnessError ? (
        <p className="mt-3 text-sm text-destructive">{witnessError}</p>
      ) : null}
    </div>
  )
}

function ServiceTrustWorkspace({
  session,
  address,
  chainId,
  attestations,
  shouldCheckApprovedIssuer,
  onControllerWitnessSubmitted,
}: {
  session: BackendSessionMeResponse
  address: string | null
  chainId: number
  attestations: EnrichedAttestationResult[]
  shouldCheckApprovedIssuer: boolean
  onControllerWitnessSubmitted?: () => Promise<void> | void
}) {
  const serviceDids = useMemo(() => {
    const attestationDids = attestations
      .filter((attestation) => ["key-binding", "controller-witness", "linked-identifier", "security-assessment", "certification"].includes(attestation.schemaId ?? ""))
      .map(getServiceDidFromAttestation)
    return uniqueValues([session.primarySubject?.canonicalDid, ...attestationDids])
      .filter((did) => did.startsWith("did:"))
  }, [attestations, session.primarySubject?.canonicalDid])

  const [selectedServiceDid, setSelectedServiceDid] = useState<string | null>(serviceDids[0] ?? null)
  const [controllerSummary, setControllerSummary] = useState<ControllerConfirmResponse | null>(null)
  const [isLoadingControllerSummary, setIsLoadingControllerSummary] = useState(false)
  const [serviceReviews, setServiceReviews] = useState<EnrichedAttestationResult[]>([])
  const [isLoadingReviews, setIsLoadingReviews] = useState(false)
  const [identityResolutions, setIdentityResolutions] = useState<Record<string, IdentityResolution>>({})

  useEffect(() => {
    if (!selectedServiceDid || !serviceDids.includes(selectedServiceDid)) {
      setSelectedServiceDid(serviceDids[0] ?? null)
    }
  }, [selectedServiceDid, serviceDids])

  const accountWalletDid = session.wallet?.did ?? (address ? `did:pkh:eip155:${chainId}:${address}` : null)

  useEffect(() => {
    if (!selectedServiceDid) {
      setControllerSummary(null)
      return
    }

    let cancelled = false
    async function loadControllerSummary() {
      try {
        setIsLoadingControllerSummary(true)
        const summary = await getControllerConfirmation({
          subjectDid: selectedServiceDid!,
          walletDid: accountWalletDid,
        })
        if (!cancelled) setControllerSummary(summary)
      } catch {
        if (!cancelled) setControllerSummary(null)
      } finally {
        if (!cancelled) setIsLoadingControllerSummary(false)
      }
    }

    void loadControllerSummary()
    return () => { cancelled = true }
  }, [accountWalletDid, selectedServiceDid])

  useEffect(() => {
    const schemaUID = userReviewSchema.deployedUIDs?.[chainId]
    if (!selectedServiceDid || !schemaUID || schemaUID === "0x".padEnd(66, "0")) {
      setServiceReviews([])
      return
    }

    const serviceDid = selectedServiceDid
    const reviewSchemaUID = schemaUID
    let cancelled = false
    async function loadServiceReviews() {
      try {
        setIsLoadingReviews(true)
        const reviews = await getAttestationsForDIDWithMetadata(serviceDid, {
          schemaUID: reviewSchemaUID,
          limit: 50,
        })
        if (!cancelled) {
          setServiceReviews([...reviews].sort((a, b) => b.time - a.time))
        }
      } catch {
        if (!cancelled) setServiceReviews([])
      } finally {
        if (!cancelled) setIsLoadingReviews(false)
      }
    }

    void loadServiceReviews()
    return () => { cancelled = true }
  }, [chainId, selectedServiceDid])

  const serviceKeys = useMemo(() => buildServiceKeys({
    attestations,
    serviceDid: selectedServiceDid,
    accountWalletDid,
    controllerSummary,
  }), [accountWalletDid, attestations, controllerSummary, selectedServiceDid])

  const linkedIdentifiers = useMemo(() => {
    if (!selectedServiceDid) return []
    return attestations
      .filter((attestation) => attestation.schemaId === "linked-identifier" && serviceMatchesAttestation(attestation, selectedServiceDid))
      .map((attestation) => ({
        uid: attestation.uid,
        linkedId: getDecodedString(attestation, ["linkedId"]),
      }))
      .filter((item): item is { uid: string; linkedId: string } => !!item.linkedId)
  }, [attestations, selectedServiceDid])

  const responseRefUids = useMemo(() => new Set(
    attestations
      .filter((attestation) => attestation.schemaId === "user-review-response")
      .map((attestation) => getDecodedString(attestation, ["refUID"]))
      .filter((value): value is string => !!value)
  ), [attestations])

  const unrespondedReviews = serviceReviews.filter((review) => !responseRefUids.has(review.uid))
  const respondedReviews = serviceReviews.filter((review) => responseRefUids.has(review.uid))
  const serviceCredentials = useMemo(() => {
    if (!selectedServiceDid) return []
    return attestations
      .filter((attestation) =>
        isIssuerAttestation(attestation) && serviceMatchesAttestation(attestation, selectedServiceDid)
      )
      .sort((a, b) => b.time - a.time)
  }, [attestations, selectedServiceDid])
  const reviewRows = useMemo(() => [
    ...unrespondedReviews.map((review) => ({ review, needsResponse: true })),
    ...respondedReviews.map((review) => ({ review, needsResponse: false })),
  ], [respondedReviews, unrespondedReviews])
  const identityInputs = useMemo(() => uniqueValues([
    selectedServiceDid,
    ...serviceReviews.flatMap((review) => [
      review.attester,
      getRecipientLabel(review),
    ]),
    ...serviceCredentials.flatMap((credential) => [
      credential.attester,
      getRecipientLabel(credential),
    ]),
  ]), [selectedServiceDid, serviceCredentials, serviceReviews])

  useEffect(() => {
    if (identityInputs.length === 0) {
      setIdentityResolutions({})
      return
    }

    let cancelled = false
    async function loadIdentityLabels() {
      try {
        const response = await resolvePublicIdentities(identityInputs)
        if (cancelled) return
        setIdentityResolutions(Object.fromEntries(
          response.identities.map((identity) => [canonicalIdentifier(identity.canonical), identity])
        ))
      } catch {
        if (!cancelled) setIdentityResolutions({})
      }
    }

    void loadIdentityLabels()
    return () => { cancelled = true }
  }, [identityInputs])
  const selectedServiceLabel = getIdentityLabel(identityResolutions, selectedServiceDid)

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Service Controller Workspace</CardTitle>
        <CardDescription>
          Confirm service controllers, linked identifiers, credentials, and third-party reviews for services you manage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <div>
            <h3 className="font-semibold tracking-tight text-foreground">Authorized keys</h3>
            <p className="text-sm text-muted-foreground">
              Keys are deduplicated from key bindings, controller witnesses, account context, and domain metadata.
            </p>
          </div>

          {isLoadingControllerSummary ? (
            <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
              Checking DNS TXT, did.json, and issuer approval through the OMATrust API...
            </div>
          ) : null}

          {controllerSummary?.warnings.map((warning) => (
            <div key={warning} className="rounded-xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
              {warning}
            </div>
          ))}

          <div className="space-y-3">
            {serviceKeys.map((keyInfo) => (
              <ServiceKeyCard
                key={keyInfo.keyDid}
                keyInfo={keyInfo}
                serviceDid={selectedServiceDid}
                chainId={chainId}
                onControllerWitnessSubmitted={onControllerWitnessSubmitted}
              />
            ))}
            {serviceKeys.length === 0 ? (
              <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
                No service keys found yet. Add a service identity or publish a key binding to start building trust.
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold tracking-tight text-foreground">Linked Identifiers</h3>
              <p className="text-sm text-muted-foreground">Connect related DIDs, handles, wallets, or service identities under common control.</p>
            </div>
            <Link
              href="https://docs.omatrust.org/docs/reputation/attestation-types#linked-identifiers"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:text-primary/85"
            >
              What is this?
            </Link>
          </div>
          {linkedIdentifiers.length > 0 ? (
            <div className="space-y-2">
              {linkedIdentifiers.map((item) => (
                <div key={item.uid} className="rounded-xl border border-border/70 bg-background p-4 font-mono text-sm text-foreground">
                  {item.linkedId}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
              No linked identifiers yet.
            </div>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/publish/linked-identifier${selectedServiceDid ? `?subject=${encodeURIComponent(selectedServiceDid)}` : ""}`}>
              Link another identity
            </Link>
          </Button>
        </section>

        {serviceCredentials.length > 0 ? (
          <section className="space-y-3">
            <div>
              <h3 className="font-semibold tracking-tight text-foreground">Security Reviews and Certifications</h3>
              <p className="text-sm text-muted-foreground">Professional credentials issued for the selected service.</p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                    <th className="py-3 pl-4 pr-4 font-medium">Type</th>
                    <th className="py-3 pr-4 font-medium">Issuer</th>
                    <th className="py-3 pr-4 font-medium">Recipient</th>
                    <th className="py-3 pr-4 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceCredentials.map((credential) => {
                    const recipient = getRecipientLabel(credential)
                    return (
                      <tr key={credential.uid} className="border-b last:border-0">
                        <td className="py-3 pl-4 pr-4 font-medium text-foreground">
                          {credential.schemaTitle ?? credential.schemaId ?? "Credential"}
                        </td>
                        <td className="py-3 pr-4 text-foreground/80" title={credential.attester}>
                          {getIdentityLabel(identityResolutions, credential.attester)}
                        </td>
                        <td className="py-3 pr-4 text-foreground/80" title={recipient}>
                          {getIdentityLabel(identityResolutions, recipient)}
                        </td>
                        <td className="py-3 pr-4 text-foreground/80">
                          {new Date(credential.time * 1000).toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <div>
            <h3 className="font-semibold tracking-tight text-foreground">Reviews of My Services</h3>
            <p className="text-sm text-muted-foreground">Third-party reviews filed against the selected service identity.</p>
          </div>
          {isLoadingReviews ? (
            <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">Loading service reviews...</div>
          ) : null}
          {!isLoadingReviews && serviceReviews.length === 0 ? (
            <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
              No reviews found for this service yet.
            </div>
          ) : null}
          {reviewRows.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                    <th className="py-3 pl-4 pr-4 font-medium">Attester</th>
                    <th className="py-3 pr-4 font-medium">Recipient</th>
                    <th className="py-3 pr-4 font-medium">Date</th>
                    <th className="py-3 pr-4 font-medium">Rating</th>
                    <th className="py-3 pr-4 font-medium">Text</th>
                    <th className="py-3 pr-4 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewRows.map(({ review, needsResponse }) => {
                    const recipient = getRecipientLabel(review)
                    return (
                      <tr key={review.uid} className="border-b align-top last:border-0">
                        <td className="py-4 pl-4 pr-4 text-foreground/80" title={review.attester}>
                          {getIdentityLabel(identityResolutions, review.attester)}
                        </td>
                        <td className="py-4 pr-4 text-foreground/80" title={recipient}>
                          {getIdentityLabel(identityResolutions, recipient)}
                        </td>
                        <td className="py-4 pr-4 text-foreground/80">
                          {new Date(review.time * 1000).toLocaleString()}
                        </td>
                        <td className="py-4 pr-4">
                          <StarRating value={getReviewRating(review)} />
                        </td>
                        <td className="max-w-xs py-4 pr-4 text-foreground/80">
                          <p className="line-clamp-3">
                            {getDecodedString(review, ["reviewBody"]) || "No review text provided."}
                          </p>
                        </td>
                        <td className="py-4 pr-4">
                          {needsResponse ? (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/publish/user-review-response?refUID=${encodeURIComponent(review.uid)}&subject=${encodeURIComponent(selectedServiceDid ?? recipient)}`}>
                                Respond
                              </Link>
                            </Button>
                          ) : (
                            <Badge variant="secondary">Responded</Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <ApprovedIssuerRequest
          address={address}
          walletDid={session.wallet?.did ?? null}
          shouldCheck={shouldCheckApprovedIssuer}
          approvedIssuerStatus={controllerSummary?.approvedIssuer.status ?? null}
        />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

function DashboardContent() {
  const { isConnected, address, chainId } = useWallet()
  const account = useActiveAccount()
  const searchParams = useSearchParams()
  const dashboardContext = getDashboardContext(searchParams)
  const { session, isSessionLoading, openAuthDialog } = useBackendSession()

  const [attestations, setAttestations] = useState<EnrichedAttestationResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revokingUid, setRevokingUid] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<EnrichedAttestationResult | null>(null)
  const [selectedAttestation, setSelectedAttestation] = useState<EnrichedAttestationResult | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const chain = useMemo(() => getChainById(chainId), [chainId])
  const easContractAddress = useMemo(() => getContractAddress("eas", chainId), [chainId])

  // Derive which sections to show based on context + attestation data
  const sectionCtx: SectionContext = useMemo(() => ({
    context: dashboardContext,
    hasReviews: attestations.some((a) => a.schemaId === "user-review"),
    hasServiceRecords: attestations.some((a) =>
      ["key-binding", "controller-witness", "linked-identifier"].includes(a.schemaId ?? "")
    ),
    hasIssuerRecords: attestations.some(isIssuerAttestation),
  }), [dashboardContext, attestations])

  const visibleSections = useMemo(() => getVisibleSections(sectionCtx), [sectionCtx])
  const shouldCheckApprovedIssuer = visibleSections.serviceTrust && (
    dashboardContext === "issuer" || sectionCtx.hasIssuerRecords
  )
  const dashboardReturnTo = useMemo(() => {
    const query = searchParams.toString()
    return query ? `/dashboard?${query}` : "/dashboard"
  }, [searchParams])

  const serviceDids = useMemo(() => {
    if (!session) return []
    const attestationDids = attestations
      .filter((a) => ["key-binding", "controller-witness", "linked-identifier", "security-assessment", "certification"].includes(a.schemaId ?? ""))
      .map(getServiceDidFromAttestation)
    return uniqueValues([session.primarySubject?.canonicalDid, ...attestationDids])
      .filter((did) => did.startsWith("did:"))
  }, [attestations, session])

  const loadAttestations = useCallback(async () => {
    if (!session || !isConnected || !address) {
      setAttestations([])
      return
    }
    if (!easContractAddress) {
      setAttestations([])
      setError("My Attestations is currently available only on EAS-enabled chains.")
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      const results = await getAttestationsByAttesterWithMetadata(address, chainId, 100)
      setAttestations([...results].sort((a, b) => b.time - a.time))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attestations.")
    } finally {
      setIsLoading(false)
    }
  }, [address, chainId, easContractAddress, isConnected, session])

  useEffect(() => {
    void loadAttestations()
  }, [loadAttestations])

  const handleRevoke = useCallback(async (attestation: EnrichedAttestationResult) => {
    if (!address || !account || !easContractAddress) {
      setError("Wallet account or EAS contract not available.")
      return
    }
    if (!canRevoke(attestation, address)) return

    try {
      setRevokingUid(attestation.uid)
      setError(null)

      const signer = await ethers6Adapter.signer.toEthers({
        client,
        chain: activeThirdwebChain,
        account,
      })
      if (!signer) throw new Error("Failed to obtain signer.")

      await reputation.revokeAttestation({
        signer,
        easContractAddress: easContractAddress as Hex,
        schemaUid: attestation.schema as Hex,
        uid: attestation.uid as Hex,
      })

      await loadAttestations()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke attestation.")
    } finally {
      setRevokingUid(null)
      setRevokeTarget(null)
    }
  }, [account, address, easContractAddress, loadAttestations])

  const openDetailModal = useCallback((attestation: EnrichedAttestationResult) => {
    setSelectedAttestation(attestation)
    setIsModalOpen(true)
  }, [])

  const closeDetailModal = useCallback(() => {
    setIsModalOpen(false)
    setSelectedAttestation(null)
  }, [])

  if (isSessionLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
            <CardDescription>Checking your session...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="py-4 text-sm text-muted-foreground">Loading...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- Not signed in ----
  if (!session) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
            <CardDescription>
              Sign in to manage keys, linked identities, review responses, and your published trust data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => openAuthDialog({
                mode: "chooser",
                reason: "navigation",
                redirectTo: dashboardReturnTo,
              })}
            >
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- Signed in ----
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Wallet{" "}
            <Link href="/account" className="font-medium text-primary transition-colors hover:text-primary/80">
              {truncateMiddle(address || "")}
            </Link>{" "}
            on {chain?.name || `Chain ${chainId}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadAttestations()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <PublishButton />
        </div>
      </div>

      <AccountSection session={session} serviceDids={serviceDids} />

      {/* Contextual sections */}
      {visibleSections.reviews && (
        <ActionGrid
          title="Reviews"
          description="Submit and manage your service reviews."
          actions={REVIEW_ACTIONS}
        />
      )}

      {visibleSections.serviceTrust && (
        <ServiceTrustWorkspace
          session={session}
          address={address}
          chainId={chainId}
          attestations={attestations}
          shouldCheckApprovedIssuer={shouldCheckApprovedIssuer}
          onControllerWitnessSubmitted={loadAttestations}
        />
      )}

      {visibleSections.issuerTools && (
        <ActionGrid
          title="Issuer Tools"
          description="Publish security assessments and certifications as a professional issuer."
          actions={ISSUER_ACTIONS}
        />
      )}

      {/* Error */}
      {error && (
        <Card className="mb-4 border-destructive/20 bg-destructive/10">
          <CardContent className="pt-6 text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* My Attestations */}
      <Card>
        <CardHeader>
          <CardTitle>My Attestations</CardTitle>
          <CardDescription>
            View attestations created by your signed-in account or connected wallet, ordered latest to earliest.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading attestations...</div>
          ) : attestations.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No attestations found for this account yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-3 pr-4 font-medium">Schema</th>
                    <th className="py-3 pr-4 font-medium">Recipient</th>
                    <th className="py-3 pr-4 font-medium">Date</th>
                    <th className="py-3 pr-4 font-medium">Rating</th>
                    <th className="py-3 pr-4 font-medium">Status</th>
                    <th className="py-3 pr-4 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {attestations.map((attestation) => {
                    const recipientLabel = getRecipientLabel(attestation)
                    const revoked = attestation.revocationTime > 0
                    const revokeAllowed = canRevoke(attestation, address)
                    return (
                      <tr
                        key={attestation.uid}
                        className="cursor-pointer border-b align-top transition-colors hover:bg-muted/50"
                        onClick={() => openDetailModal(attestation)}
                      >
                        <td className="py-4 pr-4">
                          <div className="font-medium text-foreground">
                            {attestation.schemaTitle || attestation.schemaId || "Unknown schema"}
                          </div>
                          <div className="mt-1 font-mono text-xs text-muted-foreground">
                            {truncateMiddle(attestation.uid, 10, 6)}
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="font-mono text-foreground/80" title={recipientLabel}>
                            {truncateMiddle(recipientLabel, 20, 10)}
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-foreground/80">
                          {new Date(attestation.time * 1000).toLocaleString()}
                        </td>
                        <td className="py-4 pr-4">
                          {attestation.schemaId === "user-review" ? (
                            <StarRating value={getReviewRating(attestation)} />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-4 pr-4">
                          {revoked ? (
                            <Badge variant="destructive">Revoked</Badge>
                          ) : (
                            <Badge variant="success">Active</Badge>
                          )}
                        </td>
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-2">
                            {revokeAllowed ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={revokingUid === attestation.uid}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setRevokeTarget(attestation)
                                }}
                              >
                                {revokingUid === attestation.uid ? "Revoking..." : "Revoke"}
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                            {attestation.txHash && chain?.blockExplorers?.[0]?.url && (
                              <a
                                href={`${chain.blockExplorers[0].url}/tx/${attestation.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80"
                                title="View transaction"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AttestationDetailModal
        isOpen={isModalOpen}
        onClose={closeDetailModal}
        attestation={selectedAttestation}
      />

      <RevokeConfirmationDialog
        isOpen={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => { if (revokeTarget) void handleRevoke(revokeTarget) }}
        attestationUid={revokeTarget?.uid ?? ""}
        isRevoking={revokingUid !== null}
      />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  )
}
