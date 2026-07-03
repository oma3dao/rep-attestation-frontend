import { useState } from 'react'
import { useEASClient } from './eas'
import { useWallet } from './blockchain'
import type { AttestationData, AttestationResult } from './types'
import { ATTESTATION_SERVICES, getServicesForChain, getAttestationService } from '@/config/attestation-services'

type ServiceType = keyof typeof ATTESTATION_SERVICES

// Determine which service to use based on current chain and preferences
function selectAttestationService(chainId: number, preferredService?: ServiceType): ServiceType {
  const availableServices = getServicesForChain(chainId)

  if (preferredService) {
    const preferredServiceConfig = getAttestationService(preferredService)
    if (preferredServiceConfig?.supportedChains.includes(chainId)) {
      return preferredService
    }
  }

  if (availableServices.length > 0) {
    return availableServices[0].id as ServiceType
  }

  return 'eas'
}

function isServiceAvailable(serviceId: ServiceType): boolean {
  return getAttestationService(serviceId)?.id === 'eas'
}

// High-level attestation hook for forms
export function useAttestation() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState<AttestationResult | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  const { isConnected, chainId } = useWallet()
  const easClient = useEASClient()

  const submitAttestation = async (
    data: AttestationData,
    preferredNetwork?: number,
    preferredService?: ServiceType
  ): Promise<AttestationResult> => {
    if (!isConnected) {
      throw new Error('Wallet not connected')
    }

    setIsSubmitting(true)
    setLastError(null)

    try {
      const targetChainId = preferredNetwork || chainId
      const serviceType = selectAttestationService(targetChainId, preferredService)

      if (!isServiceAvailable(serviceType)) {
        throw new Error(`Service ${serviceType} is not yet available`)
      }

      const result = await easClient.createAttestation(data)
      setLastResult(result)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setLastError(errorMessage)
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }

  const getAvailableServices = () => {
    return getServicesForChain(chainId)
      .filter(service => isServiceAvailable(service.id as ServiceType))
      .map(service => ({
        key: service.id as ServiceType,
        name: service.name,
        description: service.description,
        supportedChains: service.supportedChains,
        features: service.features
      }))
  }

  const isNetworkSupported = () => getAvailableServices().length > 0

  const getRecommendedService = () => {
    const serviceId = selectAttestationService(chainId)
    return getAttestationService(serviceId)
  }

  return {
    submitAttestation,
    isSubmitting,
    lastResult,
    lastError,
    isConnected,
    currentChainId: chainId,
    isNetworkSupported: isNetworkSupported(),
    availableServices: getAvailableServices(),
    recommendedService: getRecommendedService(),
    clearError: () => setLastError(null),
    clearResult: () => setLastResult(null)
  }
}
