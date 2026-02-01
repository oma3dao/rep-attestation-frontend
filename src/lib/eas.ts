/*
 * EAS (Ethereum Attestation Service) Client for OMAchain
 * 
 * Official EAS SDK implementation with delegated attestation support
 */

import { useActiveAccount, useActiveWallet } from 'thirdweb/react'
import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk'
import { client } from '@/app/client'
import type { AttestationServiceClient, AttestationData, AttestationResult } from './types'
import { EAS_CONFIG, getContractAddress } from '@/config/attestation-services'
import { useWallet, getActiveThirdwebChain } from '@/lib/blockchain'
import { extractAddressFromDID } from '@/lib/utils'
import { getSchema } from '@/config/schemas'
import { ethers6Adapter } from 'thirdweb/adapters/ethers6'
import { ethers } from 'ethers'
import logger from '@/lib/logger'
import { didToIndexAddress, computeDidHash } from '@/lib/did-index'
import { isSubsidizedSchema } from '@/config/subsidized-schemas'

// Get Thirdweb chain from shared source
const activeThirdwebChain = getActiveThirdwebChain()

// ============================================================================
// Schema Encoding Utilities
// ============================================================================

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

/**
 * Extract expiration time from attestation data
 */
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

// ============================================================================
// Prepared Attestation (shared by direct and delegated flows)
// ============================================================================

/**
 * Prepared attestation data ready for submission
 */
interface PreparedAttestation {
  encodedData: string
  expirationTime: bigint
  didIndex: string
  schemaString: string
  revocable: boolean
}

/**
 * Prepare attestation data for submission (shared by delegated and direct paths)
 */
function prepareAttestationData(
  data: AttestationData,
  schema: any
): PreparedAttestation {
  // Create schema string and encoder
  const schemaString = createEASSchemaString(schema)
  const encoder = new SchemaEncoder(schemaString)

  // Auto-compute subjectDidHash if needed
  const enhancedData = { ...data.data }
  if (enhancedData.subject && typeof enhancedData.subject === 'string' && enhancedData.subject.startsWith('did:')) {
    const hasHashField = schema.fields.some((f: any) => f.name === 'subjectDidHash')
    if (hasHashField) {
      enhancedData.subjectDidHash = computeDidHash(enhancedData.subject)
      logger.log('[EAS] Auto-computed subjectDidHash:', {
        subject: enhancedData.subject,
        subjectDidHash: enhancedData.subjectDidHash
      })
    }
  }

  // Convert and encode data
  const easData = convertToEASData(schema, enhancedData)
  const encodedData = encoder.encodeData(easData)
  const expirationTime = extractExpirationTime(data.data)

  // Get revocable flag from schema (default to false)
  const revocable = schema.revocable ?? false

  // Compute DID Index Address
  let didIndex: string
  if (data.data.subject && typeof data.data.subject === 'string' && data.data.subject.startsWith('did:')) {
    didIndex = didToIndexAddress(data.data.subject)
    logger.log('[EAS] Using DID Index Address:', {
      subjectDID: data.data.subject,
      didIndex
    })
  } else {
    didIndex = extractAddressFromDID(data.recipient)
    logger.log('[EAS] Using extracted address from recipient:', {
      recipient: data.recipient,
      didIndex
    })
  }

  return {
    encodedData,
    expirationTime,
    didIndex,
    schemaString,
    revocable
  }
}

// ============================================================================
// Delegated Attestation Types and Utilities
// ============================================================================

export interface DelegatedAttestationData {
  schema: `0x${string}`;
  recipient: `0x${string}`;
  expirationTime: bigint;
  revocable: boolean;
  refUID: `0x${string}`;
  data: `0x${string}`;
  deadline: number;
}

export interface DelegatedAttestationRequest {
  delegated: DelegatedAttestationData;
  attester: `0x${string}`;
  signature: `0x${string}`;
}

