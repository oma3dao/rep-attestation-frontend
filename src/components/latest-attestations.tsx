"use client"

import { useEffect, useState } from 'react'
import { AttestationCard } from './attestation-card'
import { AttestationDetailModal } from './attestation-detail-modal'
import { getLatestAttestationsWithMetadata, type EnrichedAttestationResult } from '@/lib/attestation-queries'
import { useWallet } from '@/lib/blockchain'
import logger from '@/lib/logger'
import { ATTESTATION_QUERY_CONFIG } from '@/config/attestation-services'

export function LatestAttestations() {
  const [attestations, setAttestations] = useState<EnrichedAttestationResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAttestation, setSelectedAttestation] = useState<EnrichedAttestationResult | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { chainId } = useWallet()

  useEffect(() => {
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
  }, [chainId])

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
      <div className="py-16">
        <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">Latest Attestations</h2>
        <div className="flex justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-16">
        <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">Latest Attestations</h2>
        <div className="text-center text-destructive">
          <p>Error loading attestations: {error}</p>
        </div>
      </div>
    )
  }

  if (attestations.length === 0) {
    return (
      <div className="py-16">
        <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">Latest Attestations</h2>
        <div className="text-center text-muted-foreground">
          <p>No attestations found yet. Be the first to submit one!</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="py-16">
        <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">Latest Attestations</h2>
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
