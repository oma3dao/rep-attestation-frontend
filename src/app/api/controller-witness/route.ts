import { NextRequest, NextResponse } from 'next/server'

const UPSTREAM_URL =
  process.env.CONTROLLER_WITNESS_URL ??
  'https://registry.omatrust.org/api/controller-witness'

/**
 * Proxy POST /api/controller-witness to the upstream witness API.
 * This avoids CORS issues when calling cross-origin from the browser.
 *
 * Short-term solution — see GITHUB-ISSUE-controller-witness-architecture.md
 * for the long-term plan.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const res = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error('[controller-witness proxy] Error:', error)
    return NextResponse.json(
      { error: 'Failed to reach witness API' },
      { status: 502 }
    )
  }
}
