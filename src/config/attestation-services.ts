import { CHAIN_IDS, omachainTestnet, omachainMainnet, bscTestnet, bscMainnet } from './chains'

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
  supportedChains: [CHAIN_IDS.BSC_TESTNET, CHAIN_IDS.BSC_MAINNET],
  contracts: {
    [CHAIN_IDS.BSC_TESTNET]: bscTestnet.contracts.basContract!,
    [CHAIN_IDS.BSC_MAINNET]: bscMainnet.contracts.basContract!,
  },
  features: [
    'On-chain attestations',
    'Schema registry',
    'Revocation support',
    'Low gas costs',
    'BNB Smart Chain native'
  ],
  estimatedGasCost: {
    [CHAIN_IDS.BSC_TESTNET]: BigInt('100000'), // ~0.0002 BNB at 2 gwei
    [CHAIN_IDS.BSC_MAINNET]: BigInt('100000')
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

// EAS (Ethereum Attestation Service) Configuration for OMAchain
export const EAS_CONFIG: AttestationServiceConfig = {
  id: 'eas',
  name: 'Ethereum Attestation Service',
  description: 'Decentralized attestation service on OMAchain',
  website: 'https://attest.org/',
  docs: 'https://docs.attest.org/',
  supportedChains: [CHAIN_IDS.OMACHAIN_TESTNET, CHAIN_IDS.OMACHAIN_MAINNET],
  contracts: {
    [CHAIN_IDS.OMACHAIN_TESTNET]: omachainTestnet.contracts.easContract!,
    [CHAIN_IDS.OMACHAIN_MAINNET]: omachainMainnet.contracts.easContract!,
  },
  features: [
    'On-chain attestations',
    'Schema registry',
    'Revocation support',
    'Composable attestations',
    'OMAchain native'
  ],
  estimatedGasCost: {
    [CHAIN_IDS.OMACHAIN_TESTNET]: BigInt('100000'), // Adjust based on actual costs
    [CHAIN_IDS.OMACHAIN_MAINNET]: BigInt('100000')
  }
}

// All available attestation services
export const ATTESTATION_SERVICES: Record<string, AttestationServiceConfig> = {
  [EAS_CONFIG.id]: EAS_CONFIG,
  [BAS_CONFIG.id]: BAS_CONFIG
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

// Query configuration for fetching latest attestations
export const ATTESTATION_QUERY_CONFIG = {
  // Progressive block ranges to try when querying for attestations
  // Tries smaller ranges first for efficiency, expands if needed
  blockRanges: [
    { blocks: 1000, label: '~30 minutes' },
    { blocks: 10000, label: '~5 hours' },
    { blocks: 1000000, label: '~20 days' }
  ],
  // Default number of attestations to display
  defaultLimit: 20,
  // Safety multiplier when fetching events (to account for filtering)
  fetchMultiplier: 2
}

// Controller Witness grace period configuration
// When creating key-binding or linked-identifier attestations, the effectiveAt
// default is pushed forward by this amount so the Controller Witness API can
// observe and attest controller evidence before the attestation becomes effective.
export const CONTROLLER_WITNESS_CONFIG = {
  /** Schema IDs whose effectiveAt default gets the grace period */
  graceSchemaIds: ['key-binding', 'linked-identifier'],
  /** Seconds added to current time for the default effectiveAt */
  graceSeconds: 120, // 2 minutes — enough for OMAchain finality + witness call
}