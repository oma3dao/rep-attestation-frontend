import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BackendApiError } from '@/lib/omatrust-backend'

const easMocks = vi.hoisted(() => ({
  session: {
    account: { id: 'account-1', displayName: 'Test Account' },
    wallet: {
      did: 'did:pkh:eip155:66238:0x1234567890123456789012345678901234567890',
      walletProviderId: 'inApp',
      executionMode: 'subscription',
      isManagedWallet: true,
    },
    credential: null,
    subscription: { plan: 'free', status: 'active' },
    client: null,
    primarySubject: null,
  } as any,
  isSubsidizedSchema: vi.fn(),
  getRelayEasNonce: vi.fn(),
  postRelayEasDelegatedAttest: vi.fn(),
  prepareDelegatedAttestation: vi.fn(),
  submitDelegatedAttestation: vi.fn(),
  submitAttestation: vi.fn(),
  signTypedData: vi.fn(),
  toEthers: vi.fn(),
}))

vi.mock('@/components/backend-session-provider', () => ({
  useBackendSession: () => ({ session: easMocks.session }),
}))

vi.mock('@/lib/blockchain', () => ({
  useWallet: () => ({
    isConnected: true,
    address: '0x1234567890123456789012345678901234567890',
    chainId: 66238,
    isChainSupported: true,
  }),
  getActiveThirdwebChain: () => ({ id: 66238, name: 'OMAchain Testnet' }),
}))

vi.mock('thirdweb/react', () => ({
  useActiveAccount: () => ({ address: '0x1234567890123456789012345678901234567890' }),
  useActiveWallet: () => ({ id: 'inApp' }),
}))

vi.mock('@/app/client', () => ({
  client: { clientId: 'test-client' },
}))

vi.mock('@/config/attestation-services', () => ({
  EAS_CONFIG: { supportedChains: [66238] },
  getContractAddress: () => '0x8835AF90f1537777F52E482C8630cE4e947eCa32',
}))

vi.mock('@/config/schemas', () => ({
  getSchema: () => ({
    id: 'any-schema',
    easSchemaString: 'string subject',
    deployedUIDs: {
      66238: '0x1111111111111111111111111111111111111111111111111111111111111111',
    },
    revocable: false,
  }),
}))

vi.mock('@/config/subsidized-schemas', () => ({
  isSubsidizedSchema: (...args: unknown[]) => easMocks.isSubsidizedSchema(...args),
}))

vi.mock('thirdweb/adapters/ethers6', () => ({
  ethers6Adapter: {
    signer: {
      toEthers: (...args: unknown[]) => easMocks.toEthers(...args),
    },
  },
}))

vi.mock('@oma3/omatrust/reputation', () => ({
  prepareDelegatedAttestation: (...args: unknown[]) => easMocks.prepareDelegatedAttestation(...args),
  submitDelegatedAttestation: (...args: unknown[]) => easMocks.submitDelegatedAttestation(...args),
  submitAttestation: (...args: unknown[]) => easMocks.submitAttestation(...args),
}))

vi.mock('@/lib/omatrust-backend', async () => {
  const actual = await vi.importActual<typeof import('@/lib/omatrust-backend')>('@/lib/omatrust-backend')
  return {
    ...actual,
    getRelayEasNonce: (...args: unknown[]) => easMocks.getRelayEasNonce(...args),
    postRelayEasDelegatedAttest: (...args: unknown[]) => easMocks.postRelayEasDelegatedAttest(...args),
  }
})

