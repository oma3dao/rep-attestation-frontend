import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { callControllerWitness } from '@/lib/controller-witness-client'
import * as loggerModule from '@/lib/logger'

vi.mock('@/lib/logger', () => ({
  default: { log: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/service-urls', () => ({
  getBackendOrigin: () => 'https://backend.test',
}))

const WITNESS_URL = 'https://backend.test/api/private/controller-witness'

describe('controller-witness-client', () => {
  const baseParams = {
    subject: 'did:web:example.com',
    controller: 'did:pkh:eip155:1:0xwallet',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockFetchResponse(body: unknown, status = 200) {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  }

  it('posts to the private controller-witness endpoint with the mapped payload', async () => {
    mockFetchResponse({ success: true, uid: '0x1', method: 'dns-txt', txHash: '0xtx' })

    await callControllerWitness(baseParams)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe(WITNESS_URL)
    expect(options.method).toBe('POST')
    expect(options.credentials).toBe('include')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({
      subjectDid: baseParams.subject,
      controllerDid: baseParams.controller,
    })
  })

  it('returns the parsed witness result on success', async () => {
    const successResponse = {
      success: true,
      uid: '0xwitness',
      txHash: '0xtx',
      blockNumber: 123,
      observedAt: 1700000000,
      method: 'dns-txt',
    }
    mockFetchResponse(successResponse)

    const result = await callControllerWitness(baseParams)

    expect(result).toEqual(successResponse)
  })

  it('returns undefined and logs an API error on a non-ok response', async () => {
    mockFetchResponse({ error: 'EVIDENCE_NOT_FOUND' }, 404)

    const result = await callControllerWitness(baseParams)

    expect(result).toBeUndefined()
    expect(loggerModule.default.log).toHaveBeenCalledWith(
      '[controller-witness] API error:',
      404,
      expect.objectContaining({ error: 'EVIDENCE_NOT_FOUND' })
    )
  })

  it('returns undefined and logs an error when fetch throws', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'))

    const result = await callControllerWitness(baseParams)

    expect(result).toBeUndefined()
    expect(loggerModule.default.log).toHaveBeenCalledWith(
      '[controller-witness] Error:',
      expect.any(Error)
    )
  })

  it('logs the start of the witness call with subject and controller', async () => {
    mockFetchResponse({ success: true, uid: '0x1' })

    await callControllerWitness(baseParams)

    expect(loggerModule.default.log).toHaveBeenCalledWith(
      '[controller-witness] Starting witness call:',
      expect.objectContaining({
        subject: baseParams.subject,
        controller: baseParams.controller,
      })
    )
  })

  it('logs success with the witness details', async () => {
    mockFetchResponse({
      success: true,
      uid: '0xwitness',
      txHash: '0xtx',
      method: 'dns-txt',
    })

    await callControllerWitness(baseParams)

    expect(loggerModule.default.log).toHaveBeenCalledWith(
      '[controller-witness] Witness attestation created:',
      expect.objectContaining({
        uid: '0xwitness',
        method: 'dns-txt',
        txHash: '0xtx',
      })
    )
  })
})
