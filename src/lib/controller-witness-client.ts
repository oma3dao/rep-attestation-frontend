/**
 * Controller Witness API client
 *
 * Thin wrapper around the SDK's callControllerWitness that injects the
 * gateway URL from environment and adapts the return type for the frontend.
 */

import * as reputation from '@oma3/omatrust/reputation'
import type { Hex, Did } from '@oma3/omatrust/reputation'
import logger from '@/lib/logger'

function getWitnessGatewayUrl() {
  const configured = process.env.NEXT_PUBLIC_CONTROLLER_WITNESS_URL?.trim()

  if (!configured) {
    return '/api/controller-witness-proxy'
  }

  if (typeof window === 'undefined') {
    return configured
  }

  try {
    const configuredUrl = new URL(configured, window.location.origin)
    if (
      configuredUrl.pathname === '/api/controller-witness-proxy' &&
      configuredUrl.hostname === 'localhost' &&
      configuredUrl.origin !== window.location.origin
    ) {
      return `${window.location.origin}/api/controller-witness-proxy`
    }
  } catch {
    return configured
  }

  return configured
}

interface WitnessCallParams {
  attestationUid: string
  chainId: number
  easContract: string
  schemaUid: string
  subject: string
  controller: string
}

/**
 * Call the Controller Witness API via the SDK.
 * Returns the details object on success, or undefined if all methods fail.
 */
export async function callControllerWitness(
  params: WitnessCallParams
): Promise<Record<string, any> | undefined> {
  logger.log('[controller-witness] Starting witness call:', {
    attestationUid: params.attestationUid,
    subject: params.subject,
    controller: params.controller,
  })

  try {
    const result = await reputation.callControllerWitness({
      gatewayUrl: getWitnessGatewayUrl(),
      attestationUid: params.attestationUid as Hex,
      chainId: params.chainId,
      easContract: params.easContract as Hex,
      schemaUid: params.schemaUid as Hex,
      subject: params.subject as Did,
      controller: params.controller as Did,
    })

    if (result.ok) {
      const details = result.details as Record<string, any> | undefined
      logger.log('[controller-witness] Witness attestation created:', {
        method: result.method,
        uid: details?.uid,
        txHash: details?.txHash,
      })
      return details ?? { method: result.method }
    }

    logger.log('[controller-witness] All methods failed (non-blocking)')
    return undefined
  } catch (err) {
    logger.log('[controller-witness] Error (non-blocking):', err)
    return undefined
  }
}
