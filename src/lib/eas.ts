/*
 * EAS (Ethereum Attestation Service) Client for OMAchain
 *
 * Thin hook around the @oma3/omatrust SDK. The SDK handles encoding,
 * typed-data construction, and relay submission. This file only adds
 * thirdweb wallet integration and subsidized-schema routing.
 */

import { useActiveAccount, useActiveWallet } from 'thirdweb/react'
import { client } from '@/app/client'
import type { AttestationData, AttestationResult } from './types'
import { EAS_CONFIG, getContractAddress } from '@/config/attestation-services'
import { useWallet, getActiveThirdwebChain } from '@/lib/blockchain'
import { getSchema } from '@/config/schemas'
import { ethers6Adapter } from 'thirdweb/adapters/ethers6'
import logger from '@/lib/logger'
import { isSubsidizedSchema } from '@/config/subsidized-schemas'
import * as reputation from '@oma3/omatrust/reputation'
import type { Hex } from '@oma3/omatrust/reputation'

const activeThirdwebChain = getActiveThirdwebChain()

const ZERO_UID = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex

/**
 * Hook-based EAS client for use in React components.
 * Routes to direct (user pays gas) or delegated (server pays gas)
 * based on whether the schema is subsidized.
 */
export function useEASClient() {
  const { isConnected, address, chainId, isChainSupported } = useWallet()
  const account = useActiveAccount()
  const wallet = useActiveWallet()

  const currentChainId = chainId
  const contractAddress = getContractAddress('eas', currentChainId)
  const shouldEnable = !!contractAddress && isConnected && account

  if (!shouldEnable) {
    return {
      createAttestation: async () => { throw new Error(`EAS not supported on chain ${currentChainId}`) },
      isConnected: false,
      isChainSupported: false,
      estimateGas: async () => { throw new Error(`EAS not supported on chain ${currentChainId}`) },
      getAttestation: async () => { throw new Error(`EAS not supported on chain ${currentChainId}`) },
      revokeAttestation: async () => { throw new Error(`EAS not supported on chain ${currentChainId}`) },
      registerSchema: async () => { throw new Error(`EAS not supported on chain ${currentChainId}`) },
      getSchema: async () => { throw new Error(`EAS not supported on chain ${currentChainId}`) },
    }
  }

  const easContractAddress = contractAddress! as Hex

  /** Resolve schema config and deployedUID, throwing on missing/zero UIDs */
  function resolveSchema(data: AttestationData) {
    const schema = getSchema(data.schemaId)
    if (!schema) throw new Error(`Schema ${data.schemaId} not found`)

    const deployedUID = schema.deployedUIDs?.[currentChainId]
    if (!deployedUID) throw new Error(`Schema ${data.schemaId} not deployed on chain ${currentChainId}`)
    if (deployedUID === ZERO_UID) {
      throw new Error(`Schema ${data.schemaId} deployment UID not set for chain ${currentChainId}. Please update schemas.ts.`)
    }

    if (!schema.easSchemaString) {
      throw new Error(`Schema ${schema.id} is missing easSchemaString. Run update-schemas to regenerate.`)
    }

    return { schema, deployedUID: deployedUID as Hex }
  }

  // Main entry point — routes to delegated or direct
  const createAttestation = async (data: AttestationData): Promise<AttestationResult> => {
    if (!isConnected || !address || !wallet || !account) {
      throw new Error('Wallet not connected or account unavailable')
    }

    const { schema, deployedUID } = resolveSchema(data)

    if (isSubsidizedSchema(currentChainId, deployedUID)) {
      logger.log('[EAS] Schema is subsidized, using delegated attestation')
      return createDelegatedAttestation(data, schema, deployedUID)
    }

    logger.log('[EAS] Using direct attestation (user pays gas)')
    return createDirectAttestation(data, schema, deployedUID)
  }

  /** Delegated attestation — server pays gas, user signs EIP-712 */
  const createDelegatedAttestation = async (
    data: AttestationData,
    schema: any,
    deployedUID: Hex
  ): Promise<AttestationResult> => {
    // Fetch nonce from server (server is authoritative for nonce)
    const nonceResponse = await fetch(`/api/eas/nonce?attester=${address}`)
    if (!nonceResponse.ok) {
      const errorData = await nonceResponse.json()
      throw new Error(errorData.error || 'Failed to fetch nonce')
    }
    const { nonce: nonceStr } = await nonceResponse.json()

    // SDK builds typed data, encodes attestation data, resolves recipient
    const prepared = await reputation.prepareDelegatedAttestation({
      chainId: currentChainId,
      easContractAddress,
      schemaUid: deployedUID,
      schema: schema.easSchemaString,
      data: data.data,
      attester: address as Hex,
      nonce: BigInt(nonceStr),
      revocable: schema.revocable ?? false,
    })

    // Sign with thirdweb adapter
    const signer = ethers6Adapter.signer.toEthers({ client, chain: activeThirdwebChain, account })
    const signature = await signer.signTypedData(
      prepared.typedData.domain as Record<string, unknown>,
      prepared.typedData.types as Record<string, Array<{ name: string; type: string }>>,
      prepared.typedData.message
    )

    logger.log('[EAS] Signature obtained, submitting to relay...')

    // SDK handles relay submission and bigint serialization
    const result = await reputation.submitDelegatedAttestation({
      relayUrl: '/api/eas/delegated-attest',
      prepared,
      signature,
      attester: address as Hex,
    })

    logger.log('[EAS] Delegated attestation successful:', result)
    return {
      transactionHash: result.txHash || 'unknown',
      attestationId: result.uid || 'unknown',
      blockNumber: 0,
      gasUsed: BigInt(0),
    }
  }

  /** Direct attestation — user pays gas via SDK */
  const createDirectAttestation = async (
    data: AttestationData,
    schema: any,
    deployedUID: Hex
  ): Promise<AttestationResult> => {
    const signer = await ethers6Adapter.signer.toEthers({ client, chain: activeThirdwebChain, account })
    if (!signer) throw new Error('Failed to obtain ethers.js signer from thirdweb adapter')

    logger.log('[EAS] Submitting direct attestation:', { schemaId: data.schemaId, deployedUID })

    const result = await reputation.submitAttestation({
      signer,
      chainId: currentChainId,
      easContractAddress,
      schemaUid: deployedUID,
      schema: schema.easSchemaString,
      data: data.data,
      revocable: schema.revocable ?? false,
    })

    logger.log('[EAS] Attestation UID:', result.uid)

    return {
      transactionHash: result.txHash || 'unknown',
      attestationId: result.uid,
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
    supportedChains: EAS_CONFIG.supportedChains,
  }
}
