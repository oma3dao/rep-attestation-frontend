/**
 * Attestation Query Utilities
 * 
 * Functions for efficiently querying attestations using DID Index Addresses
 */

import { didToAddress, validateDidAddress } from '@oma3/omatrust/identity'
import logger from './logger'
import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk'
import { ethers } from 'ethers'
import { getAllSchemas, type AttestationSchema } from '@/config/schemas'
import { omachainTestnet } from '@/config/chains'
import { getContractAddress, ATTESTATION_QUERY_CONFIG } from '@/config/attestation-services'

export interface AttestationQueryOptions {
    schemaUID: string
    limit?: number
    offset?: number
    fromBlock?: number
    toBlock?: number
}

export interface AttestationQueryResult {
    uid: string
    attester: string
    recipient: string
    data: string
    time: number
    expirationTime: number
    revocationTime: number
    refUID: string
    revocable: boolean
    schemaId?: string
    schemaTitle?: string
    decodedData?: Record<string, any>
}

/**
 * Query attestations for a specific DID using its Index Address
 * @param did - The DID to query attestations for
 * @param options - Query options including schema UID
 * @returns Promise resolving to attestation results
 */
export async function getAttestationsForDID(
    did: string,
    options: AttestationQueryOptions
): Promise<AttestationQueryResult[]> {
    try {
        const didIndex = didToAddress(did)

        logger.log('[Query] Querying attestations for DID:', {
            did,
            didIndex,
            schemaUID: options.schemaUID
        })

        // TODO: Implement actual BAS/EAS query
        // This is a placeholder - actual implementation depends on the service
        throw new Error('Attestation querying not yet implemented - placeholder function')

        // Example of what this would look like:
        // const attestations = await basClient.getAttestations({
        //   recipient: didIndex,
        //   schema: options.schemaUID,
        //   limit: options.limit,
        //   offset: options.offset
        // })
        // 
        // return attestations.map(att => ({
        //   uid: att.uid,
        //   attester: att.attester,
        //   recipient: att.recipient,
        //   data: att.data,
        //   time: att.time,
        //   expirationTime: att.expirationTime,
        //   revocationTime: att.revocationTime,
        //   refUID: att.refUID,
        //   revocable: att.revocable
        // }))

    } catch (error) {
        logger.error('[Query] Failed to query attestations for DID:', error)
        throw error
    }
}

/**
 * Query all attestations made by a specific attester
 * @param attesterAddress - The attester's address
 * @param options - Query options
 * @returns Promise resolving to attestation results
 */
export async function getAttestationsByAttester(
    attesterAddress: string,
    options: AttestationQueryOptions
): Promise<AttestationQueryResult[]> {
    // TODO: Implement attester-based querying
    throw new Error('Attester querying not yet implemented - placeholder function')
}

/**
 * Get a specific attestation by its UID
 * @param uid - The attestation UID
 * @returns Promise resolving to attestation data or null if not found
 */
export async function getAttestationByUID(uid: string): Promise<AttestationQueryResult | null> {
    // TODO: Implement UID-based lookup
    throw new Error('UID lookup not yet implemented - placeholder function')
}

/**
 * Verify that an attestation's subject matches its recipient index
 * @param attestation - The attestation to verify
 * @returns True if the attestation is valid
 */
export function verifyAttestationIntegrity(attestation: AttestationQueryResult): boolean {
    try {
        // TODO: Decode attestation data to get subject field
        // const decodedData = decodeAttestationData(attestation.data)
        // const subject = decodedData.subject
        // 
        // if (subject && subject.startsWith('did:')) {
        //   return validateDidAddress(subject, attestation.recipient)
        // }

        // For now, assume valid
        return true
    } catch (error) {
        logger.error('[Query] Failed to verify attestation integrity:', error)
        return false
    }
}

/**
 * Get reviews for a specific app DID
 * @param appDid - The app's DID
 * @param userReviewSchemaUID - The UserReview schema UID
 * @returns Promise resolving to review attestations
 */
export async function getReviewsForApp(
    appDid: string,
    userReviewSchemaUID: string
): Promise<AttestationQueryResult[]> {
    return getAttestationsForDID(appDid, { schemaUID: userReviewSchemaUID })
}

/**
 * Get responses to a specific review
 * @param reviewUID - The original review's UID
 * @param responseSchemaUID - The UserReviewResponse schema UID
 * @returns Promise resolving to response attestations
 */
export async function getResponsesForReview(
    reviewUID: string,
    responseSchemaUID: string
): Promise<AttestationQueryResult[]> {
    // TODO: Query by refUID instead of recipient
    // This would look for attestations where refUID = reviewUID
    throw new Error('Review response querying not yet implemented - placeholder function')
}

/**
 * Get latest attestations across all schemas using progressive querying
 * @param chainId - The chain ID to query
 * @param limit - Maximum number of attestations to return
 * @returns Promise resolving to latest attestations sorted by time (newest first)
 */
