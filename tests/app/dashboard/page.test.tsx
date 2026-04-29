import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardPage from '@/app/dashboard/page'
import type { EnrichedAttestationResult } from '@/lib/attestation-queries'

const mockUseWallet = vi.fn()
const mockUseActiveAccount = vi.fn()
const mockGetAttestationsByAttesterWithMetadata = vi.fn()
const mockRevokeAttestation = vi.fn()

vi.mock('thirdweb/react', () => ({
  useActiveAccount: () => mockUseActiveAccount(),
}))

vi.mock('thirdweb/adapters/ethers6', () => ({
  ethers6Adapter: {
    signer: {
      toEthers: vi.fn().mockResolvedValue({ provider: {} }),
    },
  },
}))

vi.mock('@/lib/blockchain', () => ({
  useWallet: () => mockUseWallet(),
  getActiveThirdwebChain: () => ({ id: 66238 }),
  getActiveChain: () => ({ id: 66238, rpc: 'https://rpc.testnet.chain.oma3.org/' }),
}))

vi.mock('@/lib/attestation-queries', () => ({
  getAttestationsByAttesterWithMetadata: (...args: unknown[]) => mockGetAttestationsByAttesterWithMetadata(...args),
}))

vi.mock('@oma3/omatrust/reputation', () => ({
  revokeAttestation: (...args: unknown[]) => mockRevokeAttestation(...args),
}))

const mockGetChainById = vi.fn()
const mockGetContractAddress = vi.fn()

vi.mock('@/config/chains', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/chains')>()
  return {
    ...actual,
    getChainById: (...args: unknown[]) => mockGetChainById(...args),
  }
})

vi.mock('@/config/attestation-services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/attestation-services')>()
  return {
    ...actual,
    getContractAddress: (...args: unknown[]) => mockGetContractAddress(...args),
  }
})

const WALLET_ADDRESS = '0x1111111111111111111111111111111111111111'
const OTHER_ADDRESS = '0x2222222222222222222222222222222222222222'

function makeAttestation(overrides: Partial<EnrichedAttestationResult> = {}): EnrichedAttestationResult {
  return {
    uid: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    schema: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    attester: WALLET_ADDRESS,
    recipient: '0x9999999999999999999999999999999999999999',
    data: '0x',
    time: 1735689600,
    expirationTime: 0,
    revocationTime: 0,
    refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
    revocable: true,
    schemaId: 'linked-identifier',
    schemaTitle: 'Linked Identifier',
    decodedData: { subject: 'did:web:example.com' },
    ...overrides,
  }
}

