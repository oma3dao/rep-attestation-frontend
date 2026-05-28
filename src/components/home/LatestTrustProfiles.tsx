"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Circle } from "lucide-react"
import { getLatestAttestationsWithMetadata, type EnrichedAttestationResult } from "@/lib/attestation-queries"
import { useWallet } from "@/lib/blockchain"

export interface TrustProfileEntry {
  /** The subject DID or address that identifies this organization */
  id: string
  /** Human-readable label (domain extracted from DID, or truncated address) */
  label: string
  indicators: {
    hasSigningKey: boolean
    hasKeyOwnershipProof: boolean
    hasOwnershipProofAnchored: boolean
  }
}

/** Schema IDs relevant to trust profiles */
const TRUST_SCHEMA_IDS = new Set([
  "key-binding",
  "controller-witness",
  "linked-identifier",
])

/**
 * Extract a human-readable label from a subject string.
 * Handles did:web:example.com → example.com, or truncates addresses.
 */
function labelFromSubject(subject: string): string {
  if (subject.startsWith("did:web:")) {
    // did:web:example.com or did:web:example.com:path
    const domain = subject.slice("did:web:".length).split(":")[0]
    return domain
  }
  if (subject.startsWith("did:")) {
    // Other DID methods — show truncated
    return subject.length > 40
      ? `${subject.slice(0, 24)}...${subject.slice(-8)}`
      : subject
  }
  // Wallet address or other
  if (subject.startsWith("0x") && subject.length === 42) {
    return `${subject.slice(0, 6)}...${subject.slice(-4)}`
  }
  return subject.length > 40
    ? `${subject.slice(0, 24)}...${subject.slice(-8)}`
    : subject
}

/**
 * Aggregate attestations into trust profile entries.
 * Groups by subject and determines which trust indicators are met.
 */
function buildTrustProfiles(
  attestations: EnrichedAttestationResult[],
  limit: number
): TrustProfileEntry[] {
  const profileMap = new Map<
    string,
    {
      hasSigningKey: boolean
      hasKeyOwnershipProof: boolean
      hasOwnershipProofAnchored: boolean
      latestTime: number
    }
  >()

  for (const att of attestations) {
    if (!att.schemaId || !TRUST_SCHEMA_IDS.has(att.schemaId)) continue
    if (att.revocationTime > 0) continue // skip revoked

    // Use the subject from decoded data, or fall back to recipient
    const subject =
      (att.decodedData?.subject as string) || att.recipient
    if (!subject) continue

    const existing = profileMap.get(subject) ?? {
      hasSigningKey: false,
      hasKeyOwnershipProof: false,
      hasOwnershipProofAnchored: false,
      latestTime: 0,
    }

    if (att.schemaId === "key-binding") {
      existing.hasSigningKey = true
      // A key-binding attestation also counts as an anchored ownership proof
      existing.hasOwnershipProofAnchored = true
    }

    if (att.schemaId === "controller-witness") {
      // Controller witness proves key ownership and anchors it
      existing.hasKeyOwnershipProof = true
      existing.hasOwnershipProofAnchored = true
    }

    if (att.schemaId === "linked-identifier") {
      // Linked identifier anchors ownership proof on OMATrust
      existing.hasOwnershipProofAnchored = true
    }

    existing.latestTime = Math.max(existing.latestTime, att.time)
    profileMap.set(subject, existing)
  }

  // Sort by latest activity, take top N
  return Array.from(profileMap.entries())
    .sort((a, b) => b[1].latestTime - a[1].latestTime)
    .slice(0, limit)
    .map(([subject, data]) => ({
      id: subject,
      label: labelFromSubject(subject),
      indicators: {
        hasSigningKey: data.hasSigningKey,
        hasKeyOwnershipProof: data.hasKeyOwnershipProof,
        hasOwnershipProofAnchored: data.hasOwnershipProofAnchored,
      },
    }))
}

function TrustIndicator({
  checked,
  label,
}: {
  checked: boolean
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {checked ? (
        <CheckCircle2 className="h-4 w-4 text-primary" />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground/40" />
      )}
      <span className={checked ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </span>
  )
}

interface LatestTrustProfilesProps {
  limit?: number
  /** Pre-fetched attestation data. When provided, the component skips its own fetch. */
  data?: EnrichedAttestationResult[]
}

export function LatestTrustProfiles({ limit = 5, data }: LatestTrustProfilesProps) {
  const [profiles, setProfiles] = useState<TrustProfileEntry[]>([])
  const [isLoading, setIsLoading] = useState(!data)
  const [error, setError] = useState<string | null>(null)
  const { chainId } = useWallet()

  useEffect(() => {
    // If data was provided externally, build profiles from it
    if (data) {
      setProfiles(buildTrustProfiles(data, limit))
      setIsLoading(false)
      return
    }

    async function fetchProfiles() {
      try {
        setIsLoading(true)
        setError(null)

        // Fetch recent attestations — we'll filter to trust-relevant schemas client-side
        const attestations = await getLatestAttestationsWithMetadata(chainId, 100)
        const trustProfiles = buildTrustProfiles(attestations, limit)
        setProfiles(trustProfiles)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load trust profiles"
        )
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfiles()
  }, [chainId, limit, data])

  if (isLoading) {
    return (
      <div className="py-4">
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-4">
        <p className="text-sm text-destructive">
          Error loading trust profiles: {error}
        </p>
      </div>
    )
  }

  if (profiles.length === 0) {
    return (
      <div className="py-4">
        <p className="text-sm text-muted-foreground">
          No trust profiles found yet. Organizations that authorize signing keys
          and publish controller witnesses will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="py-4">
      <div className="grid grid-cols-1 gap-4 max-w-4xl mx-auto">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="rounded-lg border border-border/70 bg-card px-5 py-4 shadow-sm shadow-slate-950/5"
          >
            <p
              className="font-medium text-foreground truncate"
              title={profile.id}
            >
              {profile.label}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              <TrustIndicator
                checked={profile.indicators.hasSigningKey}
                label="Signing key"
              />
              <TrustIndicator
                checked={profile.indicators.hasKeyOwnershipProof}
                label="Key ownership"
              />
              <TrustIndicator
                checked={profile.indicators.hasOwnershipProofAnchored}
                label="Anchored on OMATrust"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
