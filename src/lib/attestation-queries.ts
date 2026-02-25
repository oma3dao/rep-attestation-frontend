/**
 * Attestation Query Utilities
 *
 * Wraps @oma3/omatrust SDK query functions with frontend-specific
 * schema metadata enrichment (schemaId, schemaTitle, decodedData).
 */

import * as reputation from '@oma3/omatrust/reputation'
import type { Hex, AttestationQueryResult as SdkAttestationQueryResult } from '@oma3/omatrust/reputation'
import logger from './logger'
import { ethers } from 'ethers'
import { getAllSchemas, type AttestationSchema } from '@/config/schemas'
import { getActiveChain } from '@/lib/blockchain'
import { getChainById } from '@/config/chains'
import { getContractAddress, ATTESTATION_QUERY_CONFIG } from '@/config/attestation-services'

export interface AttestationQueryOptions {
    schemaUID: string
    limit?: number
    offset?: number
    fromBlock?: number
    toBlock?: number
}

export interface EnrichedAttestationResult {
    uid: string
    attester: string
    recipient: string
    data: string
    time: number
    expirationTime: number
    revocationTime: number
    refUID: string
    revocable: boolean
    txHash?: string
    schemaId?: string
    schemaTitle?: string
    decodedData?: Record<string, any>
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create a provider and resolve the EAS contract address for a given chain.
 * Uses getChainById to look up the RPC URL so we don't hardcode any chain.
 */
function getProviderAndEas(chainId: number) {
    const easContractAddress = getContractAddress('eas', chainId)
    if (!easContractAddress) throw new Error(`EAS not deployed on chain ${chainId}`)

    const chainConfig = getChainById(chainId)
    if (!chainConfig) throw new Error(`Unknown chain ${chainId}`)

    const provider = new ethers.JsonRpcProvider(chainConfig.rpc)
    return { provider, easContractAddress: easContractAddress as Hex }
}

/** Find the schema definition that matches a deployed UID on a given chain */
function findSchemaByUid(uid: string, chainId: number): AttestationSchema | undefined {
    return getAllSchemas().find(s => s.deployedUIDs?.[chainId] === uid)
}

/**
 * Convert an SDK attestation result to the frontend's enriched type,
 * adding schema metadata and decoded data when available.
 */
function toFrontendResult(
    att: SdkAttestationQueryResult,
    chainId: number,
    schema?: AttestationSchema
): EnrichedAttestationResult {
    let decodedData = att.data as Record<string, any> | undefined
    if (schema?.easSchemaString && att.raw) {
        try {
            decodedData = reputation.decodeAttestationData(schema.easSchemaString, att.raw)
        } catch {
            decodedData = att.data as Record<string, any>
        }
    }

    return {
        uid: att.uid,
        attester: att.attester,
        recipient: att.recipient,
        data: att.raw ?? '',
        time: Number(att.time),
        expirationTime: Number(att.expirationTime),
        revocationTime: Number(att.revocationTime),
        refUID: att.refUID,
        revocable: att.revocable,
        txHash: att.txHash,
        schemaId: schema?.id,
        schemaTitle: schema?.title,
        decodedData,
    }
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Query attestations for a specific DID using its Index Address.
 * Wraps the SDK's getAttestationsForDid with schema metadata enrichment.
 */
export async function getAttestationsForDIDWithMetadata(
    did: string,
    options: AttestationQueryOptions
): Promise<EnrichedAttestationResult[]> {
    const chainId = getActiveChain().id
    const { provider, easContractAddress } = getProviderAndEas(chainId)

    logger.log('[Query] Querying attestations for DID:', { did, schemaUID: options.schemaUID })

    const results = await reputation.getAttestationsForDid({
        did,
        provider,
        easContractAddress,
        schemas: [options.schemaUID as Hex],
        limit: options.limit,
        fromBlock: options.fromBlock,
    })

    return results.map(att => {
        const schema = findSchemaByUid(att.schema, chainId)
        return toFrontendResult(att, chainId, schema)
    })
}

/**
 * Get latest attestations across all deployed schemas, enriched with
 * schema metadata (schemaId, schemaTitle, decodedData).
 *
 * Named differently from the SDK's getLatestAttestations to avoid
 * confusion — this version adds frontend-specific enrichment.
 */
export async function getLatestAttestationsWithMetadata(
    chainId: number = getActiveChain().id,
    limit: number = ATTESTATION_QUERY_CONFIG.defaultLimit
): Promise<EnrichedAttestationResult[]> {
    const { provider, easContractAddress } = getProviderAndEas(chainId)

    const schemas = getAllSchemas()
    const deployedSchemaUids = schemas
        .map(s => s.deployedUIDs?.[chainId])
        .filter((uid): uid is string => !!uid && uid !== '0x'.padEnd(66, '0')) as Hex[]

    if (deployedSchemaUids.length === 0) {
        logger.log('[Query] No schemas deployed on chain', chainId)
        return []
    }

    const results = await reputation.getLatestAttestations({
        provider,
        easContractAddress,
        schemas: deployedSchemaUids,
        limit,
    })

    return results.map(att => {
        const schema = findSchemaByUid(att.schema, chainId)
        // Decode raw data if we have the schema string
        let enriched = att
        if (schema?.easSchemaString && att.raw) {
            try {
                const decoded = reputation.decodeAttestationData(schema.easSchemaString, att.raw)
                enriched = { ...att, data: decoded }
            } catch { /* keep raw */ }
        }
        return toFrontendResult(enriched, chainId, schema)
    })
}