/**
 * Build EIP-712 typed-data for EAS delegated attestation
 * 
 * The Attest type hash is:
 * keccak256("Attest(address attester,bytes32 schema,address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value,uint256 nonce,uint64 deadline)")
 * 
 * @param chainId - Target chain ID (included in domain for replay protection)
 * @param easAddress - EAS contract address (verifying contract)
 * @param delegated - Attestation data to sign
 * @param attester - Address of the attester (signer)
 * @param nonce - Current nonce for the attester from EAS contract
 * @returns Typed-data object for eth_signTypedData_v4
 */
export function buildDelegatedAttestationTypedData(
  chainId: number,
  easAddress: `0x${string}`,
  delegated: DelegatedAttestationData,
  attester: `0x${string}`,
  nonce: bigint
) {
  return {
    domain: {
      name: 'EAS',
      version: '1.4.0',  // Must match EAS contract constructor: EIP1271Verifier("EAS", "1.4.0")
      chainId,
      verifyingContract: easAddress,
    },
    types: {
      Attest: [
        { name: 'attester', type: 'address' },
        { name: 'schema', type: 'bytes32' },
        { name: 'recipient', type: 'address' },
        { name: 'expirationTime', type: 'uint64' },
        { name: 'revocable', type: 'bool' },
        { name: 'refUID', type: 'bytes32' },
        { name: 'data', type: 'bytes' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint64' },
      ],
    },
    primaryType: 'Attest' as const,
    message: {
      attester: attester,
      schema: delegated.schema,
      recipient: delegated.recipient,
      expirationTime: delegated.expirationTime,
      revocable: delegated.revocable,
      refUID: delegated.refUID,
      data: delegated.data,
      value: BigInt(0),
      nonce: nonce,
      deadline: BigInt(delegated.deadline),
    },
  };
}

/**
 * Split an Ethereum signature into v, r, s components
 * 
 * @param sig - Signature as hex string (with or without 0x prefix)
 * @returns Object with v (number), r (bytes32), s (bytes32)
 */
export function splitSignature(sig: string): { v: number; r: `0x${string}`; s: `0x${string}` } {
  const hex = sig.startsWith('0x') ? sig : `0x${sig}`;
  const r = hex.slice(0, 66) as `0x${string}`;
  const s = `0x${hex.slice(66, 130)}` as `0x${string}`;
  let v = parseInt(hex.slice(130, 132), 16);
  // Normalize v to 27 or 28 (some wallets return 0 or 1)
  if (v < 27) v += 27;
  return { v, r, s };
}

// ============================================================================
// EAS Client Class and Hook
// ============================================================================

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

/**
 * Hook-based EAS client for use in React components
 */
export function useEASClient() {
  // Get wallet state from current wallet provider
  const { isConnected, address, chainId, isChainSupported } = useWallet()
  const account = useActiveAccount()
  const wallet = useActiveWallet()
  
  // Use environment-determined chain (not wallet chain)
  const currentChainId = chainId // Already environment-determined from useWallet()
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

  // EAS contract address
  const EASContractAddress = contractAddress!

  // createAttestation using EAS SDK (or delegated for subsidized schemas)
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

    // Check if this schema is subsidized (server pays gas)
    if (isSubsidizedSchema(currentChainId, deployedUID)) {
      logger.log('[EAS] Schema is subsidized, using delegated attestation');
      return createDelegatedAttestation(data, schema, deployedUID);
    }

    // Direct attestation (user pays gas)
    logger.log('[EAS] Using direct attestation (user pays gas)');
    return createDirectAttestation(data, schema, deployedUID);
  };

  // Delegated attestation - server pays gas
  const createDelegatedAttestation = async (
    data: AttestationData,
    schema: any,
    deployedUID: string
  ): Promise<AttestationResult> => {
    // Prepare attestation data (shared logic)
    const { encodedData, expirationTime, didIndex, revocable } = prepareAttestationData(data, schema)

    logger.log('[EAS] Building delegated attestation:', {
      schema: deployedUID,
      recipient: didIndex,
      attester: address,
      revocable,
    });

    // Fetch current nonce for the attester via API (avoids client needing RPC access)
    logger.log('[EAS] Fetching nonce via API for attester:', address);
    const nonceResponse = await fetch(`/api/eas/nonce?attester=${address}`);
    if (!nonceResponse.ok) {
      const errorData = await nonceResponse.json();
      throw new Error(errorData.error || 'Failed to fetch nonce');
    }
    const nonceData = await nonceResponse.json();
    const nonce = BigInt(nonceData.nonce);
    logger.log('[EAS] Fetched nonce for attester:', { attester: address, nonce: nonce.toString() });

    // Get signer for signing the typed data
    const signer = ethers6Adapter.signer.toEthers({
      client,
      chain: activeThirdwebChain,
      account,
    });

    // Build delegated attestation data
    const delegated = {
      schema: deployedUID as `0x${string}`,
      recipient: didIndex as `0x${string}`,
      expirationTime: BigInt(expirationTime),
      revocable,
      refUID: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
      data: encodedData as `0x${string}`,
      deadline: Math.floor(Date.now() / 1000) + 600, // 10 min
    };

    // Build EIP-712 typed-data (includes nonce)
    const typedData = buildDelegatedAttestationTypedData(
      currentChainId,
      EASContractAddress as `0x${string}`,
      delegated,
      address as `0x${string}`,
      BigInt(nonce)
    );

    logger.log('[EAS] Requesting signature for delegated attestation...');

    const signature = await signer.signTypedData(
      typedData.domain,
      typedData.types,
      typedData.message
    );

    logger.log('[EAS] Signature obtained, submitting to relay server...');
    logger.log('[EAS] Delegated payload:', {
      schema: delegated.schema,
      recipient: delegated.recipient,
      expirationTime: Number(delegated.expirationTime),
      revocable: delegated.revocable,
      deadline: delegated.deadline,
      dataLength: delegated.data.length,
      signatureLength: signature.length,
    });

    // Submit to relay server
    let response: Response;
    try {
      logger.log('[EAS] Calling fetch to /api/eas/delegated-attest...');
      response = await fetch('/api/eas/delegated-attest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delegated: {
            ...delegated,
            expirationTime: Number(delegated.expirationTime), // Convert BigInt for JSON
          },
          signature,
          attester: address,
        }),
      });
      logger.log('[EAS] Fetch completed, status:', response.status);
    } catch (fetchError) {
      logger.error('[EAS] Fetch failed:', fetchError);
      throw new Error(`Failed to reach relay server: ${fetchError}`);
    }

    const result = await response.json();
    logger.log('[EAS] Response body:', result);
    
    if (!response.ok) {
      logger.error('[EAS] Delegated attestation failed:', result);
      throw new Error(result.error || 'Delegated attestation failed');
    }

    logger.log('[EAS] Delegated attestation successful:', result);

    return {
      transactionHash: result.txHash || 'unknown',
      attestationId: result.uid || 'unknown',
      blockNumber: result.blockNumber || 0,
      gasUsed: BigInt(0), // Server paid gas
    };
  };

  // Direct attestation - user pays gas
  const createDirectAttestation = async (
    data: AttestationData,
    schema: any,
    deployedUID: string
  ): Promise<AttestationResult> => {
    // Get a native ethers.js Signer using the thirdweb adapter
    const signer = await ethers6Adapter.signer.toEthers({
      client,
      chain: activeThirdwebChain,
      account,
    })
    if (!signer) {
      throw new Error('Failed to obtain ethers.js signer from thirdweb adapter')
    }

    // Initialize EAS SDK and connect signer
    const eas = new EAS(EASContractAddress);
    eas.connect(signer);

    // Prepare attestation data (shared logic)
    const { encodedData, expirationTime, didIndex, revocable } = prepareAttestationData(data, schema)

    logger.log('[EAS] Submitting direct attestation:', {
      schemaId: data.schemaId,
      deployedUID,
      recipient: data.recipient,
      didIndex,
      expirationTime,
      revocable,
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
