import { bsc, bscTestnet } from 'thirdweb/chains'
// import { customChain } from '@/lib/thirdweb'

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
  supportedChains: [bscTestnet.id, bsc.id],
  // When custom chain is ready, add support:
  // supportedChains: [bscTestnet.id, bsc.id, customChain.id],
  contracts: {
    [bscTestnet.id]: '0x6c2270298b1e6046898a322acB3Cbad6F99f7CBD', // Official BAS testnet contract
    [bsc.id]: '0x247Fe62d887bc9410c3848DF2f322e52DA9a51bC' // Official BAS mainnet contract
    // When custom chain is ready, add contract:
    // [customChain.id]: '0x0000000000000000000000000000000000000000' // TODO: Deploy to custom chain
  },
  features: [
    'On-chain attestations',
    'Schema registry',
    'Revocation support',
    'Low gas costs',
    'BNB Smart Chain native'
  ],
  estimatedGasCost: {
    [bscTestnet.id]: BigInt('100000'), // ~0.0002 BNB at 2 gwei
    [bsc.id]: BigInt('100000')
    // When custom chain is ready, add gas cost:
    // [customChain.id]: BigInt('50000') // Adjust based on custom chain gas costs
  }
}

// Custom Chain Attestation Service (commented out - uncomment when needed)
// export const CUSTOM_ATTESTATION_CONFIG: AttestationServiceConfig = {
//   id: 'custom-attest',
//   name: 'Custom Chain Attestation Service',
//   description: 'Attestation service for custom blockchain network',
//   website: 'https://custom-chain.com/attestation',
//   docs: 'https://docs.custom-chain.com/attestation',
//   supportedChains: [customChain.id],
//   contracts: {
//     [customChain.id]: '0x0000000000000000000000000000000000000000' // TODO: Deploy contract
//   },
//   features: [
//     'On-chain attestations',
//     'Custom schema support',
//     'Low latency',
//     'Custom features'
//   ],
//   estimatedGasCost: {
//     [customChain.id]: BigInt('30000') // Adjust based on actual costs
//   }
// }

// All available attestation services
export const ATTESTATION_SERVICES: Record<string, AttestationServiceConfig> = {
  [BAS_CONFIG.id]: BAS_CONFIG
  // When custom service is ready, add it:
  // [CUSTOM_ATTESTATION_CONFIG.id]: CUSTOM_ATTESTATION_CONFIG
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