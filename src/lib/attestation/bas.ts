/*
 * BAS (Binance Attestation Service) Client
 * 
 * Current approach: Schema UIDs are stored in schemas.ts (gets overwritten by update-schemas)
 * Future approach: Read from deployment files like:
 *   - Endorsement.bas.json (schema definition)  
 *   - Endorsement.deployed.bas.json (contains schemaUID, deployment block, etc.)
 * 
 * The update-schemas script could be enhanced to:
 * 1. Read schema definitions from *.bas.json
 * 2. Read deployment info from *.deployed.bas.json  
 * 3. Merge them into schemas.ts with deployedUIDs
 */

import { 
  useAccount, 
  useChainId, 
  useWalletClient, 
  usePublicClient,
  useWriteContract,
  useReadContract
} from 'wagmi'
import { encodeFunctionData, type Hex, type Address } from 'viem'
import type { AttestationServiceClient, AttestationData, AttestationResult } from './types'
import { BAS_CONFIG, getContractAddress } from '@/config/attestation-services'
import { getChain } from '@/config/chains'

// BAS Contract ABI (simplified for core functions)
const BAS_ABI = [
  {
    type: 'function',
    name: 'attest',
    inputs: [
      { name: 'schema', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
      { name: 'data', type: 'bytes' },
      { name: 'expirationTime', type: 'uint64' },
      { name: 'revocable', type: 'bool' }
    ],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'revoke',
    inputs: [{ name: 'attestationId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'getAttestation',
    inputs: [{ name: 'attestationId', type: 'bytes32' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'uid', type: 'bytes32' },
        { name: 'schema', type: 'bytes32' },
        { name: 'recipient', type: 'address' },
        { name: 'attester', type: 'address' },
        { name: 'time', type: 'uint64' },
        { name: 'expirationTime', type: 'uint64' },
        { name: 'revocable', type: 'bool' },
        { name: 'refUID', type: 'bytes32' },
        { name: 'data', type: 'bytes' },
        { name: 'revoked', type: 'bool' }
      ]
    }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'registerSchema',
    inputs: [
      { name: 'schema', type: 'string' },
      { name: 'resolver', type: 'address' },
      { name: 'revocable', type: 'bool' }
    ],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'getSchema',
    inputs: [{ name: 'schemaId', type: 'bytes32' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'uid', type: 'bytes32' },
        { name: 'resolver', type: 'address' },
        { name: 'revocable', type: 'bool' },
        { name: 'schema', type: 'string' }
      ]
    }],
    stateMutability: 'view'
  },
  {
    type: 'event',
    name: 'Attested',
    inputs: [
      { indexed: true, name: 'recipient', type: 'address' },
      { indexed: true, name: 'attester', type: 'address' },
      { indexed: false, name: 'uid', type: 'bytes32' },
      { indexed: true, name: 'schema', type: 'bytes32' }
    ]
  },
  {
    type: 'event',
    name: 'Revoked',
    inputs: [
      { indexed: true, name: 'recipient', type: 'address' },
      { indexed: true, name: 'attester', type: 'address' },
      { indexed: false, name: 'uid', type: 'bytes32' },
      { indexed: true, name: 'schema', type: 'bytes32' }
    ]
  }
] as const

export class BASClient implements AttestationServiceClient {
  constructor() {
    // Constructor logic moved to individual methods using hooks
  }

  async createAttestation(data: AttestationData): Promise<AttestationResult> {
    throw new Error('BAS client must be used within React component with hooks')
  }

  async revokeAttestation(attestationId: string): Promise<string> {
    throw new Error('BAS client must be used within React component with hooks')
  }

  async getAttestation(attestationId: string): Promise<any> {
    throw new Error('BAS client must be used within React component with hooks')
  }

  async registerSchema(schema: any): Promise<string> {
    throw new Error('BAS client must be used within React component with hooks')
  }

  async getSchema(schemaId: string): Promise<any> {
    throw new Error('BAS client must be used within React component with hooks')
  }

  async estimateGas(data: AttestationData): Promise<bigint> {
    throw new Error('BAS client must be used within React component with hooks')
  }

  isConnected(): boolean {
    throw new Error('BAS client must be used within React component with hooks')
  }

  getCurrentChain(): number | undefined {
    throw new Error('BAS client must be used within React component with hooks')
  }
}

