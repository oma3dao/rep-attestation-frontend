import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardPage from '@/app/dashboard/page'

const mockUseWallet = vi.fn()
const mockUseActiveAccount = vi.fn()
const mockGetAttestationsByAttesterWithMetadata = vi.fn()

vi.mock('thirdweb/react', () => ({
  useActiveAccount: () => mockUseActiveAccount(),
}))

vi.mock('thirdweb/adapters/ethers6', () => ({
  ethers6Adapter: {
    signer: {
      toEthers: vi.fn(),
    },
  },
}))

vi.mock('@/lib/blockchain', () => ({
  useWallet: () => mockUseWallet(),
  getActiveThirdwebChain: () => ({ id: 66238 }),
}))

vi.mock('@/lib/attestation-queries', () => ({
  getAttestationsByAttesterWithMetadata: (...args: unknown[]) => mockGetAttestationsByAttesterWithMetadata(...args),
}))

describe('Dashboard Page', () => {
  beforeEach(() => {
    mockUseActiveAccount.mockReturnValue({ address: '0x1111111111111111111111111111111111111111' })
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([])
    mockUseWallet.mockReturnValue({
      isConnected: false,
      address: null,
      chainId: 66238,
    })
  })

  it('renders connect-wallet prompt when disconnected', () => {
    render(<DashboardPage />)
    expect(screen.getByText(/my attestations/i)).toBeInTheDocument()
    expect(screen.getByText(/connect your wallet to view and revoke your attestations/i)).toBeInTheDocument()
  })

  it('renders attestation table headings when connected', async () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: '0x1111111111111111111111111111111111111111',
      chainId: 66238,
    })
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      {
        uid: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        schema: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        attester: '0x1111111111111111111111111111111111111111',
        recipient: '0x9999999999999999999999999999999999999999',
        data: '0x',
        time: 1735689600,
        expirationTime: 0,
        revocationTime: 0,
        refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
        revocable: true,
        schemaId: 'linked-identifier',
        schemaTitle: 'Linked Identifier',
        decodedData: {
          subject: 'did:web:example.com',
        },
      },
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(mockGetAttestationsByAttesterWithMetadata).toHaveBeenCalled()
    })

    expect(screen.getByText(/your attestations/i)).toBeInTheDocument()
    expect(screen.getByText(/schema/i)).toBeInTheDocument()
    expect(screen.getByText(/recipient/i)).toBeInTheDocument()
    expect(screen.getByText(/status/i)).toBeInTheDocument()
    expect(screen.getByText(/action/i)).toBeInTheDocument()
  })
})
