"use client"

import { useEffect, useState } from 'react'
import { AttestationCard } from './attestation-card'
import { AttestationDetailModal } from './attestation-detail-modal'
import { getLatestAttestationsWithMetadata, type EnrichedAttestationResult } from '@/lib/attestation-queries'
import { useWallet } from '@/lib/blockchain'
import logger from '@/lib/logger'
import { ATTESTATION_QUERY_CONFIG } from '@/config/attestation-services'

interface LatestAttestationsProps {
  showHeading?: boolean
  /** Pre-fetched attestation data. When provided, the component skips its own fetch. */
  data?: EnrichedAttestationResult[]
}

export function LatestAttestations({ showHeading = true, data }: LatestAttestationsProps) {
  const [attestations, setAttestations] = useState<EnrichedAttestationResult[]>(data ?? [])
  const [isLoading, setIsLoading] = useState(!data)
  const [error, setError] = useState<string | null>(null)
  const [selectedAttestation, setSelectedAttestation] = useState<EnrichedAttestationResult | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { chainId } = useWallet()
  const sectionPadding = showHeading ? "py-16" : "py-4"

  useEffect(() => {
    // Skip fetch if data was provided externally
    if (data) {
      setAttestations(data)
      setIsLoading(false)
      return
    }

    async function fetchAttestations() {
      try {
        setIsLoading(true)
        setError(null)
        logger.log('[LatestAttestations] Fetching attestations for chain', chainId)
        
        const results = await getLatestAttestationsWithMetadata(chainId, ATTESTATION_QUERY_CONFIG.defaultLimit)
        setAttestations(results)
        
        logger.log('[LatestAttestations] Loaded', results.length, 'attestations')
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load attestations'
        logger.error('[LatestAttestations] Error:', err)
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAttestations()
  }, [chainId, data])

  const handleCardClick = (attestation: EnrichedAttestationResult) => {
    setSelectedAttestation(attestation)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedAttestation(null)
  }

  if (isLoading) {
    return (
      <div className={sectionPadding}>
        {showHeading ? (
          <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">Latest Attestations</h2>
        ) : null}
        <div className="flex justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={sectionPadding}>
        {showHeading ? (
          <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">Latest Attestations</h2>
        ) : null}
        <div className="text-center text-destructive">
          <p>Error loading attestations: {error}</p>
        </div>
      </div>
    )
  }

  if (attestations.length === 0) {
    return (
      <div className={sectionPadding}>
        {showHeading ? (
          <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">Latest Attestations</h2>
        ) : null}
        <div className="text-center text-muted-foreground">
          <p>No attestations found yet. Be the first to submit one!</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={sectionPadding}>
        {showHeading ? (
          <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">Latest Attestations</h2>
        ) : null}
        <div className="grid grid-cols-1 gap-4 max-w-4xl mx-auto">
          {attestations.map((attestation) => (
            <AttestationCard 
              key={attestation.uid} 
              attestation={attestation}
              onClick={() => handleCardClick(attestation)}
            />
          ))}
        </div>
      </div>

      <AttestationDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        attestation={selectedAttestation}
      />
    </>
  )
}
