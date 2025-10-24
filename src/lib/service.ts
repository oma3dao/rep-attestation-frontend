import { useState } from 'react'
import { useBASClient } from './bas'
import { useEASClient } from './eas'
import { useWallet } from './blockchain'
import type { AttestationData, AttestationResult } from './types'
import { ATTESTATION_SERVICES, getServicesForChain, getAttestationService } from '@/config/attestation-services'

type ServiceType = keyof typeof ATTESTATION_SERVICES

// Determine which service to use based on current chain and preferences
function selectAttestationService(chainId: number, preferredService?: ServiceType): ServiceType {
  const availableServices = getServicesForChain(chainId)
  
  // If a specific service is requested and it supports the chain, use it
  if (preferredService) {
    const preferredServiceConfig = getAttestationService(preferredService)
    if (preferredServiceConfig?.supportedChains.includes(chainId)) {
      return preferredService
    }
  }
  
  // Auto-select first available service for current chain
  if (availableServices.length > 0) {
    return availableServices[0].id as ServiceType
  }
  
  // Default to BAS if no matches (will handle unsupported chain gracefully)
  return 'bas'
}

// Check if a service is available (deployed and ready)
function isServiceAvailable(serviceId: ServiceType): boolean {
  const service = getAttestationService(serviceId)
  if (!service) return false
  
  // Both EAS and BAS are now available
  switch (serviceId) {
    case 'eas':
      return true
    case 'bas':
      return true
    default:
      return false
  }
}

// High-level attestation hook for forms
export function useAttestation() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState<AttestationResult | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  
  // Get wallet state
  const { isConnected, chainId } = useWallet()
  
  // Get service clients
  const basClient = useBASClient()
  const easClient = useEASClient()
  
  // Submit attestation to the appropriate service
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
      // Determine target network (use current chain if no preference)
      const targetChainId = preferredNetwork || chainId
      
      // Select which attestation service to use
      const serviceType = selectAttestationService(targetChainId, preferredService)
      
      // Verify service is available
      if (!isServiceAvailable(serviceType)) {
        throw new Error(`Service ${serviceType} is not yet available`)
      }
      
      let result: AttestationResult
      
      // Route to appropriate service
      switch (serviceType) {
        case 'eas':
          result = await easClient.createAttestation(data)
          break
        
        case 'bas':
          result = await basClient.createAttestation(data)
          break
        
        default:
          throw new Error(`Unsupported attestation service: ${serviceType}`)
      }
      
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
  
  // Get available services for current chain
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
  
  // Check if current network supports attestations
  const isNetworkSupported = () => {
    return getAvailableServices().length > 0
  }
  
  // Get recommended service for current chain
  const getRecommendedService = () => {
    const serviceId = selectAttestationService(chainId)
    return getAttestationService(serviceId)
  }
  
  return {
    // Main functions
    submitAttestation,
    
    // State
    isSubmitting,
    lastResult,
    lastError,
    
    // Wallet state
    isConnected,
    currentChainId: chainId,
    
    // Service information
    isNetworkSupported: isNetworkSupported(),
    availableServices: getAvailableServices(),
    recommendedService: getRecommendedService(),
    
    // Utilities
    clearError: () => setLastError(null),
    clearResult: () => setLastResult(null)
  }
} 