function setupConnected() {
  mockUseWallet.mockReturnValue({
    isConnected: true,
    address: WALLET_ADDRESS,
    chainId: 66238,
  })
}

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseActiveAccount.mockReturnValue({ address: WALLET_ADDRESS })
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([])
    mockUseWallet.mockReturnValue({
      isConnected: false,
      address: null,
      chainId: 66238,
    })
    mockGetChainById.mockReturnValue({
      id: 66238,
      name: 'OMAchain Testnet',
      blockExplorers: [{ name: 'Explorer', url: 'https://explorer.testnet.chain.oma3.org' }],
    })
    mockGetContractAddress.mockReturnValue('0x' + 'e'.repeat(40))
  })

  // ── Disconnected state ──────────────────────────────────────────────

  it('renders connect-wallet prompt when disconnected', () => {
    render(<DashboardPage />)
    expect(screen.getByText(/my attestations/i)).toBeInTheDocument()
    expect(screen.getByText(/connect your wallet to view and revoke your attestations/i)).toBeInTheDocument()
  })

  it('does not call getAttestationsByAttester when disconnected', () => {
    render(<DashboardPage />)
    expect(mockGetAttestationsByAttesterWithMetadata).not.toHaveBeenCalled()
  })

  // ── Connected state – table rendering ───────────────────────────────

  it('renders attestation table headings when connected', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([makeAttestation()])

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

  it('calls getAttestationsByAttesterWithMetadata with connected wallet address', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(mockGetAttestationsByAttesterWithMetadata).toHaveBeenCalledWith(WALLET_ADDRESS, 66238, 100)
    })
  })

  it('shows empty state when no attestations found', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText(/no attestations found for this wallet/i)).toBeInTheDocument()
    })
  })

  // ── Schema & recipient display ──────────────────────────────────────

  it('displays schema title for each attestation', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({ schemaTitle: 'Key Binding' }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Key Binding')).toBeInTheDocument()
    })
  })

  it('displays "Unknown schema" when schemaTitle is missing', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({ schemaTitle: undefined, schemaId: undefined }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Unknown schema')).toBeInTheDocument()
    })
  })

  it('uses decodedData.subject as recipient label when available', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({ decodedData: { subject: 'did:web:example.com' } }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText(/did:web:example\.com/)).toBeInTheDocument()
    })
  })

  it('falls back to recipient address when decodedData.subject is absent', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({ decodedData: undefined, recipient: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText(/0xabcdefabcd.*abcd/)).toBeInTheDocument()
    })
  })

  // ── Revocation status badges ────────────────────────────────────────

  it('shows "Active" badge when revocationTime is 0', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({ revocationTime: 0 }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument()
    })
  })

  it('shows "Revoked" badge when revocationTime > 0', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({ revocationTime: 1700000000 }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Revoked')).toBeInTheDocument()
    })
  })

  // ── Revoke button visibility ────────────────────────────────────────

  it('shows Revoke button for revocable attestation with matching attester', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({ revocable: true, revocationTime: 0, attester: WALLET_ADDRESS }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument()
    })
  })

  it('does not show Revoke button for non-revocable attestation', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({ revocable: false, revocationTime: 0 }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(mockGetAttestationsByAttesterWithMetadata).toHaveBeenCalled()
    })

    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument()
  })

  it('does not show Revoke button for already revoked attestation', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({ revocable: true, revocationTime: 1700000000 }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Revoked')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument()
  })

  it('does not show Revoke button when attester does not match connected wallet', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({ revocable: true, revocationTime: 0, attester: OTHER_ADDRESS }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(mockGetAttestationsByAttesterWithMetadata).toHaveBeenCalled()
    })

    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument()
  })

  // ── Revoke confirmation dialog flow ─────────────────────────────────

  it('opens confirmation dialog when Revoke button is clicked', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({ revocable: true, revocationTime: 0, attester: WALLET_ADDRESS }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))

    await waitFor(() => {
      expect(screen.getByText('Revoke Attestation')).toBeInTheDocument()
      expect(screen.getByText(/this will permanently revoke attestation/i)).toBeInTheDocument()
    })
  })

  it('closes confirmation dialog when Cancel is clicked', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({ revocable: true, revocationTime: 0, attester: WALLET_ADDRESS }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument()
    })

    // Open dialog
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))

    await waitFor(() => {
      expect(screen.getByText('Revoke Attestation')).toBeInTheDocument()
    })

    // Cancel
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.queryByText('Revoke Attestation')).not.toBeInTheDocument()
    })
  })

  // ── Error handling ──────────────────────────────────────────────────

  it('shows error message when attestation loading fails', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockRejectedValue(new Error('Network error'))

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  // ── Loading state ───────────────────────────────────────────────────

  it('shows loading state while fetching attestations', async () => {
    setupConnected()
    // Never resolves
    mockGetAttestationsByAttesterWithMetadata.mockImplementation(() => new Promise(() => {}))

    render(<DashboardPage />)

    expect(screen.getByText(/loading attestations/i)).toBeInTheDocument()
  })

  // ── Refresh button ──────────────────────────────────────────────────

  it('reloads attestations when Refresh button is clicked', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(mockGetAttestationsByAttesterWithMetadata).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))

    await waitFor(() => {
      expect(mockGetAttestationsByAttesterWithMetadata).toHaveBeenCalledTimes(2)
    })
  })

  // ── Multiple attestations with mixed states ─────────────────────────

  it('renders multiple attestations with correct revoke visibility', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({
        uid: '0x' + 'a'.repeat(64),
        revocable: true,
        revocationTime: 0,
        attester: WALLET_ADDRESS,
        schemaTitle: 'Key Binding',
      }),
      makeAttestation({
        uid: '0x' + 'b'.repeat(64),
        revocable: false,
        revocationTime: 0,
        schemaTitle: 'Certification',
      }),
      makeAttestation({
        uid: '0x' + 'c'.repeat(64),
        revocable: true,
        revocationTime: 1700000000,
        schemaTitle: 'Linked Identifier',
      }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Key Binding')).toBeInTheDocument()
      expect(screen.getByText('Certification')).toBeInTheDocument()
      expect(screen.getByText('Linked Identifier')).toBeInTheDocument()
    })

    // Only the first attestation (revocable + active + matching attester) gets a Revoke button
    const revokeButtons = screen.getAllByRole('button', { name: 'Revoke' })
    expect(revokeButtons).toHaveLength(1)

    // Should show both Active and Revoked badges
    expect(screen.getAllByText('Active')).toHaveLength(2)
    expect(screen.getByText('Revoked')).toBeInTheDocument()
  })

  // ── Revoke execution flow ───────────────────────────────────────────

  it('calls revokeAttestation and refreshes list on successful revocation', async () => {
    setupConnected()
    mockRevokeAttestation.mockResolvedValue(undefined)
    mockGetAttestationsByAttesterWithMetadata
      .mockResolvedValueOnce([makeAttestation({ revocable: true, revocationTime: 0, attester: WALLET_ADDRESS })])
      // After revoke, return revoked version
      .mockResolvedValueOnce([makeAttestation({ revocable: true, revocationTime: 1700000000, attester: WALLET_ADDRESS })])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument()
    })

    // Click Revoke to open dialog
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))

    await waitFor(() => {
      expect(screen.getByText('Revoke Attestation')).toBeInTheDocument()
    })

    // Confirm revocation in dialog
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))

    await waitFor(() => {
      expect(mockRevokeAttestation).toHaveBeenCalledTimes(1)
    })

    // Should refresh attestations after revocation
    await waitFor(() => {
      expect(mockGetAttestationsByAttesterWithMetadata).toHaveBeenCalledTimes(2)
    })
  })

  it('shows error when revocation fails', async () => {
    setupConnected()
    mockRevokeAttestation.mockRejectedValue(new Error('User rejected transaction'))
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({ revocable: true, revocationTime: 0, attester: WALLET_ADDRESS }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument()
    })

    // Open dialog and confirm
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    await waitFor(() => {
      expect(screen.getByText('Revoke Attestation')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))

    await waitFor(() => {
      expect(screen.getByText('User rejected transaction')).toBeInTheDocument()
    })
  })

  // ── Detail modal ────────────────────────────────────────────────────

  it('opens detail modal when attestation row is clicked', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({ schemaTitle: 'Linked Identifier' }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Linked Identifier')).toBeInTheDocument()
    })

    // Click the row (not the revoke button)
    fireEvent.click(screen.getByText('Linked Identifier'))

    await waitFor(() => {
      expect(screen.getByText(/UID:/i)).toBeInTheDocument()
    })
  })

  it('closes detail modal when close button is clicked', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({ schemaTitle: 'Key Binding' }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Key Binding')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Key Binding'))

    await waitFor(() => {
      expect(screen.getByText(/UID:/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    await waitFor(() => {
      expect(screen.queryByText(/UID:/i)).not.toBeInTheDocument()
    })
  })

  // ── Block explorer link ─────────────────────────────────────────────

  it('renders block explorer link when txHash is present', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({
        txHash: '0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678',
      }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      const link = screen.getByTitle('View transaction')
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute(
        'href',
        'https://explorer.testnet.chain.oma3.org/tx/0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678'
      )
      expect(link).toHaveAttribute('target', '_blank')
    })
  })

  it('does not render block explorer link when txHash is absent', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({ txHash: undefined }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(mockGetAttestationsByAttesterWithMetadata).toHaveBeenCalled()
    })

    expect(screen.queryByTitle('View transaction')).not.toBeInTheDocument()
  })

  // ── EAS not available ───────────────────────────────────────────────

  it('shows EAS unavailable message when contract address is missing', async () => {
    mockGetContractAddress.mockReturnValue(undefined)
    setupConnected()

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText(/currently available only on EAS-enabled chains/i)).toBeInTheDocument()
    })
  })
})
