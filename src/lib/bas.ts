/*
 * BAS (Binance Attestation Service) Client
 *
 * Uses @oma3/omatrust SDK for encoding and expiration extraction.
 * Direct attestation uses the BAS SDK with thirdweb wallet adapter.
 */

import { useActiveAccount, useActiveWallet, useActiveWalletChain } from 'thirdweb/react'
import { bscTestnet } from 'thirdweb/chains'
import { BAS } from '@bnb-attestation-service/bas-sdk'
import { client } from '@/app/client'
import type { AttestationData, AttestationResult } from './types'
import { BAS_CONFIG, getContractAddress } from '@/config/attestation-services'
import { useWallet } from '@/lib/blockchain'
import { didToAddress } from '@oma3/omatrust/identity'
import { getSchema } from '@/config/schemas'
import { ethers6Adapter } from 'thirdweb/adapters/ethers6'
import logger from '@/lib/logger'
import {
  encodeAttestationData,
  extractExpirationTime,
  type Hex,
} from '@oma3/omatrust/reputation'

const ZERO_UID = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex

// Hook-based BAS client for use in React components
export function useBASClient() {
  // Get wallet state from current wallet provider
  const { isConnected, address, chainId, isChainSupported } = useWallet()
  const account = useActiveAccount()
  const wallet = useActiveWallet()
  const chain = useActiveWalletChain() || bscTestnet

  // Use wallet provider's chain ID
  const currentChainId = chainId || bscTestnet.id
  const contractAddress = getContractAddress('bas', currentChainId)

  // Check if we can operate
  const shouldEnable = !!contractAddress && isConnected && account

  if (!shouldEnable) {
    return {
      createAttestation: async () => { throw new Error(`BAS not supported on chain ${currentChainId}`) },
      isConnected: false,
      isChainSupported: false,
      estimateGas: async () => { throw new Error(`BAS not supported on chain ${currentChainId}`) },
      getAttestation: async () => { throw new Error(`BAS not supported on chain ${currentChainId}`) },
      revokeAttestation: async () => { throw new Error(`BAS not supported on chain ${currentChainId}`) },
      registerSchema: async () => { throw new Error(`BAS not supported on chain ${currentChainId}`) },
      getSchema: async () => { throw new Error(`BAS not supported on chain ${currentChainId}`) },
    }
  }

  // BAS SDK contract address for BNB testnet
  const BASContractAddress = "0x6c2270298b1e6046898a322acB3Cbad6F99f7CBD"

  const createAttestation = async (data: AttestationData): Promise<AttestationResult> => {
    if (!isConnected || !address || !wallet || !account) {
      throw new Error('Wallet not connected or account unavailable')
    }

    const schema = getSchema(data.schemaId)
    if (!schema) throw new Error(`Schema ${data.schemaId} not found`)

    const deployedUID = schema.deployedUIDs?.[chainId]
    if (!deployedUID) throw new Error(`Schema ${data.schemaId} not deployed on chain ${chainId}`)
    if (deployedUID === ZERO_UID) {
      throw new Error(`Schema ${data.schemaId} deployment UID not set for chain ${chainId}. Please update schemas.ts.`)
    }

    const easSchemaString = schema.easSchemaString
    if (!easSchemaString) {
      throw new Error(`Schema ${schema.id} is missing easSchemaString. Run update-schemas to regenerate.`)
    }

    // Get ethers signer via thirdweb adapter
    const signer = await ethers6Adapter.signer.toEthers({ client, chain, account })
    if (!signer) throw new Error('Failed to obtain ethers.js signer from thirdweb adapter')

    // Initialize BAS SDK
    const bas = new BAS(BASContractAddress)
    bas.connect(signer)

    // SDK encodes data and auto-computes subjectDidHash if the schema has that field
    const encodedData = encodeAttestationData(easSchemaString, data.data)

    // SDK extracts expiration from common field names
    const expiration = extractExpirationTime(data.data)
    const expirationTime = expiration !== undefined ? BigInt(expiration) : 0n

    const revocable = schema.revocable ?? false

    // Resolve recipient from subject DID
    const subject = data.data.subject
    if (!subject || typeof subject !== 'string' || !subject.startsWith('did:')) {
      throw new Error('Attestation data must include a subject DID field.')
    }
    const recipient = didToAddress(subject)

    logger.log('[BAS] Submitting attestation:', {
      schemaId: data.schemaId, deployedUID, recipient,
      expirationTime: Number(expirationTime), revocable,
    })

    const tx = await bas.attest({
      schema: deployedUID,
      data: {
        recipient,
        expirationTime,
        revocable,
        refUID: ZERO_UID,
        data: encodedData,
      },
    })

    const transactionHash = await tx.wait()
    logger.log('[BAS] Transaction mined:', transactionHash)

    return {
      transactionHash,
      attestationId: 'pending',
      blockNumber: 0,
      gasUsed: BigInt(0),
    }
  }

  return {
    createAttestation,
    revokeAttestation: async () => { throw new Error('Revocation not implemented yet') },
    getAttestation: async () => { throw new Error('Get attestation not implemented yet') },
    registerSchema: async () => { throw new Error('Register schema not implemented yet') },
    getSchema: async () => { throw new Error('Get schema not implemented yet') },
    estimateGas: async () => BigInt('100000'),
    isConnected: isConnected && isChainSupported,
    getCurrentChain: () => currentChainId,
    isChainSupported,
    contractAddress,
    supportedChains: BAS_CONFIG.supportedChains,
  }
}
