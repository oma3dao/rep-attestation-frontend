/*
 * BAS (Binance Attestation Service) Client
 * 
 * Official BAS SDK implementation with proper ABI encoding
 */

import { useActiveAccount, useActiveWallet, useActiveWalletChain } from 'thirdweb/react'
import { bscTestnet, bsc } from 'thirdweb/chains'
import { prepareContractCall, sendTransaction, getContract } from 'thirdweb'
import { SchemaEncoder, BAS } from '@bnb-attestation-service/bas-sdk'
import { client } from '@/app/client'
import type { AttestationServiceClient, AttestationData, AttestationResult } from './types'
import { BAS_CONFIG, getContractAddress } from '@/config/attestation-services'
import { useWallet } from '@/lib/blockchain'
import { didToAddress, computeDidHash } from '@oma3/omatrust/identity'
import { getSchema } from '@/config/schemas'
import { ethers6Adapter } from 'thirdweb/adapters/ethers6'
import logger from '@/lib/logger'

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
        // Check if this is a hash field that should be bytes32
        if (field.format === 'bytes32' || (field.pattern && field.pattern === '^0x[a-fA-F0-9]{64}$')) {
          type = 'bytes32'
          // Ensure value is a valid 32-byte hex string
          value = value && typeof value === 'string' && value.startsWith('0x') ? value : '0x0000000000000000000000000000000000000000000000000000000000000000'
        } else {
          type = 'string'
          value = String(value || '')
        }
        break
    }
    
    return {
      name: field.name,
      value,
      type
    }
  })
}

// Restore extractExpirationTime helper
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
  const chain = useActiveWalletChain() || bscTestnet
  
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

  // New: BAS SDK contract address for BNB testnet
  const BASContractAddress = "0x6c2270298b1e6046898a322acB3Cbad6F99f7CBD";

  // New: createAttestation using BAS SDK
  const createAttestation = async (data: AttestationData): Promise<AttestationResult> => {
    if (!isConnected || !address || !wallet || !account) {
      throw new Error('Wallet not connected or account unavailable')
    }

    // Get schema and validate deployment
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

    // Get a native ethers.js Signer using the thirdweb adapter
    const signer = await ethers6Adapter.signer.toEthers({
      client,
      chain,
      account,
    })
    if (!signer) {
      throw new Error('Failed to obtain ethers.js signer from thirdweb adapter')
    }

    // Initialize BAS SDK and connect signer
    const bas = new BAS(BASContractAddress);
    bas.connect(signer);

    // Encode attestation data
    const schemaString = createBASSchemaString(schema);
    const encoder = new SchemaEncoder(schemaString);

    // Auto-compute subjectDidHash if subject is a DID and verification is requested
    const enhancedData = { ...data.data };
    if (enhancedData.subject && typeof enhancedData.subject === 'string' && enhancedData.subject.startsWith('did:')) {
      // Only include subjectDidHash if the schema has this field (for verification)
      const hasHashField = schema.fields.some((f: any) => f.name === 'subjectDidHash');
      if (hasHashField) {
        enhancedData.subjectDidHash = computeDidHash(enhancedData.subject);
        logger.log('[BAS] Auto-computed subjectDidHash for verification:', {
          subject: enhancedData.subject,
          subjectDidHash: enhancedData.subjectDidHash
        });
      }
    }

    const basData = convertToBASData(schema, enhancedData);
    const encodedData = encoder.encodeData(basData);
    const expirationTime = extractExpirationTime(data.data);
    const revocable = false;

    // Compute DID Index Address for efficient indexing
    // If data contains a 'subject' field with a DID, use that for the recipient
    // Otherwise fall back to the provided recipient
    let didIndex: string;
    if (data.data.subject && typeof data.data.subject === 'string' && data.data.subject.startsWith('did:')) {
      didIndex = didToAddress(data.data.subject);
      logger.log('[BAS] Using DID Index Address for subject:', {
        subjectDID: data.data.subject,
        didIndex,
        didHash: computeDidHash(data.data.subject)
      });
    } else {
      throw new Error('Attestation data must include a subject DID field. All OMATrust schemas require subject.');
    }


    // Add detailed logging
    logger.log('[BAS] Submitting attestation:', {
      schemaId: data.schemaId,
      deployedUID,
      recipient: data.recipient,
      didIndex,
      expirationTime,
      revocable,
      encodedData,
      basData,
      schemaString,
      data: data.data,
    });

    try {
      logger.log('[BAS] Calling bas.attest...');
      const tx = await bas.attest({
        schema: deployedUID,
        data: {
          recipient: didIndex,
          expirationTime,
          revocable,
          refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
          data: encodedData,
        },
      });
      logger.log('[BAS] bas.attest returned tx:', tx);

      logger.log('[BAS] Waiting for transaction to be mined (tx.wait)...');
      const transactionHash = await tx.wait();
      logger.log('[BAS] Transaction mined. Hash:', transactionHash);

      // Return result (simplified)
      return {
        transactionHash,
        attestationId: 'pending',
        blockNumber: 0,
        gasUsed: BigInt(0),
      };
    } catch (err) {
      logger.error('[BAS] Error during attestation submission:', err);
      throw err;
    }
  };

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