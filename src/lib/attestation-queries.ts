/**
 * Attestation Query Utilities
 *
 * Wraps @oma3/omatrust SDK query functions with frontend-specific
 * schema metadata enrichment (schemaId, schemaTitle, decodedData).
 */

import * as reputation from '@oma3/omatrust/reputation'
import type {
    Hex,
    AttestationQueryResult as SdkAttestationQueryResult,
    VerifyAttestationResult,
} from '@oma3/omatrust/reputation'
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
    schema: string
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
    verification?: VerifyAttestationResult
}

const PROOF_VERIFICATION_SCHEMA_IDS = new Set([
    'user-review',
    'user-review-response',
])

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create a provider and resolve the EAS contract address for a given chain.
 * Uses getChainById to look up the RPC URL so we don't hardcode any chain.
 */
export function getProviderAndEas(chainId: number) {
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

function getDeployedSchemaUids(chainId: number): Hex[] {
    return getAllSchemas()
        .map(s => s.deployedUIDs?.[chainId])
        .filter((uid): uid is string => !!uid && uid !== '0x'.padEnd(66, '0')) as Hex[]
}

/**
 * Convert an SDK attestation result to the frontend's enriched type,
 * adding schema metadata and decoded data when available.
 */
function toFrontendResult(
    att: SdkAttestationQueryResult,
    chainId: number,
    schema?: AttestationSchema,
    verification?: VerifyAttestationResult
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
        schema: att.schema,
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
        verification,
    }
}

async function verifySdkAttestation(
    attestation: SdkAttestationQueryResult,
    provider: unknown
): Promise<VerifyAttestationResult> {
    try {
        return await reputation.verifyAttestation({
            attestation,
            provider,
        })
    } catch (error) {
        return {
            valid: false,
            checks: {},
            reasons: [error instanceof Error ? error.message : 'Verification failed'],
        }
    }
}

function shouldRunProofVerification(schema?: AttestationSchema) {
    return schema?.id ? PROOF_VERIFICATION_SCHEMA_IDS.has(schema.id) : false
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
        subjectDid: did,
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
 * Query all attestations for a specific DID across all deployed schemas.
 * Returns attestations where the DID is the recipient (subject).
 * Useful for fetching reviews, controller witnesses, certifications, etc.
 * about a service.
 */
export async function getAllAttestationsForDIDWithMetadata(
    did: string,
    limit: number = 100
): Promise<EnrichedAttestationResult[]> {
    const chainId = getActiveChain().id
    const { provider, easContractAddress } = getProviderAndEas(chainId)

    const deployedSchemaUids = getDeployedSchemaUids(chainId)

    if (deployedSchemaUids.length === 0) {
        return []
    }

    const results = await reputation.getAttestationsForDid({
        subjectDid: did,
        provider,
        easContractAddress,
        schemas: deployedSchemaUids,
        limit,
    })

    return results.map(att => {
        const schema = findSchemaByUid(att.schema, chainId)
        let enriched = att
        if (schema?.easSchemaString && att.raw) {
            try {
                const decoded = reputation.decodeAttestationData(schema.easSchemaString, att.raw)
                enriched = { ...att, data: decoded }
            } catch { /* skip decode failures */ }
        }
        return toFrontendResult(enriched, chainId, schema)
    })
}

/**
 * Query all attestations for a DID and run SDK verification for each result.
 * Used by the Trust Verifier page while preserving the same enriched shape
 * consumed by activity cards.
 */
export async function getVerifiedAttestationsForDIDWithMetadata(
    did: string,
    limit: number = 100
): Promise<EnrichedAttestationResult[]> {
    const chainId = getActiveChain().id
    const { provider, easContractAddress } = getProviderAndEas(chainId)
    const deployedSchemaUids = getDeployedSchemaUids(chainId)

    if (deployedSchemaUids.length === 0) {
        return []
    }

    const results = await reputation.listAttestations({
        subjectDid: did,
        provider,
        easContractAddress,
        schemas: deployedSchemaUids,
        limit,
    })

    return Promise.all(results.map(async att => {
        const schema = findSchemaByUid(att.schema, chainId)
        let enriched = att
        if (schema?.easSchemaString && att.raw) {
            try {
                const decoded = reputation.decodeAttestationData(schema.easSchemaString, att.raw)
                enriched = { ...att, data: decoded }
            } catch (err) { logger.warn('[Query] Failed to decode attestation data', att.uid, err) }
        }
        const verification = shouldRunProofVerification(schema)
            ? await verifySdkAttestation(enriched, provider)
            : undefined
        return toFrontendResult(enriched, chainId, schema, verification)
    }))
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

    const deployedSchemaUids = getDeployedSchemaUids(chainId)

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
            } catch (err) { logger.warn('[Query] Failed to decode attestation data', att.uid, err) }
        }
        return toFrontendResult(enriched, chainId, schema)
    })
}

// ============================================================================
// Category Priority Sorting
// ============================================================================

/**
 * Schema priority order for the verify page — most important trust signals first.
 * Schemas not in this list get a default middle priority.
 */
const SCHEMA_PRIORITY: Record<string, number> = {
  'security-assessment': 0,
  'certification': 1,
  'controller-witness': 2,
  'key-binding': 3,
  'linked-identifier': 4,
  'user-review-response': 5,
  'user-review': 6,
}

const DEFAULT_PRIORITY = 4

/**
 * Sort attestations by category priority (most important first).
 * Within the same category, attestations are sorted by time descending (newest first).
 * User reviews are capped at `reviewLimit` entries.
 */
export function sortByCategoryPriority(
    attestations: EnrichedAttestationResult[],
    reviewLimit: number = 20
): EnrichedAttestationResult[] {
    const sorted = [...attestations].sort((a, b) => {
        const priorityA = SCHEMA_PRIORITY[a.schemaId ?? ''] ?? DEFAULT_PRIORITY
        const priorityB = SCHEMA_PRIORITY[b.schemaId ?? ''] ?? DEFAULT_PRIORITY
        if (priorityA !== priorityB) return priorityA - priorityB
        // Within same category, newest first
        return b.time - a.time
    })

    // Cap user reviews
    let reviewCount = 0
    return sorted.filter(att => {
        if (att.schemaId === 'user-review') {
            reviewCount++
            return reviewCount <= reviewLimit
        }
        return true
    })
}

/**
 * Query attestations created by a specific attester wallet address.
 * Used by the "My Attestations" dashboard page.
 */
export async function getAttestationsByAttesterWithMetadata(
    attester: string,
    chainId: number = getActiveChain().id,
    limit: number = ATTESTATION_QUERY_CONFIG.defaultLimit
): Promise<EnrichedAttestationResult[]> {
    const { provider, easContractAddress } = getProviderAndEas(chainId)

    const deployedSchemaUids = getDeployedSchemaUids(chainId)

    if (deployedSchemaUids.length === 0) {
        logger.log('[Query] No schemas deployed on chain', chainId)
        return []
    }

    const results = await reputation.getAttestationsByAttester({
        attester: attester as Hex,
        provider,
        easContractAddress,
        schemas: deployedSchemaUids,
        limit,
    })

    return results.map(att => {
        const schema = findSchemaByUid(att.schema, chainId)
        let enriched = att
        if (schema?.easSchemaString && att.raw) {
            try {
                const decoded = reputation.decodeAttestationData(schema.easSchemaString, att.raw)
                enriched = { ...att, data: decoded }
            } catch (err) { logger.warn('[Query] Failed to decode attestation data', att.uid, err) }
        }
        return toFrontendResult(enriched, chainId, schema)
    })
}
