import React from 'react'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardPage from '@/app/dashboard/page'
import type { EnrichedAttestationResult } from '@/lib/attestation-queries'

const mockUseWallet = vi.fn()
const mockUseActiveAccount = vi.fn()
const mockGetAttestationsByAttesterWithMetadata = vi.fn()
const mockRevokeAttestation = vi.fn()
const mockUseBackendSession = vi.fn()

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: unknown; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>{children}</a>
  ),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

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
  getAllAttestationsForDIDWithMetadata: vi.fn().mockResolvedValue([]),
}))

vi.mock('@oma3/omatrust/reputation', () => ({
  revokeAttestation: (...args: unknown[]) => mockRevokeAttestation(...args),
}))

vi.mock('@oma3/omatrust/identity', () => ({
  normalizeDid: (d: string) => d,
  isSameControllerId: () => false,
}))

vi.mock('@/lib/omatrust-backend', () => ({
  // Schema-accurate ControllerConfirmResponse shape (notably `warnings: []`,
  // which ServiceTrustWorkspace iterates over).
  getControllerConfirmation: vi.fn().mockResolvedValue({
    subject: { input: 'did:web:example.com', canonical: 'did:web:example.com', label: 'example.com', type: 'web', source: 'input' },
    domain: 'example.com',
    controllerKeys: [],
    evidence: [],
    approvedIssuer: { status: 'not-configured', checkedIdentifiers: [], registryUrl: null },
    warnings: [],
  }),
  resolvePublicIdentities: vi.fn().mockResolvedValue({ identities: [] }),
  getPublicTrustAnchors: vi.fn().mockResolvedValue({
    version: 1,
    updatedAt: '2024-01-01T00:00:00.000Z',
    widgetOrigins: [],
    chains: {},
    registries: [],
  }),
  listSubjects: vi.fn().mockResolvedValue({ subjects: [] }),
}))

vi.mock('@/lib/controller-witness-client', () => ({
  callControllerWitness: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/components/backend-session-provider', () => ({
  useBackendSession: () => mockUseBackendSession(),
}))

vi.mock('@/components/dashboard/PublishButton', () => ({
  PublishButton: () => <button type="button">Publish</button>,
}))

