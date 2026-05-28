/**
 * Controller Witness API client
 *
 * Calls the OMATrust backend controller witness API directly from the browser.
 * Uses the same credentials: "include" pattern as all other backend calls,
 * so the session cookie is sent automatically.
 */

import { getBackendOrigin } from '@/lib/service-urls'
import logger from '@/lib/logger'

interface WitnessCallParams {
  subject: string
  controller: string
}

interface WitnessResult {
  success: boolean
  uid: string | null
  txHash: string
  blockNumber: number
  observedAt: number
  method: string
}

/**
 * Request a controller witness attestation from the OMATrust backend.
 * The backend verifies endpoint evidence and submits the attestation
 * using the OMA3 server wallet. Costs one sponsored write.
 */
export async function callControllerWitness(
  params: WitnessCallParams
): Promise<WitnessResult | undefined> {
  logger.log('[controller-witness] Starting witness call:', {
    subject: params.subject,
    controller: params.controller,
  })

  try {
    const response = await fetch(`${getBackendOrigin()}/api/private/controller-witness`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectDid: params.subject,
        controllerDid: params.controller,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      logger.log('[controller-witness] API error:', response.status, error)
      return undefined
    }

    const result = await response.json() as WitnessResult
    logger.log('[controller-witness] Witness attestation created:', {
      uid: result.uid,
      method: result.method,
      txHash: result.txHash,
    })
    return result
  } catch (err) {
    logger.log('[controller-witness] Error:', err)
    return undefined
  }
}
