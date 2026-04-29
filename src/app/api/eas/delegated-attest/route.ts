/**
 * Delegated Attestation API Route
 * 
 * POST /api/eas/delegated-attest
 * Accepts signed EIP-712 attestation data and relays it to EAS,
 * paying gas on behalf of the attester for subsidized schemas.
 */

import { NextRequest, NextResponse } from 'next/server';
import { submitDelegatedAttestation, EasRouteError } from '@/lib/server/eas-routes';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log('[delegated-attest] ========== REQUEST RECEIVED ==========');
  
  try {
    const body = await req.json();
    console.log('[delegated-attest] Body keys:', Object.keys(body));
    
    const result = await submitDelegatedAttestation({
      prepared: body.prepared,
      signature: body.signature,
      attester: body.attester,
    });

    const elapsed = `${Date.now() - startTime}ms`;
    console.log(`[delegated-attest] Success in ${elapsed} - UID: ${result.uid}`);

    return NextResponse.json({
      ...result,
      elapsed,
    });
  } catch (error) {
    const elapsed = `${Date.now() - startTime}ms`;
    
    if (error instanceof EasRouteError) {
      console.error(`[delegated-attest] Error (${error.statusCode}): ${error.message}`);
      return NextResponse.json(
        { error: error.message, code: error.code, elapsed },
        { status: error.statusCode }
      );
    }
    
    console.error(`[delegated-attest] Unexpected error after ${elapsed}:`, error);
    const errorMessage = (error as any)?.reason || (error as any)?.message || 'Internal error';
    
    return NextResponse.json(
      { error: errorMessage, elapsed },
      { status: 500 }
    );
  }
}