// Hook-based BAS client for use in React components
export function useBASClient() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  // Check if current chain is supported
  const isChainSupported = BAS_CONFIG.supportedChains.includes(chainId)
  const contractAddress = getContractAddress('bas', chainId)
  if (!contractAddress) {
    throw new Error(`BAS not supported on chain ${chainId}`)
  }

  // Helper function to encode attestation data
  const encodeAttestationData = (data: Record<string, any>): Hex => {
    // For BAS/EAS compatibility, use empty strings for missing optional fields
    // This ensures consistent searchability and indexer compatibility
    const jsonData = JSON.stringify(data)
    return `0x${Buffer.from(jsonData, 'utf8').toString('hex')}` as Hex
  }

  // Helper function to extract Ethereum address from CAIP-2 address
  const extractAddressFromCAIP2 = (caip2Address: string): Address => {
    // CAIP-2 format: namespace:chainId:address
    // Example: eip155:1:0x742d35Cc6634C0532925a3b844Bc454e4438f44e
    const parts = caip2Address.split(':')
    if (parts.length === 3 && parts[0] === 'eip155') {
      const address = parts[2]
      if (address.startsWith('0x') && address.length === 42) {
        return address as Address
      }
    }
    throw new Error(`Invalid CAIP-2 address format: ${caip2Address}`)
  }

  // Helper function to extract expiration time from attestation data
  const extractExpirationTime = (data: Record<string, any>): bigint => {
    // Look for common expiration field names
    const expirationFields = ['expireAt', 'expirationTime', 'expires', 'validUntil']
    
    for (const field of expirationFields) {
      if (data[field]) {
        const value = data[field]
        if (typeof value === 'string') {
          // Try to parse as ISO date or unix timestamp
          const timestamp = new Date(value).getTime() / 1000
          if (!isNaN(timestamp)) {
            return BigInt(Math.floor(timestamp))
          }
        } else if (typeof value === 'number') {
          return BigInt(Math.floor(value))
        }
      }
    }
    
    // Default to no expiration
    return BigInt(0)
  }

  const createAttestation = async (data: AttestationData): Promise<AttestationResult> => {
    if (!isConnected || !address || !publicClient) {
      throw new Error('Wallet not connected')
    }

    const contractAddress = getContractAddress('bas', chainId)
    if (!contractAddress) {
      throw new Error(`BAS not supported on chain ${chainId}`)
    }

    // Get the schema UID from the schema definition
    const { getSchema } = await import('@/config/schemas')
    const schema = getSchema(data.schemaId)
    if (!schema) {
      throw new Error(`Schema ${data.schemaId} not found`)
    }

    const deployedUID = schema.deployedUIDs?.[chainId]
    if (!deployedUID) {
      throw new Error(`Schema ${data.schemaId} not deployed on chain ${chainId}`)
    }

    if (deployedUID === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      throw new Error(`Schema ${data.schemaId} deployment UID not set for chain ${chainId}. Please update schemas.ts with the actual deployed UID.`)
    }

    try {
      // Encode attestation data
      const encodedData = encodeAttestationData(data.data)
      
      // Set defaults based on requirements
      const expirationTime = extractExpirationTime(data.data)
      const revocable = false // Always false as per requirements

      // Send transaction
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: BAS_ABI,
        functionName: 'attest',
        args: [
          deployedUID as Hex, // Use the deployed UID from schema
          extractAddressFromCAIP2(data.recipient),
          encodedData,
          expirationTime,
          revocable
        ],
        value: BigInt(0) // BAS is usually free
      })

      // Wait for transaction receipt
      const receipt = await publicClient!.waitForTransactionReceipt({ hash })
      
      // Extract attestation ID from events
      const attestationId = extractAttestationId(receipt.logs)

      return {
        transactionHash: hash,
        attestationId,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed
      }

    } catch (error: any) {
      console.error('BAS attestation failed:', error)
      
      // Handle common errors
      if (error.message?.includes('User rejected')) {
        throw new Error('Transaction was rejected by user')
      }
      if (error.message?.includes('insufficient funds')) {
        throw new Error('Insufficient funds for transaction')
      }
      
      throw new Error(`Attestation failed: ${error.message || error}`)
    }
  }

  const revokeAttestation = async (attestationId: string): Promise<string> => {
    if (!address || !isConnected || !contractAddress) {
      throw new Error('Wallet not connected or unsupported chain')
    }

    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: BAS_ABI,
        functionName: 'revoke',
        args: [attestationId as Hex]
      })

      await publicClient!.waitForTransactionReceipt({ hash })
      return hash
    } catch (error: any) {
      throw new Error(`Revocation failed: ${error.message || error}`)
    }
  }

  const { data: attestationData } = useReadContract({
    address: contractAddress,
    abi: BAS_ABI,
    functionName: 'getAttestation',
    args: ['0x'] as [Hex], // This will be overridden when called
    query: { enabled: false } // Only run when explicitly called
  })

  const getAttestation = async (attestationId: string): Promise<any> => {
    if (!contractAddress) {
      throw new Error('BAS not available on current chain')
    }

    try {
      const result = await publicClient!.readContract({
        address: contractAddress,
        abi: BAS_ABI,
        functionName: 'getAttestation',
        args: [attestationId as Hex]
      })
      return result
    } catch (error: any) {
      throw new Error(`Failed to get attestation: ${error.message || error}`)
    }
  }

  const registerSchema = async (schema: any): Promise<string> => {
    if (!address || !isConnected || !contractAddress) {
      throw new Error('Wallet not connected or unsupported chain')
    }

    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: BAS_ABI,
        functionName: 'registerSchema',
        args: [
          schema.definition,
          '0x0000000000000000000000000000000000000000' as Address, // No resolver
          true // Revocable
        ]
      })

      const receipt = await publicClient!.waitForTransactionReceipt({ hash })
      return extractSchemaId(receipt.logs)
    } catch (error: any) {
      throw new Error(`Schema registration failed: ${error.message || error}`)
    }
  }

  const getSchema = async (schemaId: string): Promise<any> => {
    if (!contractAddress) {
      throw new Error('BAS not available on current chain')
    }

    try {
      const result = await publicClient!.readContract({
        address: contractAddress,
        abi: BAS_ABI,
        functionName: 'getSchema',
        args: [schemaId as Hex]
      })
      return result
    } catch (error: any) {
      throw new Error(`Failed to get schema: ${error.message || error}`)
    }
  }

  const estimateGas = async (data: AttestationData): Promise<bigint> => {
    if (!contractAddress || !publicClient) {
      throw new Error('BAS not available on current chain')
    }

    // Get the schema UID from the schema definition  
    const { getSchema } = await import('@/config/schemas')
    const schema = getSchema(data.schemaId)
    if (!schema) {
      throw new Error(`Schema ${data.schemaId} not found`)
    }

    const deployedUID = schema.deployedUIDs?.[chainId]
    if (!deployedUID) {
      throw new Error(`Schema ${data.schemaId} not deployed on chain ${chainId}`)
    }

    if (deployedUID === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      throw new Error(`Schema ${data.schemaId} deployment UID not set for chain ${chainId}. Please update schemas.ts with the actual deployed UID.`)
    }

    try {
      const encodedData = encodeAttestationData(data.data)
      const expirationTime = extractExpirationTime(data.data)
      const revocable = false // Always false as per requirements

      const gasEstimate = await publicClient.estimateContractGas({
        address: contractAddress,
        abi: BAS_ABI,
        functionName: 'attest',
        args: [
          deployedUID as Hex, // Use the deployed UID from schema
          extractAddressFromCAIP2(data.recipient),
          encodedData,
          expirationTime,
          revocable
        ],
        account: address
      })
      
      return gasEstimate
    } catch (error: any) {
      console.warn('Gas estimation failed, using default:', error)
      return BAS_CONFIG.estimatedGasCost?.[chainId] || BigInt('100000')
    }
  }

  return {
    createAttestation,
    revokeAttestation,
    getAttestation,
    registerSchema,
    getSchema,
    estimateGas,
    isConnected: isConnected && isChainSupported,
    getCurrentChain: () => chainId,
    // Additional utility methods
    isChainSupported,
    contractAddress,
    supportedChains: BAS_CONFIG.supportedChains,
    // Get deployment info for efficient searching
    getDeploymentInfo: (schemaId: string) => {
      const { getSchema, getDeployedUID, getDeploymentBlock } = require('@/config/schemas')
      const schema = getSchema(schemaId)
      if (!schema) return null
      
      return {
        schemaUID: getDeployedUID(schemaId, chainId),
        deploymentBlock: getDeploymentBlock(schemaId, chainId),
        chainId
      }
    }
  }
}

// Helper functions
function extractAttestationId(logs: any[]): string {
  // Look for Attested event in logs
  for (const log of logs) {
    if (log.topics && log.topics[0] && log.topics[0].includes('Attested')) {
      // The UID is typically in the event data
      return log.data || log.topics[2] || ''
    }
  }
  throw new Error('Attestation ID not found in transaction logs')
}

function extractSchemaId(logs: any[]): string {
  // Similar logic for schema registration events
  // This would depend on the specific BAS contract implementation
  throw new Error('Schema ID extraction not implemented')
} 