export async function getLatestAttestations(
    chainId: number = omachainTestnet.id,
    limit: number = ATTESTATION_QUERY_CONFIG.defaultLimit
): Promise<AttestationQueryResult[]> {
    try {
        // Get EAS contract address for the chain
        const easContractAddress = getContractAddress('eas', chainId)
        if (!easContractAddress) {
            throw new Error(`EAS not deployed on chain ${chainId}`)
        }

        // Get all schemas deployed on this chain
        const schemas = getAllSchemas()
        const deployedSchemas = schemas.filter(schema => {
            const uid = schema.deployedUIDs?.[chainId]
            return uid && uid !== '0x0000000000000000000000000000000000000000000000000000000000000000'
        })

        if (deployedSchemas.length === 0) {
            logger.log('[Query] No schemas deployed on chain', chainId)
            return []
        }

        // Setup provider and EAS instance
        const provider = new ethers.JsonRpcProvider(omachainTestnet.rpc)
        const eas = new EAS(easContractAddress)
        eas.connect(provider as any)

        // Setup contract for querying events
        const contract = new ethers.Contract(
            easContractAddress,
            ['event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID)'],
            provider
        )

        const currentBlock = await provider.getBlockNumber()

        // Use configured block ranges
        const blockRanges = ATTESTATION_QUERY_CONFIG.blockRanges

        let allEvents: any[] = []

        // Try each range until we have enough attestations
        for (const range of blockRanges) {
            const startBlock = Math.max(0, currentBlock - range.blocks)
            
            logger.log(`[Query] Trying range: ${range.label} (${range.blocks} blocks)`)

            // Query ALL attestations (no schema filter)
            const filter = contract.filters.Attested()
            const events = await contract.queryFilter(filter, startBlock, currentBlock)

            logger.log(`[Query] Found ${events.length} total events in ${range.label}`)

            if (events.length >= limit) {
                // Found enough! Use these events
                allEvents = events
                break
            } else if (range === blockRanges[blockRanges.length - 1]) {
                // Last range, use whatever we found
                allEvents = events
            }
            // Otherwise, try next range
        }

        // Take the most recent events
        const recentEvents = allEvents.slice(-limit * ATTESTATION_QUERY_CONFIG.fetchMultiplier)

        // Process events in reverse (newest first)
        const attestations: AttestationQueryResult[] = []

        for (let i = recentEvents.length - 1; i >= 0; i--) {
            const event = recentEvents[i]
            
            try {
                const uid = event.args?.uid
                const schemaUID = event.args?.schemaUID

                if (!uid || !schemaUID) continue

                // Find matching schema
                const schema = deployedSchemas.find(s => 
                    s.deployedUIDs?.[chainId] === schemaUID
                )

                if (!schema) {
                    logger.log(`[Query] Skipping unknown schema: ${schemaUID}`)
                    continue
                }

                // Fetch full attestation data
                const attestation = await eas.getAttestation(uid)
                
                // Decode the attestation data
                const decodedData = decodeAttestationData(schema, attestation.data)

                attestations.push({
                    uid: attestation.uid,
                    attester: attestation.attester,
                    recipient: attestation.recipient,
                    data: attestation.data,
                    time: Number(attestation.time),
                    expirationTime: Number(attestation.expirationTime),
                    revocationTime: Number(attestation.revocationTime),
                    refUID: attestation.refUID,
                    revocable: attestation.revocable,
                    schemaId: schema.id,
                    schemaTitle: schema.title,
                    decodedData
                })

                // Early exit once we have enough
                if (attestations.length >= limit) {
                    break
                }
            } catch (err) {
                logger.error('[Query] Error processing event:', err)
            }
        }

        logger.log(`[Query] Returning ${attestations.length} latest attestations`)
        return attestations

    } catch (error) {
        logger.error('[Query] Failed to get latest attestations:', error)
        throw error
    }
}

/**
 * Decode attestation data using schema definition
 * @param schema - The schema definition
 * @param encodedData - The encoded attestation data
 * @returns Decoded data object
 */
function decodeAttestationData(schema: AttestationSchema, encodedData: string): Record<string, any> {
    try {
        // Create schema string for decoder
        const schemaString = schema.fields.map(field => {
            let solidityType: string
            switch (field.type) {
                case 'integer':
                    solidityType = field.max && field.max <= 255 ? 'uint8' : 'uint256'
                    break
                case 'datetime':
                case 'uri':
                case 'enum':
                    solidityType = 'string'
                    break
                case 'array':
                    solidityType = 'string[]'
                    break
                default:
                    solidityType = 'string'
                    break
            }
            return `${solidityType} ${field.name}`
        }).join(',')

        const encoder = new SchemaEncoder(schemaString)
        const decoded = encoder.decodeData(encodedData)

        // Convert to object
        const result: Record<string, any> = {}
        decoded.forEach((item: any) => {
            result[item.name] = item.value.value || item.value
        })

        return result
    } catch (err) {
        logger.error('[Query] Error decoding attestation data:', err)
        return {}
    }
}