import { BSC_TESTNET, BSC_MAINNET } from './chains'

// Attestation service configuration
export interface AttestationServiceConfig {
  id: string
  name: string
  description: string
  website: string
  docs: string
  supportedChains: number[]
  contracts: Record<number, string> // chainId -> contract address
  features: string[]
  estimatedGasCost?: Record<number, bigint> // chainId -> gas cost in wei
}

// BAS (Binance Attestation Service) Configuration
export const BAS_CONFIG: AttestationServiceConfig = {
  id: 'bas',
  name: 'Binance Attestation Service',
  description: 'Decentralized attestation service built on BNB Smart Chain',
  website: 'https://docs.bnbchain.org/bas/',
  docs: 'https://docs.bnbchain.org/bas/developer-guide/',
  supportedChains: [BSC_TESTNET.id, BSC_MAINNET.id],
  contracts: {
    [BSC_TESTNET.id]: '0x6c2270298b1e6046898e8367e0ca270fecdbd14e', // BAS testnet contract
    [BSC_MAINNET.id]: '0x0000000000000000000000000000000000000000' // TODO: Add mainnet contract
  },
  features: [
    'On-chain attestations',
    'Schema registry',
    'Revocation support',
    'Low gas costs',
    'BNB Smart Chain native'
  ],
  estimatedGasCost: {
    [BSC_TESTNET.id]: BigInt('100000'), // ~0.0002 BNB at 2 gwei
    [BSC_MAINNET.id]: BigInt('100000')
  }
}

// All available attestation services
export const ATTESTATION_SERVICES: Record<string, AttestationServiceConfig> = {
  [BAS_CONFIG.id]: BAS_CONFIG
  // TODO: Add EAS and other services
}

// Helper functions
export function getAttestationService(id: string): AttestationServiceConfig | undefined {
  return ATTESTATION_SERVICES[id]
}

export function getServicesForChain(chainId: number): AttestationServiceConfig[] {
  return Object.values(ATTESTATION_SERVICES).filter(
    service => service.supportedChains.includes(chainId)
  )
}

export function getContractAddress(serviceId: string, chainId: number): string | undefined {
  const service = getAttestationService(serviceId)
  return service?.contracts[chainId]
}

export function getAllServiceIds(): string[] {
  return Object.keys(ATTESTATION_SERVICES)
} 