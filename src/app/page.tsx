"use client"

import { useEffect, useState } from "react"
import { LatestAttestations } from "@/components/latest-attestations"
import { WorkflowCards } from "@/components/home/WorkflowCards"
import { LatestTrustProfiles } from "@/components/home/LatestTrustProfiles"
import { getLatestAttestationsWithMetadata, type EnrichedAttestationResult } from "@/lib/attestation-queries"
import { useWallet } from "@/lib/blockchain"
import { ATTESTATION_QUERY_CONFIG } from "@/config/attestation-services"

export default function HomePage() {
  const [attestations, setAttestations] = useState<EnrichedAttestationResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { chainId } = useWallet()

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      try {
        setIsLoading(true)
        const results = await getLatestAttestationsWithMetadata(
          chainId,
          ATTESTATION_QUERY_CONFIG.defaultLimit
        )
        if (!cancelled) setAttestations(results)
      } catch {
        // Individual components handle their own error states
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [chainId])

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <section className="mb-3 max-w-2xl">
        <h1 className="technical-label uppercase text-primary">
          OMATrust Portal
        </h1>
      </section>

      <section>
        <WorkflowCards />
      </section>

      <section className="mt-12">
        <div className="mb-3 max-w-2xl">
          <p className="technical-label text-primary">Latest Trust Profiles</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-2 shadow-sm shadow-slate-950/5 sm:px-8">
          <LatestTrustProfiles
            limit={5}
            data={isLoading ? undefined : attestations}
          />
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 max-w-2xl">
          <p className="technical-label text-primary">Latest Activity</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-2 shadow-sm shadow-slate-950/5 sm:px-8">
          <LatestAttestations
            showHeading={false}
            data={isLoading ? undefined : attestations}
          />
        </div>
      </section>
    </div>
  )
}
