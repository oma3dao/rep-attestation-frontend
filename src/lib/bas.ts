/*
 * BAS (Binance Attestation Service) Client
 * 
 * Official BAS SDK implementation with proper ABI encoding
 */

import { useActiveAccount, useActiveWallet } from 'thirdweb/react'
import { bscTestnet, bsc } from 'thirdweb/chains'
import { prepareContractCall, sendTransaction, getContract } from 'thirdweb'
import { SchemaEncoder } from '@bnb-attestation-service/bas-sdk'
import { client } from '@/app/client'
import type { AttestationServiceClient, AttestationData, AttestationResult } from './types'
import { BAS_CONFIG, getContractAddress } from '@/config/attestation-services'
import { useWallet } from '@/lib/blockchain'
import { extractAddressFromDID } from '@/lib/utils'
import { getSchema } from '@/config/schemas'

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
  }
] as const

/**
 * Convert our schema fields to BAS schema string for encoding
 * @param schema - Our schema definition
 * @returns BAS schema string
 */
function createBASSchemaString(schema: any): string {
  const fieldStrings = schema.fields.map((field: any) => {
    let type = field.type
    
    // Convert our types to BAS/Solidity types
    switch (field.type) {
      case 'integer':
        type = field.max && field.max <= 255 ? 'uint8' : 'uint256'
        break
      case 'datetime':
        type = 'string' // Store as ISO string
        break
      case 'uri':
        type = 'string'
        break
      case 'array':
        type = 'string[]' // Assume string array, could be made more specific
        break
      case 'enum':
        type = 'string'
        break
      case 'string':
      default:
        type = 'string'
        break
    }
    
    return `${type} ${field.name}`
  })
  
  return fieldStrings.join(',')
}

/**
 * Convert attestation data to BAS encoding format
 * @param schema - Schema definition
 * @param data - Attestation data
 * @returns Array of encoded values for SchemaEncoder
 */
