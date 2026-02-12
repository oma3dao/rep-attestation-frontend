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

    // Try to parse as JSON, fall back to text
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const data = await res.json()
      return NextResponse.json(data, { status: res.status })
    } else {
      const text = await res.text()
      console.error('[controller-witness proxy] Non-JSON response:', {
        status: res.status,
        body: text.slice(0, 500),
      })
      return NextResponse.json(
        { error: `Upstream returned ${res.status}`, detail: text.slice(0, 200) },
        { status: res.status || 502 }
      )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[controller-witness proxy] Fetch error:', message)
    return NextResponse.json(
      { error: 'Failed to reach witness API', detail: message },
      { status: 502 }
    )
  }
}
