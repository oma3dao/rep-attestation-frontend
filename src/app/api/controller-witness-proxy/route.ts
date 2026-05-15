import { NextRequest, NextResponse } from 'next/server'

const UPSTREAM_URL =
  process.env.CONTROLLER_WITNESS_URL ??
  'https://registry.omatrust.org/api/controller-witness'

const MAX_REDIRECTS = 3

/**
 * Proxy POST /api/controller-witness-proxy to the upstream witness API.
 * This avoids CORS issues when calling cross-origin from the browser.
 *
 * Uses `redirect: 'manual'` so that 302s don't silently convert POST → GET
 * (the default fetch behaviour per HTTP spec). Instead we follow the
 * Location header ourselves, preserving the POST method and body.
 *
 * Short-term solution — see GITHUB-ISSUE-controller-witness-architecture.md
 * for the long-term plan.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const jsonBody = JSON.stringify(body)

    let url = UPSTREAM_URL
    let res: Response | undefined

    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonBody,
        redirect: 'manual',
      })

      // Follow 3xx redirects manually, preserving POST
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location')
        if (!location) break
        url = location.startsWith('http') ? location : new URL(location, url).toString()
        continue
      }

      break
    }

    if (!res) {
      return NextResponse.json({ error: 'No response from upstream' }, { status: 502 })
    }

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