vi.mock('@/components/subject-confirmation-dialog', () => ({
  SubjectConfirmationDialog: () => null,
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

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    account: { displayName: 'Test User' },
    wallet: { did: `did:pkh:eip155:66238:${WALLET_ADDRESS}` },
    primarySubject: null,
    ...overrides,
  }
}

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
    // Use a non-service schema so the derived serviceDids stays empty and the
    // heavy ServiceTrustWorkspace subtree is not rendered in these table tests.
    schemaId: 'user-review',
    schemaTitle: 'Linked Identifier',
    decodedData: { subject: 'did:web:example.com' },
    ...overrides,
  } as EnrichedAttestationResult
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
    // Default: signed in with a valid backend session.
    mockUseBackendSession.mockReturnValue({
      session: makeSession(),
      isSessionLoading: false,
      openAuthDialog: vi.fn(),
    })
    mockGetChainById.mockReturnValue({
      id: 66238,
      name: 'OMAChain Testnet',
      blockExplorers: [{ name: 'Explorer', url: 'https://explorer.testnet.chain.oma3.org' }],
    })
    mockGetContractAddress.mockReturnValue('0x' + 'e'.repeat(40))
  })

  // ── Signed-out state ────────────────────────────────────────────────

  it('renders sign-in prompt when there is no session', () => {
    mockUseBackendSession.mockReturnValue({
      session: null,
      isSessionLoading: false,
      openAuthDialog: vi.fn(),
    })
    render(<DashboardPage />)
    expect(screen.getByText(/sign in to manage keys/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('opens the auth dialog when Sign In is clicked', () => {
    const openAuthDialog = vi.fn()
    mockUseBackendSession.mockReturnValue({
      session: null,
      isSessionLoading: false,
      openAuthDialog,
    })
    render(<DashboardPage />)
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(openAuthDialog).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'chooser', redirectTo: '/dashboard' })
    )
  })

  it('shows a session-loading state while the session is resolving', () => {
    mockUseBackendSession.mockReturnValue({
      session: null,
      isSessionLoading: true,
      openAuthDialog: vi.fn(),
    })
    render(<DashboardPage />)
    expect(screen.getByText(/checking your session/i)).toBeInTheDocument()
  })

  it('does not call getAttestations when wallet is disconnected', async () => {
    // Signed in, but wallet not connected -> no on-chain query.
    render(<DashboardPage />)
    await waitFor(() => {
      expect(screen.getByText('Account')).toBeInTheDocument()
    })
    expect(mockGetAttestationsByAttesterWithMetadata).not.toHaveBeenCalled()
  })

  // ── Account section ─────────────────────────────────────────────────

  it('renders the account section with display name', () => {
    render(<DashboardPage />)
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  // ── Connected state – table rendering ───────────────────────────────

  it('renders attestation table headings when connected with attestations', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([makeAttestation()])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(mockGetAttestationsByAttesterWithMetadata).toHaveBeenCalled()
    })

    expect(await screen.findByText('My Attestations')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Schema' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Service' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Rating' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Action' })).toBeInTheDocument()
  })

  it('calls getAttestationsByAttesterWithMetadata with connected wallet address', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(mockGetAttestationsByAttesterWithMetadata).toHaveBeenCalledWith(WALLET_ADDRESS, 66238, 100)
    })
  })

  it('does not render the My Attestations table when there are no attestations', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(mockGetAttestationsByAttesterWithMetadata).toHaveBeenCalled()
    })

    expect(screen.queryByText('My Attestations')).not.toBeInTheDocument()
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

  it('displays "Unknown schema" when schemaTitle and schemaId are missing', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({ schemaTitle: undefined, schemaId: undefined }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Unknown schema')).toBeInTheDocument()
    })
  })

  it('uses decodedData.subject as the service label when available', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({ decodedData: { subject: 'did:web:example.com' } }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('did:web:example.com')).toBeInTheDocument()
    })
  })

  it('falls back to recipient address when decodedData.subject is absent', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({ decodedData: undefined, recipient: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')).toBeInTheDocument()
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
      expect(screen.getByText('Linked Identifier')).toBeInTheDocument()
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
      expect(screen.getByText('Linked Identifier')).toBeInTheDocument()
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

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Revoke Attestation')).toBeInTheDocument()
    expect(within(dialog).getByText(/this will permanently revoke attestation/i)).toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

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

  // ── Refresh button ──────────────────────────────────────────────────

  it('disables the Refresh button while attestations are loading', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockImplementation(() => new Promise(() => {}))

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled()
    })
  })

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

    // Only the first attestation (revocable + active + matching attester) gets a Revoke button.
    expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(1)

    expect(screen.getAllByText('Active')).toHaveLength(2)
    expect(screen.getByText('Revoked')).toBeInTheDocument()
  })

  // ── Revoke execution flow ───────────────────────────────────────────

  it('calls revokeAttestation and refreshes list on successful revocation', async () => {
    setupConnected()
    mockRevokeAttestation.mockResolvedValue(undefined)
    mockGetAttestationsByAttesterWithMetadata
      .mockResolvedValueOnce([makeAttestation({ revocable: true, revocationTime: 0, attester: WALLET_ADDRESS })])
      .mockResolvedValueOnce([makeAttestation({ revocable: true, revocationTime: 1700000000, attester: WALLET_ADDRESS })])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    await waitFor(() => {
      expect(mockRevokeAttestation).toHaveBeenCalledTimes(1)
    })

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

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }))

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
      } as Partial<EnrichedAttestationResult>),
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
      makeAttestation({ txHash: undefined } as Partial<EnrichedAttestationResult>),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Linked Identifier')).toBeInTheDocument()
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

  // ── ServiceTrustWorkspace ───────────────────────────────────────────
  // Previously, the heavy ServiceTrustWorkspace subtree was avoided in tests
  // because the controller-confirm mock lacked the `warnings: []` array,
  // crashing with "summary.warnings is not iterable". That was a mock-shape
  // issue (not a source bug); with schema-accurate mocks it renders cleanly.

  it('renders the ServiceTrustWorkspace when the user has a service subject', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({
        schemaId: 'linked-identifier',
        schemaTitle: 'Linked Identifier',
        decodedData: { subject: 'did:web:example.com' },
      }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Service Management')).toBeInTheDocument()
    })
    expect(screen.getByText('Key Authorizations')).toBeInTheDocument()
    expect(screen.getByText('Linked Identifiers')).toBeInTheDocument()
  })

  it('does not render the ServiceTrustWorkspace without a service subject', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({ schemaId: 'user-review' }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Account')).toBeInTheDocument()
    })
    expect(screen.queryByText('Service Management')).not.toBeInTheDocument()
  })
})
