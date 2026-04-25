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
import { useBackendSession } from '@/components/backend-session-provider'
import { BackendApiError, getBackendErrorMessage, getRelayEasNonce, postRelayEasDelegatedAttest } from '@/lib/omatrust-backend'

const activeThirdwebChain = getActiveThirdwebChain()

const ZERO_UID = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex
const SIGNATURE_TIMEOUT_MS = 2 * 60_000

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
  onTimeout?: () => void
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      onTimeout?.()
      reject(new Error(message))
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

function resolveTypedDataPrimaryType(types: Record<string, Array<{ name: string; type: string }>>) {
  if (types.Attest) {
    return 'Attest'
  }

  const primaryType = Object.keys(types).find((type) => type !== 'EIP712Domain')
  if (!primaryType) {
    throw new Error('Delegated attestation typed data is missing a primary type.')
  }
  return primaryType
}

/**
 * Hook-based EAS client for use in React components.
 * Routes to direct (user pays gas) or delegated (server pays gas)
 * based on whether the schema is subsidized.
 */
export function useEASClient() {
  const { isConnected, address, chainId, isChainSupported } = useWallet()
  const account = useActiveAccount()
  const wallet = useActiveWallet()
  const { session } = useBackendSession()

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

  const signDelegatedTypedData = async (
    prepared: {
      typedData: {
        domain: Record<string, unknown>
        types: Record<string, Array<{ name: string; type: string }>>
        message: Record<string, unknown>
      }
    },
    context: { path: 'subscription' | 'subsidized' }
  ) => {
    logger.log('[EAS] Delegated signing: requesting signature', {
      path: context.path,
      accountAddress: account?.address,
      walletId: wallet?.id,
    })

    const signPromise = Promise.resolve().then(() =>
      wallet?.id === 'walletConnect'
        ? (() => {
            const primaryType = resolveTypedDataPrimaryType(prepared.typedData.types)
            logger.log('[EAS] Delegated signing: using direct WalletConnect account signer', {
              path: context.path,
              primaryType,
              typeNames: Object.keys(prepared.typedData.types),
              accountKeys: Object.keys(account ?? {}),
              walletKeys: Object.keys(wallet ?? {}),
            })
            return account.signTypedData({
              domain: prepared.typedData.domain,
              types: prepared.typedData.types,
              primaryType,
              message: prepared.typedData.message,
            } as Parameters<typeof account.signTypedData>[0])
          })()
        : (() => {
            const signer = ethers6Adapter.signer.toEthers({ client, chain: activeThirdwebChain, account })
            return signer.signTypedData(
              prepared.typedData.domain,
              prepared.typedData.types,
              prepared.typedData.message
            )
          })()
    )

    let timedOut = false
    const signaturePromise = signPromise
      .then((signature) => {
        if (timedOut) {
          logger.log('[EAS] Delegated signing: wallet returned after frontend timeout', {
            path: context.path,
            walletId: wallet?.id,
          })
        }
        return signature
      })
      .catch((error) => {
        logger.error('[EAS] Delegated signing: wallet signature rejected or failed', {
          path: context.path,
          walletId: wallet?.id,
          error,
        })
        throw error
      })

    return withTimeout(
      signaturePromise,
      SIGNATURE_TIMEOUT_MS,
      'Wallet signature request timed out. Reopen your wallet and try again.',
      () => {
        timedOut = true
      }
    )
  }

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

  // Main entry point — routes by wallet execution mode.
  const createAttestation = async (data: AttestationData): Promise<AttestationResult> => {
    logger.log('[EAS] createAttestation called', {
      schemaId: data.schemaId,
      walletConnected: isConnected,
      address,
      walletId: wallet?.id,
      accountAddress: account?.address,
      chainId: currentChainId,
      sessionWalletDid: session?.wallet?.did,
      executionMode: session?.wallet?.executionMode,
      isManagedWallet: session?.wallet?.isManagedWallet,
    })

    if (!isConnected || !address || !wallet || !account) {
      throw new Error('Wallet not connected or account unavailable')
    }

    if (!session?.wallet) {
      throw new Error('Sign in to your OMATrust account before publishing.')
    }

    if (session.wallet.executionMode === 'subscription') {
      logger.log('[EAS] Wallet uses subscription execution, using backend relay')
      return createSubscriptionRelayAttestation(data, address as Hex)
    }

    const { schema, deployedUID } = resolveSchema(data)
    if (isSubsidizedSchema(currentChainId, deployedUID)) {
      logger.log('[EAS] Schema is subsidized, using delegated attestation')
      return createDelegatedAttestation(data, schema, deployedUID)
    }

    logger.log('[EAS] Using direct attestation (user pays gas)')
    return createDirectAttestation(data, schema, deployedUID)
  }

  /** Subscription relay attestation — backend meters entitlement and pays gas. */
  const createSubscriptionRelayAttestation = async (
    data: AttestationData,
    attesterAddress: Hex
  ): Promise<AttestationResult> => {
    try {
      logger.log('[EAS] Subscription relay: fetching backend nonce', {
        schemaId: data.schemaId,
        attester: attesterAddress,
      })
      const nonceResponse = await getRelayEasNonce(attesterAddress)
      logger.log('[EAS] Subscription relay: backend nonce received', {
        nonce: nonceResponse.nonce,
        chainId: nonceResponse.chainId,
        chain: nonceResponse.chain,
        easAddress: nonceResponse.easAddress,
      })

      const { schema, deployedUID } = resolveSchema(data)
      logger.log('[EAS] Subscription relay: schema resolved', {
        schemaId: schema.id,
        deployedUID,
        fieldCount: schema.fields?.length,
        revocable: schema.revocable ?? false,
      })

      logger.log('[EAS] Subscription relay: preparing delegated typed data', {
        schemaId: schema.id,
        dataKeys: Object.keys(data.data),
      })
      const prepared = await reputation.prepareDelegatedAttestation({
        chainId: nonceResponse.chainId,
        easContractAddress: nonceResponse.easAddress as Hex,
        schemaUid: deployedUID,
        schema: schema.easSchemaString as string,
        data: data.data,
        attester: attesterAddress,
        nonce: BigInt(nonceResponse.nonce),
        revocable: schema.revocable ?? false,
      })
      logger.log('[EAS] Subscription relay: delegated typed data prepared', {
        domain: prepared.typedData.domain,
        primaryTypeFields: (prepared.typedData.types as { Attest?: Array<{ name: string; type: string }> })?.Attest?.map(
          (field) => `${field.type} ${field.name}`
        ),
        message: prepared.typedData.message,
      })

      logger.log('[EAS] Subscription relay: requesting wallet signature', {
        accountAddress: account.address,
        walletId: wallet?.id,
        chainId: activeThirdwebChain.id,
      })
      const signature = await signDelegatedTypedData(
        prepared as {
          typedData: {
            domain: Record<string, unknown>
            types: Record<string, Array<{ name: string; type: string }>>
            message: Record<string, unknown>
          }
        },
        { path: 'subscription' }
      )

      logger.log('[EAS] Subscription relay: signature obtained, submitting to OMATrust backend relay', {
        signaturePrefix: signature.slice(0, 10),
      })

      const result = await postRelayEasDelegatedAttest({
        prepared,
        signature,
        attester: attesterAddress,
      })

      logger.log('[EAS] Subscription relay attestation successful:', result)
      return {
        transactionHash: result.txHash || 'unknown',
        attestationId: result.uid || 'unknown',
        blockNumber: result.blockNumber ?? 0,
        gasUsed: BigInt(0),
      }
    } catch (error) {
      logger.error('[EAS] Subscription relay failed', {
        schemaId: data.schemaId,
        attester: attesterAddress,
        error,
      })
      if (error instanceof BackendApiError) {
        throw new BackendApiError(
          getBackendErrorMessage(error),
          error.status,
          error.code,
          error.details
        )
      }
      throw new Error(getBackendErrorMessage(error))
    }
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

    const signature = await signDelegatedTypedData(
      prepared as {
        typedData: {
          domain: Record<string, unknown>
          types: Record<string, Array<{ name: string; type: string }>>
          message: Record<string, unknown>
        }
      },
      { path: 'subsidized' }
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