function convertToBASData(schema: any, data: Record<string, any>): Array<{name: string, value: any, type: string}> {
  return schema.fields.map((field: any) => {
    let value = data[field.name] || ''
    let type = field.type
    
    // Convert our types to BAS/Solidity types and format values
    switch (field.type) {
      case 'integer':
        type = field.max && field.max <= 255 ? 'uint8' : 'uint256'
        value = parseInt(value) || 0
        break
      case 'datetime':
        type = 'string'
        value = value ? new Date(value).toISOString() : ''
        break
      case 'uri':
        type = 'string'
        value = value || ''
        break
      case 'array':
        type = 'string[]'
        value = Array.isArray(value) ? value : (value ? [value] : [])
        break
      case 'enum':
        type = 'string'
        value = value || ''
        break
      case 'string':
      default:
        type = 'string'
        value = String(value || '')
        break
    }
    
    return {
      name: field.name,
      value,
      type
    }
  })
}

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
  // Get wallet state from current wallet provider
  const { isConnected, address, chainId, isChainSupported } = useWallet()
  const account = useActiveAccount()
  const wallet = useActiveWallet()
  
  // Use wallet provider's chain ID
  const currentChainId = chainId || bscTestnet.id // Default to BSC testnet
  const contractAddress = getContractAddress('bas', currentChainId)
  
  // Check if we can operate
  const shouldEnable = !!contractAddress && isConnected && account

  // NOW we can do conditional returns after all hooks are called
  if (!shouldEnable) {
    return {
      createAttestation: async () => {
        throw new Error(`BAS not supported on chain ${currentChainId}`)
      },
      isConnected: false,
      isChainSupported: false,
      estimateGas: async () => {
        throw new Error(`BAS not supported on chain ${currentChainId}`)
      },
      getAttestation: async () => {
        throw new Error(`BAS not supported on chain ${currentChainId}`)
      },
      revokeAttestation: async () => {
        throw new Error(`BAS not supported on chain ${currentChainId}`)
      },
      registerSchema: async () => {
        throw new Error(`BAS not supported on chain ${currentChainId}`)
      },
      getSchema: async () => {
        throw new Error(`BAS not supported on chain ${currentChainId}`)
      }
    }
  }

  // Helper function to encode attestation data using BAS SchemaEncoder
  const encodeAttestationData = (schema: any, data: Record<string, any>): string => {
    try {
      // Create BAS schema string
      const schemaString = createBASSchemaString(schema)
      console.log('🔧 BAS Schema String:', schemaString)
      
      // Convert data to BAS format
      const basData = convertToBASData(schema, data)
      console.log('🔧 BAS Data Format:', basData)
      
      // Use BAS SchemaEncoder
      const schemaEncoder = new SchemaEncoder(schemaString)
      const encodedData = schemaEncoder.encodeData(basData)
      
      console.log('✅ Encoded Data:', encodedData)
      return encodedData
      
    } catch (error) {
      console.error('❌ Encoding failed:', error)
      // Fallback to simple encoding if BAS encoding fails
      const jsonData = JSON.stringify(data)
      return `0x${Buffer.from(jsonData, 'utf8').toString('hex')}`
    }
  }

  // Helper function to extract expiration time from attestation data
  const extractExpirationTime = (data: Record<string, any>): bigint => {
    const expirationFields = ['expireAt', 'expirationTime', 'expires', 'validUntil']
    
    for (const field of expirationFields) {
      if (data[field]) {
        const value = data[field]
        if (typeof value === 'string') {
          const timestamp = new Date(value).getTime() / 1000
          if (!isNaN(timestamp)) {
            return BigInt(Math.floor(timestamp))
          }
        } else if (typeof value === 'number') {
          return BigInt(Math.floor(value))
        }
      }
    }
    
    return BigInt(0)
  }

  const createAttestation = async (data: AttestationData): Promise<AttestationResult> => {
    if (!isConnected || !address || !wallet) {
      throw new Error('Wallet not connected')
    }

    const contractAddress = getContractAddress('bas', currentChainId)
    if (!contractAddress) {
      throw new Error(`BAS not supported on chain ${currentChainId}`)
    }

    // Get schema and validate deployment
    const schema = getSchema(data.schemaId)
    if (!schema) {
      throw new Error(`Schema ${data.schemaId} not found`)
    }

    const deployedUID = schema.deployedUIDs?.[currentChainId]
    if (!deployedUID) {
      throw new Error(`Schema ${data.schemaId} not deployed on chain ${currentChainId}`)
    }

    if (deployedUID === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      throw new Error(`Schema ${data.schemaId} deployment UID not set for chain ${currentChainId}. Please update schemas.ts with the actual deployed UID.`)
    }

    try {
      // Extract recipient address from DID
      const recipientAddress = extractAddressFromDID(data.recipient)
      
      // Encode the attestation data
      const encodedData = encodeAttestationData(schema, data.data)
      const expirationTime = extractExpirationTime(data.data)
      const revocable = false // Always false as per requirements

      // Prepare the contract call
      const contract = getContract({
        client,
        chain: currentChainId === bsc.id ? bsc : bscTestnet,
        address: contractAddress as `0x${string}`,
        abi: BAS_ABI
      })

      const transaction = prepareContractCall({
        contract,
        method: 'attest',
        params: [deployedUID as `0x${string}`, recipientAddress as `0x${string}`, encodedData as `0x${string}`, expirationTime, revocable]
      })

      // Send transaction
      const { transactionHash } = await sendTransaction({
        transaction,
        account: account!
      })

      console.log('✅ Transaction sent:', transactionHash)

      // Return basic result
      const result: AttestationResult = {
        transactionHash,
        attestationId: 'pending', // Will be updated when we can parse logs
        blockNumber: 0, // Will be updated when we can get receipt
        gasUsed: BigInt(0) // Will be updated when we can get receipt
      }

      return result

    } catch (error: any) {
      console.error('❌ Transaction failed:', error)
      const message = error.message || error.shortMessage || error.reason || 'Transaction failed'
      throw new Error(`Transaction failed: ${message}`)
    }
  }

  return {
    createAttestation,
    revokeAttestation: async () => {
      throw new Error('Revocation not implemented yet')
    },
    getAttestation: async () => {
      throw new Error('Get attestation not implemented yet')
    },
    registerSchema: async () => {
      throw new Error('Register schema not implemented yet')
    },
    getSchema: async () => {
      throw new Error('Get schema not implemented yet')
    },
    estimateGas: async () => {
      return BigInt('100000') // Default estimate
    },
    isConnected: isConnected && isChainSupported,
    getCurrentChain: () => currentChainId,
    isChainSupported,
    contractAddress,
    supportedChains: BAS_CONFIG.supportedChains
  }
} 