describe('useEASClient execution-mode routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    easMocks.session = {
      account: { id: 'account-1', displayName: 'Test Account' },
      wallet: {
        did: 'did:pkh:eip155:66238:0x1234567890123456789012345678901234567890',
        walletProviderId: 'inApp',
        executionMode: 'subscription',
        isManagedWallet: true,
      },
      credential: null,
      subscription: { plan: 'free', status: 'active' },
      client: null,
      primarySubject: null,
    }
    easMocks.isSubsidizedSchema.mockReturnValue(false)
    easMocks.getRelayEasNonce.mockResolvedValue({
      nonce: '7',
      chainId: 66238,
      chain: 'OMAchain Testnet',
      easAddress: '0x8835AF90f1537777F52E482C8630cE4e947eCa32',
    })
    easMocks.prepareDelegatedAttestation.mockResolvedValue({
      typedData: {
        domain: { name: 'EAS' },
        types: { Attest: [{ name: 'nonce', type: 'uint256' }] },
        message: { nonce: BigInt(7) },
      },
      delegatedRequest: { schema: '0x1111111111111111111111111111111111111111111111111111111111111111' },
    })
    easMocks.signTypedData.mockResolvedValue('0xsigned')
    easMocks.toEthers.mockReturnValue({ signTypedData: easMocks.signTypedData })
    easMocks.postRelayEasDelegatedAttest.mockResolvedValue({
      success: true,
      txHash: '0xtx',
      uid: '0xuid',
      blockNumber: 123,
    })
    easMocks.submitDelegatedAttestation.mockResolvedValue({ txHash: '0xlegacy', uid: '0xlegacyuid' })
    easMocks.submitAttestation.mockResolvedValue({ txHash: '0xdirect', uid: '0xdirectuid' })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ nonce: '3' }),
    }) as any
  })

  it('routes subscription execution through backend relay nonce and delegated attest', async () => {
    const { useEASClient } = await import('@/lib/eas')
    const { result } = renderHook(() => useEASClient())

    let attestationResult: Awaited<ReturnType<typeof result.current.createAttestation>>
    await act(async () => {
      attestationResult = await result.current.createAttestation({
        schemaId: 'any-schema',
        recipient: 'did:web:example.com',
        data: { subject: 'did:web:example.com' },
      })
    })

    expect(easMocks.getRelayEasNonce).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890')
    expect(easMocks.prepareDelegatedAttestation).toHaveBeenCalledWith(expect.objectContaining({
      nonce: BigInt(7),
      chainId: 66238,
      easContractAddress: '0x8835AF90f1537777F52E482C8630cE4e947eCa32',
    }))
    expect(easMocks.postRelayEasDelegatedAttest).toHaveBeenCalledWith(expect.objectContaining({
      attester: '0x1234567890123456789012345678901234567890',
      signature: '0xsigned',
    }))
    expect(easMocks.submitDelegatedAttestation).not.toHaveBeenCalled()
    expect(easMocks.submitAttestation).not.toHaveBeenCalled()
    expect(attestationResult!).toMatchObject({
      transactionHash: '0xtx',
      attestationId: '0xuid',
      blockNumber: 123,
    })
  })

  it('keeps native subsidized schemas on the frontend-hosted delegated path', async () => {
    easMocks.session.wallet.executionMode = 'native'
    easMocks.isSubsidizedSchema.mockReturnValue(true)

    const { useEASClient } = await import('@/lib/eas')
    const { result } = renderHook(() => useEASClient())

    await act(async () => {
      await result.current.createAttestation({
        schemaId: 'any-schema',
        recipient: 'did:web:example.com',
        data: { subject: 'did:web:example.com' },
      })
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/eas/nonce?attester=0x1234567890123456789012345678901234567890')
    expect(easMocks.submitDelegatedAttestation).toHaveBeenCalledWith(expect.objectContaining({
      relayUrl: '/api/eas/delegated-attest',
      attester: '0x1234567890123456789012345678901234567890',
    }))
    expect(easMocks.getRelayEasNonce).not.toHaveBeenCalled()
    expect(easMocks.postRelayEasDelegatedAttest).not.toHaveBeenCalled()
  })

  it('keeps native non-subsidized schemas on direct transactions', async () => {
    easMocks.session.wallet.executionMode = 'native'
    easMocks.isSubsidizedSchema.mockReturnValue(false)

    const { useEASClient } = await import('@/lib/eas')
    const { result } = renderHook(() => useEASClient())

    await act(async () => {
      await result.current.createAttestation({
        schemaId: 'any-schema',
        recipient: 'did:web:example.com',
        data: { subject: 'did:web:example.com' },
      })
    })

    expect(easMocks.submitAttestation).toHaveBeenCalled()
    expect(easMocks.submitDelegatedAttestation).not.toHaveBeenCalled()
    expect(easMocks.getRelayEasNonce).not.toHaveBeenCalled()
  })

  it('surfaces subscription relay entitlement errors without falling back to native', async () => {
    easMocks.getRelayEasNonce.mockRejectedValue(
      new BackendApiError('Sponsored write limit exceeded', 403, 'SPONSORED_WRITE_LIMIT_EXCEEDED')
    )

    const { useEASClient } = await import('@/lib/eas')
    const { result } = renderHook(() => useEASClient())

    await expect(result.current.createAttestation({
      schemaId: 'any-schema',
      recipient: 'did:web:example.com',
      data: { subject: 'did:web:example.com' },
    })).rejects.toThrow(/Manage your account/)

    expect(easMocks.submitDelegatedAttestation).not.toHaveBeenCalled()
    expect(easMocks.submitAttestation).not.toHaveBeenCalled()
  })
})
