/**
 * EAS Nonce Lookup API Route
 * 
 * GET /api/eas/nonce?attester=0x...
 * Returns the current EAS nonce for a given attester address.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNonce, EasRouteError } from '@/lib/server/eas-routes';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const attester = new URL(req.url).searchParams.get('attester');
    const result = await getNonce(attester || '');
    
    return NextResponse.json({
      ...result,
      elapsed: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    const elapsed = `${Date.now() - startTime}ms`;
    
    if (error instanceof EasRouteError) {
      return NextResponse.json(
        { error: error.message, code: error.code, elapsed },
        { status: error.statusCode }
      );
    }
    
    console.error('[eas/nonce] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal error', elapsed },
      { status: 500 }
    );
  }
}
