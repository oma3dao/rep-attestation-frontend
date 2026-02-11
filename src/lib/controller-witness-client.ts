/**
 * Controller Witness API client
 *
 * Fires a best-effort POST to the Controller Witness gateway after a
 * successful attestation on a schema that declares x-oma3-witness.
 * The call is non-blocking — failures are logged, never thrown.
 *
 * Strategy: try dns-txt first, fall back to did-json if evidence not found.
 */

import logger from '@/lib/logger'

/** Mirrors the x-oma3-witness block in the JSON schema */
export interface WitnessConfig {
  subjectField: string
  controllerField: string
}

/** Payload sent to POST /v1/controller-witness */
export interface ControllerWitnessRequest {
  attestationUid: string
  chainId: number
  easContract: string
  schemaUid: string
  subject: string
  controller: string
  method: string
}

/** Evidence methods to try, in order */
const METHODS: readonly string[] = ['dns-txt', 'did-json']

const WITNESS_GATEWAY_URL =
  process.env.NEXT_PUBLIC_CONTROLLER_WITNESS_URL ??
  'https://api.omatrust.org/v1/controller-witness'

/**
 * POST a single witness request. Returns the response body on success,
 * or undefined on any failure.
 */
async function postWitness(
  req: ControllerWitnessRequest
): Promise<Record<string, any> | undefined> {
  const res = await fetch(WITNESS_GATEWAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })

  const body = await res.json()

  if (!res.ok) {
    logger.log('[controller-witness] API error:', { status: res.status, code: body.code, method: req.method })
    return undefined
  }

  return body
}

/**
 * Call the Controller Witness API, trying dns-txt first then did-json.
 * Returns the first successful response, or undefined if all methods fail.
 */
export async function callControllerWitness(
  params: Omit<ControllerWitnessRequest, 'method'>
): Promise<Record<string, any> | undefined> {
  logger.log('[controller-witness] Starting witness call:', {
    attestationUid: params.attestationUid,
    subject: params.subject,
    controller: params.controller,
  })

  for (const method of METHODS) {
    try {
      const result = await postWitness({ ...params, method })
      if (result) {
        logger.log('[controller-witness] Witness attestation created:', {
          method,
          uid: result.uid,
          txHash: result.txHash,
          observedAt: result.observedAt,
          existing: result.existing,
        })
        return result
      }
    } catch (err) {
      logger.log(`[controller-witness] ${method} failed:`, err)
    }
  }

  logger.log('[controller-witness] All methods failed (non-blocking)')
  return undefined
}
