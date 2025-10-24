/*
 * EAS (Ethereum Attestation Service) Client for OMAchain
 * 
 * Official EAS SDK implementation
 */

import { useActiveAccount, useActiveWallet, useActiveWalletChain } from 'thirdweb/react'
import { prepareContractCall, sendTransaction, getContract } from 'thirdweb'
import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk'
import { client } from '@/app/client'
import type { AttestationServiceClient, AttestationData, AttestationResult } from './types'
import { EAS_CONFIG, getContractAddress } from '@/config/attestation-services'
import { useWallet } from '@/lib/blockchain'
import { extractAddressFromDID } from '@/lib/utils'
import { getSchema } from '@/config/schemas'
import { ethers6Adapter } from 'thirdweb/adapters/ethers6'
import logger from '@/lib/logger'
import { didToIndexAddress, computeDidHash } from '@/lib/did-index'
import { omachainTestnet } from '@/config/chains'

/**
 * Convert our schema fields to EAS schema string for encoding
 * @param schema - Our schema definition
 * @returns EAS schema string
 */
function createEASSchemaString(schema: any): string {
  const fieldStrings = schema.fields.map((field: any) => {
    let type = field.type

    // Convert our types to EAS/Solidity types
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
        type = 'string[]' // Assume string array
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

  return fieldStrings.join(', ')
}

/**
 * Convert attestation data to EAS encoding format
 * @param schema - Schema definition
 * @param data - Attestation data
 * @returns Array of encoded values for SchemaEncoder
 */
function convertToEASData(schema: any, data: Record<string, any>): Array<{ name: string, value: any, type: string }> {
  return schema.fields.map((field: any) => {
    let value = data[field.name] || ''
    let type = field.type

    // Convert our types to EAS/Solidity types and format values
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

// Extract expiration time helper
const extractExpirationTime = (data: Record<string, any>): bigint => {
  const expirationFields = ['expireAt', 'expirationTime', 'expires', 'validUntil', 'expiresAt']
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

export class EASClient implements AttestationServiceClient {
  constructor() {
    // Constructor logic moved to individual methods using hooks
  }

  async createAttestation(data: AttestationData): Promise<AttestationResult> {
    throw new Error('EAS client must be used within React component with hooks')
  }

  async revokeAttestation(attestationId: string): Promise<string> {
    throw new Error('EAS client must be used within React component with hooks')
  }

  async getAttestation(attestationId: string): Promise<any> {
    throw new Error('EAS client must be used within React component with hooks')
  }

  async registerSchema(schema: any): Promise<string> {
    throw new Error('EAS client must be used within React component with hooks')
  }

  async getSchema(schemaId: string): Promise<any> {
    throw new Error('EAS client must be used within React component with hooks')
  }

  async estimateGas(data: AttestationData): Promise<bigint> {
    throw new Error('EAS client must be used within React component with hooks')
  }

  isConnected(): boolean {
    throw new Error('EAS client must be used within React component with hooks')
  }

  getCurrentChain(): number | undefined {
    throw new Error('EAS client must be used within React component with hooks')
  }
}

// Hook-based EAS client for use in React components
export function useEASClient() {
  // Get wallet state from current wallet provider
  const { isConnected, address, chainId, isChainSupported } = useWallet()
  const account = useActiveAccount()
  const wallet = useActiveWallet()
  const chain = useActiveWalletChain() || omachainTestnet

  // Use wallet provider's chain ID
  const currentChainId = chainId || omachainTestnet.id // Default to OMAchain testnet
  const contractAddress = getContractAddress('eas', currentChainId)

  // Check if we can operate
  const shouldEnable = !!contractAddress && isConnected && account

  // NOW we can do conditional returns after all hooks are called
  if (!shouldEnable) {
    return {
      createAttestation: async () => {
        throw new Error(`EAS not supported on chain ${currentChainId}`)
      },
      isConnected: false,
      isChainSupported: false,
      estimateGas: async () => {
        throw new Error(`EAS not supported on chain ${currentChainId}`)
      },
      getAttestation: async () => {
        throw new Error(`EAS not supported on chain ${currentChainId}`)
      },
      revokeAttestation: async () => {
        throw new Error(`EAS not supported on chain ${currentChainId}`)
      },
      registerSchema: async () => {
        throw new Error(`EAS not supported on chain ${currentChainId}`)
      },
      getSchema: async () => {
        throw new Error(`EAS not supported on chain ${currentChainId}`)
      }
    }
  }

  // EAS contract address for OMAchain testnet
  const EASContractAddress = contractAddress!

  // createAttestation using EAS SDK
  const createAttestation = async (data: AttestationData): Promise<AttestationResult> => {
    if (!isConnected || !address || !wallet || !account) {
      throw new Error('Wallet not connected or account unavailable')
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

    // Get a native ethers.js Signer using the thirdweb adapter
    const signer = await ethers6Adapter.signer.toEthers({
      client,
      chain,
      account,
    })
    if (!signer) {
      throw new Error('Failed to obtain ethers.js signer from thirdweb adapter')
    }

    // Initialize EAS SDK and connect signer
    const eas = new EAS(EASContractAddress);
    eas.connect(signer);

    // Encode attestation data
    const schemaString = createEASSchemaString(schema);
    const encoder = new SchemaEncoder(schemaString);

    // Auto-compute subjectDidHash if subject is a DID and verification is requested
    const enhancedData = { ...data.data };
    if (enhancedData.subject && typeof enhancedData.subject === 'string' && enhancedData.subject.startsWith('did:')) {
      // Only include subjectDidHash if the schema has this field (for verification)
      const hasHashField = schema.fields.some((f: any) => f.name === 'subjectDidHash');
      if (hasHashField) {
        enhancedData.subjectDidHash = computeDidHash(enhancedData.subject);
        logger.log('[EAS] Auto-computed subjectDidHash for verification:', {
          subject: enhancedData.subject,
          subjectDidHash: enhancedData.subjectDidHash
        });
      }
    }

    const easData = convertToEASData(schema, enhancedData);
    const encodedData = encoder.encodeData(easData);
    const expirationTime = extractExpirationTime(data.data);
    const revocable = false;

    // Compute DID Index Address for efficient indexing
    // If data contains a 'subject' field with a DID, use that for the recipient
    // Otherwise fall back to the provided recipient
    let didIndex: string;
    if (data.data.subject && typeof data.data.subject === 'string' && data.data.subject.startsWith('did:')) {
      didIndex = didToIndexAddress(data.data.subject);
      logger.log('[EAS] Using DID Index Address for subject:', {
        subjectDID: data.data.subject,
        didIndex,
        didHash: computeDidHash(data.data.subject)
      });
    } else {
      // Fallback to extracting address from recipient field
      didIndex = extractAddressFromDID(data.recipient);
      logger.log('[EAS] Using extracted address from recipient:', {
        recipient: data.recipient,
        didIndex
      });
    }

    // Add detailed logging
    logger.log('[EAS] Submitting attestation:', {
      schemaId: data.schemaId,
      deployedUID,
      recipient: data.recipient,
      didIndex,
      expirationTime,
      revocable,
      encodedData,
      easData,
      schemaString,
      data: data.data,
    });

    try {
      logger.log('[EAS] Calling eas.attest...');
      const tx = await eas.attest({
        schema: deployedUID,
        data: {
          recipient: didIndex,
          expirationTime,
          revocable,
          refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
          data: encodedData,
        },
      });
      logger.log('[EAS] eas.attest returned tx:', tx);

      logger.log('[EAS] Waiting for transaction to be mined (tx.wait)...');
      const newAttestationUID = await tx.wait();
      logger.log('[EAS] Transaction mined. Attestation UID:', newAttestationUID);

      // Return result
      return {
        transactionHash: tx.tx.hash || 'unknown',
        attestationId: newAttestationUID,
        blockNumber: 0, // EAS SDK doesn't return block number directly
        gasUsed: BigInt(0),
      };
    } catch (err) {
      logger.error('[EAS] Error during attestation submission:', err);
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
    supportedChains: EAS_CONFIG.supportedChains
  }
}
