import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Store the original env
const ORIGINAL_ENV = process.env

describe('controller-witness proxy route', () => {
  let POST: typeof import('@/app/api/controller-witness-proxy/route').POST

  beforeEach(async () => {
    vi.resetModules()
    // Reset fetch mock before each test
    global.fetch = vi.fn()
    // Fresh import so env changes take effect
    const mod = await import('@/app/api/controller-witness-proxy/route')
    POST = mod.POST
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  function makeRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost:3000/api/controller-witness-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('proxies a successful JSON response from upstream', async () => {
    const upstreamBody = { uid: '0xabc', txHash: '0xdef' }
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify(upstreamBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const req = makeRequest({ attestationUid: '0x123', method: 'dns-txt' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(upstreamBody)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('uses CONTROLLER_WITNESS_URL env variable when set', async () => {
    vi.resetModules()
    process.env.CONTROLLER_WITNESS_URL = 'https://custom-witness.example.com/api/cw'
    const mod = await import('@/app/api/controller-witness-proxy/route')

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const req = makeRequest({ test: true })
    await mod.POST(req)

    expect(global.fetch).toHaveBeenCalledWith(
      'https://custom-witness.example.com/api/cw',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('follows redirect preserving POST method', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>

    // First call returns 302 redirect
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { Location: 'https://redirected.example.com/api/cw' },
      })
    )

    // Second call returns success
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ redirected: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const req = makeRequest({ test: 'redirect' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ redirected: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // Second call should be to the redirected URL
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://redirected.example.com/api/cw',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ test: 'redirect' }),
      })
    )
  })

  it('follows relative redirect Location headers', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>

    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 301,
        headers: { Location: '/v2/controller-witness' },
      })
    )

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ v2: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const req = makeRequest({ test: 'relative' })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stops following redirects after MAX_REDIRECTS (3)', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>

    // 4 redirects (one more than MAX_REDIRECTS)
    for (let i = 0; i < 4; i++) {
      fetchMock.mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: `https://redirect${i}.example.com/api` },
        })
      )
    }

    const req = makeRequest({ test: 'too-many-redirects' })
    const res = await POST(req)

    // Should stop after MAX_REDIRECTS + 1 attempts (0..3 = 4 calls)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    // The last response was a redirect (no JSON), so we get the non-JSON handler
    expect(res.status).toBe(302)
  })

  it('handles redirect with no Location header', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        // No Location header
      })
    )

    const req = makeRequest({ test: 'no-location' })
    const res = await POST(req)

    // Should break out of redirect loop and handle the response
    expect(res.status).toBe(302)
  })

  it('returns non-JSON upstream error with details', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('<html>Server Error</html>', {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      })
    )

    const req = makeRequest({ test: 'error' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toContain('Upstream returned 500')
    expect(json.detail).toContain('Server Error')

    consoleSpy.mockRestore()
  })

  it('returns 502 when fetch throws a network error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('ECONNREFUSED')
    )

    const req = makeRequest({ test: 'network-error' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(502)
    expect(json.error).toBe('Failed to reach witness API')
    expect(json.detail).toBe('ECONNREFUSED')

    consoleSpy.mockRestore()
  })

  it('returns 502 for non-Error exceptions', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce('string error')

    const req = makeRequest({ test: 'string-error' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(502)
    expect(json.error).toBe('Failed to reach witness API')
    expect(json.detail).toBe('Unknown error')

    consoleSpy.mockRestore()
  })

  it('proxies upstream 4xx JSON error responses', async () => {
    const errorBody = { code: 'EVIDENCE_NOT_FOUND', message: 'No TXT record found' }
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify(errorBody), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const req = makeRequest({ test: '404' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json).toEqual(errorBody)
  })

  it('forwards the request body as JSON', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const payload = {
      attestationUid: '0xabc123',
      chainId: 66238,
      easContract: '0xcontract',
      schemaUid: '0xschema',
      subject: 'did:web:example.com',
      controller: 'did:pkh:eip155:1:0xwallet',
      method: 'dns-txt',
    }

    const req = makeRequest(payload)
    await POST(req)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      })
    )
  })

  it('passes redirect: manual to every fetch call to preserve POST on redirects', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>

    // Return a redirect, then a success so we can verify both calls use manual
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { Location: 'https://redirected.example.com/api/cw' },
      })
    )
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const req = makeRequest({ test: 'redirect-manual' })
    await POST(req)

    // Both fetch calls must include redirect: 'manual'
    expect(fetchMock).toHaveBeenCalledTimes(2)
    for (const call of fetchMock.mock.calls) {
      expect(call[1]).toEqual(
        expect.objectContaining({ redirect: 'manual' })
      )
    }
  })

  it('truncates non-JSON error body to 200 chars in response detail', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Create a body longer than 200 chars
    const longBody = 'A'.repeat(500)
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(longBody, {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      })
    )

    const req = makeRequest({ test: 'long-error' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.detail).toHaveLength(200)
    expect(json.detail).toBe('A'.repeat(200))

    consoleSpy.mockRestore()
  })

  it('logs non-JSON error body truncated to 500 chars in console', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const longBody = 'B'.repeat(1000)
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(longBody, {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      })
    )

    const req = makeRequest({ test: 'long-error-log' })
    await POST(req)

    expect(consoleSpy).toHaveBeenCalledWith(
      '[controller-witness proxy] Non-JSON response:',
      expect.objectContaining({
        status: 500,
        body: 'B'.repeat(500),
      })
    )

    consoleSpy.mockRestore()
  })

  it('returns 502 when upstream returns non-JSON with falsy status (res.status || 502)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Response constructor does not allow status 0 (200-599). Use a response-like object
    // to exercise the route's res.status || 502 fallback.
    const fakeResponse = {
      status: 0,
      headers: { get: () => 'text/html' },
      text: () => Promise.resolve('<html>Error</html>'),
    }
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakeResponse)

    const req = makeRequest({ test: 'falsy-status' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(502)
    expect(json.error).toContain('Upstream returned 0')
    expect(json.detail).toContain('Error')

    consoleSpy.mockRestore()
  })
})
