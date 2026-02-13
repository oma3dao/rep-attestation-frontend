import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  callControllerWitness,
  type WitnessConfig,
  type ControllerWitnessRequest,
} from '@/lib/controller-witness-client'
import * as loggerModule from '@/lib/logger'

// Mock the logger
vi.mock('@/lib/logger', () => ({
  default: { log: vi.fn(), error: vi.fn() },
}))

describe('controller-witness-client', () => {
  const baseParams = {
    attestationUid: '0xabc123',
    chainId: 66238,
    easContract: '0xeascontract',
    schemaUid: '0xschemauid',
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

  it('tries dns-txt first and returns result on success', async () => {
    const successResponse = {
      uid: '0xwitness',
      txHash: '0xtx',
      observedAt: 1700000000,
    }

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify(successResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const result = await callControllerWitness(baseParams)

    expect(result).toEqual(successResponse)
    expect(global.fetch).toHaveBeenCalledTimes(1)

    // Verify dns-txt was the method used
    const body = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    )
    expect(body.method).toBe('dns-txt')
  })

  it('falls back to did-json when dns-txt fails (non-ok response)', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>

    // dns-txt returns 404
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'EVIDENCE_NOT_FOUND' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // did-json returns success
    const successResponse = { uid: '0xwitness2', txHash: '0xtx2' }
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(successResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const result = await callControllerWitness(baseParams)

    expect(result).toEqual(successResponse)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // Verify methods
    const call1Body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const call2Body = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(call1Body.method).toBe('dns-txt')
    expect(call2Body.method).toBe('did-json')
  })

  it('falls back to did-json when dns-txt throws an exception', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>

    // dns-txt throws
    fetchMock.mockRejectedValueOnce(new Error('Network error'))

    // did-json returns success
    const successResponse = { uid: '0xwitness3' }
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(successResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const result = await callControllerWitness(baseParams)

    expect(result).toEqual(successResponse)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns undefined when all methods fail', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>

    // Both methods return errors
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'EVIDENCE_NOT_FOUND' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'EVIDENCE_NOT_FOUND' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const result = await callControllerWitness(baseParams)

    expect(result).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns undefined when all methods throw exceptions', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>

    fetchMock.mockRejectedValueOnce(new Error('dns-txt error'))
    fetchMock.mockRejectedValueOnce(new Error('did-json error'))

    const result = await callControllerWitness(baseParams)

    expect(result).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('sends correct request payload including all fields', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ uid: '0x1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await callControllerWitness(baseParams)

    const [url, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(options.body)

    expect(body).toEqual({
      ...baseParams,
      method: 'dns-txt',
    })
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.method).toBe('POST')
  })

  it('uses NEXT_PUBLIC_CONTROLLER_WITNESS_URL env when set', async () => {
    // The URL is read at module init time, so we need to reset modules
    vi.resetModules()

    // Set the env before importing
    process.env.NEXT_PUBLIC_CONTROLLER_WITNESS_URL = 'https://custom-gateway.com/v1/cw'

    const mod = await import('@/lib/controller-witness-client')

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ uid: '0x1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await mod.callControllerWitness(baseParams)

    expect(global.fetch).toHaveBeenCalledWith(
      'https://custom-gateway.com/v1/cw',
      expect.any(Object)
    )

    // Cleanup
    delete process.env.NEXT_PUBLIC_CONTROLLER_WITNESS_URL
  })

  it('logs the start of witness call', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ uid: '0x1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await callControllerWitness(baseParams)

    expect(loggerModule.default.log).toHaveBeenCalledWith(
      '[controller-witness] Starting witness call:',
      expect.objectContaining({
        attestationUid: baseParams.attestationUid,
        subject: baseParams.subject,
        controller: baseParams.controller,
      })
    )
  })

  it('logs success with witness details', async () => {
    const successResponse = {
      uid: '0xwitness',
      txHash: '0xtx',
      observedAt: 1700000000,
      existing: false,
    }

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify(successResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await callControllerWitness(baseParams)

    expect(loggerModule.default.log).toHaveBeenCalledWith(
      '[controller-witness] Witness attestation created:',
      expect.objectContaining({
        method: 'dns-txt',
        uid: '0xwitness',
        txHash: '0xtx',
      })
    )
  })

  it('logs per-method error with status, code, and method when API returns non-ok', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>

    // dns-txt returns 404 with specific error code
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'EVIDENCE_NOT_FOUND' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // did-json returns 500 with server error code
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'INTERNAL_ERROR' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await callControllerWitness(baseParams)

    // Verify per-method error logs
    expect(loggerModule.default.log).toHaveBeenCalledWith(
      '[controller-witness] API error:',
      { status: 404, code: 'EVIDENCE_NOT_FOUND', method: 'dns-txt' }
    )
    expect(loggerModule.default.log).toHaveBeenCalledWith(
      '[controller-witness] API error:',
      { status: 500, code: 'INTERNAL_ERROR', method: 'did-json' }
    )
  })

  it('logs exception message when a method throws', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>

    // dns-txt throws a network error
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    // did-json succeeds so we can check the dns-txt error log
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ uid: '0xrecovered' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await callControllerWitness(baseParams)

    // The catch block logs "[controller-witness] dns-txt failed:" with the error
    expect(loggerModule.default.log).toHaveBeenCalledWith(
      '[controller-witness] dns-txt failed:',
      expect.any(Error)
    )
  })

  it('logs when all methods fail', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'err' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'err' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await callControllerWitness(baseParams)

    expect(loggerModule.default.log).toHaveBeenCalledWith(
      '[controller-witness] All methods failed (non-blocking)'
    )
  })

  describe('WitnessConfig type', () => {
    it('has correct shape', () => {
      const config: WitnessConfig = {
        subjectField: 'subject',
        controllerField: 'keyId',
      }
      expect(config.subjectField).toBe('subject')
      expect(config.controllerField).toBe('keyId')
    })
  })

  describe('ControllerWitnessRequest type', () => {
    it('has correct shape', () => {
      const request: ControllerWitnessRequest = {
        attestationUid: '0x1',
        chainId: 66238,
        easContract: '0xeas',
        schemaUid: '0xschema',
        subject: 'did:web:example.com',
        controller: 'did:pkh:eip155:1:0xabc',
        method: 'dns-txt',
      }
      expect(request.method).toBe('dns-txt')
    })
  })
})
