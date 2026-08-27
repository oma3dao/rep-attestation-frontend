import React from 'react'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardPage from '@/app/dashboard/page'
import type { EnrichedAttestationResult } from '@/lib/attestation-queries'

const mockUseWallet = vi.fn()
const mockUseActiveAccount = vi.fn()
const mockGetAttestationsByAttesterWithMetadata = vi.fn()
const mockGetAllAttestationsForDIDWithMetadata = vi.fn()
const mockRevokeAttestation = vi.fn()
const mockUseBackendSession = vi.fn()
const mockListSigningKeys = vi.fn()
const mockUpsertSigningKey = vi.fn()
const mockGetControllerConfirmation = vi.fn()
const mockCallControllerWitness = vi.fn()

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: unknown; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>{children}</a>
  ),
}))

const mockUseSearchParams = vi.fn(() => new URLSearchParams())
const mockNormalizeDid = vi.fn((d: string) => d)
const mockToEthers = vi.fn().mockResolvedValue({ provider: {} })

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockUseSearchParams(),
}))

vi.mock('thirdweb/react', () => ({
  useActiveAccount: () => mockUseActiveAccount(),
}))

vi.mock('thirdweb/adapters/ethers6', () => ({
  ethers6Adapter: {
    signer: {
      toEthers: (...args: unknown[]) => mockToEthers(...args),
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
  getAllAttestationsForDIDWithMetadata: (...args: unknown[]) => mockGetAllAttestationsForDIDWithMetadata(...args),
}))

vi.mock('@oma3/omatrust/reputation', () => ({
  revokeAttestation: (...args: unknown[]) => mockRevokeAttestation(...args),
}))

vi.mock('@oma3/omatrust/identity', () => ({
  normalizeDid: (d: string) => mockNormalizeDid(d),
  isSameControllerId: (a: string, b: string) => a === b,
}))

vi.mock('@/lib/omatrust-backend', () => ({
  // Schema-accurate ControllerConfirmResponse shape (notably `warnings: []`,
  // which ServiceTrustWorkspace iterates over).
  getControllerConfirmation: (...args: unknown[]) => mockGetControllerConfirmation(...args),
  resolvePublicIdentities: (...args: unknown[]) => mockResolvePublicIdentities(...args),
  getPublicTrustAnchors: (...args: unknown[]) => mockGetPublicTrustAnchors(...args),
  listSubjects: (...args: unknown[]) => mockListSubjects(...args),
  listSigningKeys: (...args: unknown[]) => mockListSigningKeys(...args),
  upsertSigningKey: (...args: unknown[]) => mockUpsertSigningKey(...args),
}))

vi.mock('@/components/public-key-input', () => ({
  PublicKeyInput: ({
    value,
    onChange,
    label = 'Public key',
  }: {
    value?: string
    onChange: (v: string | null) => void
    label?: string
  }) => (
    <div data-testid="public-key-input">
      <label htmlFor="mock-public-key">{label}</label>
      <input
        id="mock-public-key"
        aria-label={label}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </div>
  ),
}))

vi.mock('@/components/did-pkh-input', () => ({
  DidPkhInput: ({
    value,
    onChange,
  }: {
    value?: string
    onChange: (v: string | null) => void
  }) => (
    <div data-testid="did-pkh-input">
      <input
        aria-label="did:pkh"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </div>
  ),
}))

vi.mock('@/lib/controller-witness-client', () => ({
  callControllerWitness: (...args: unknown[]) => mockCallControllerWitness(...args),
}))

vi.mock('@/components/backend-session-provider', () => ({
  useBackendSession: () => mockUseBackendSession(),
}))

vi.mock('@/components/dashboard/PublishButton', () => ({
  PublishButton: () => <button type="button">Publish</button>,
}))

const subjectDialogMock = vi.hoisted(() => ({
  lastProps: null as null | Record<string, unknown>,
  lastOpenProps: null as null | Record<string, unknown>,
}))

vi.mock('@/components/subject-confirmation-dialog', () => ({
  SubjectConfirmationDialog: (props: {
    open: boolean
    onOpenChange?: (open: boolean) => void
    initialSubjectDid?: string | null
    walletDid?: string | null
    existingSubjectDids?: string[]
  }) => {
    subjectDialogMock.lastProps = props as Record<string, unknown>
    if (props.open) {
      subjectDialogMock.lastOpenProps = props as Record<string, unknown>
    }
    if (!props.open) return null
    return (
      <div data-testid="subject-confirmation-dialog-stub">
        Subject dialog open
        {props.initialSubjectDid ? (
          <span data-testid="stub-initial-subject">{props.initialSubjectDid}</span>
        ) : null}
      </div>
    )
  },
}))

const mockListSubjects = vi.fn()
const mockGetPublicTrustAnchors = vi.fn()
const mockResolvePublicIdentities = vi.fn()

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
const KEY_DID = 'did:jwk:eyJrdHkiOiJPS1AifQ'
const ACCOUNT_CONTROLLER_DID = 'did:jwk:eyJrdHkiOiJFQyJ9'
const SERVICE_DID = 'did:web:example.com'
const ACCOUNT_WALLET_DID = `did:pkh:eip155:66238:${WALLET_ADDRESS}`
const REVIEW_UID = '0x' + 'a'.repeat(64)
const APPROVED_ISSUER = '0x3333333333333333333333333333333333333333'

function makeControllerConfirmation(overrides: Record<string, unknown> = {}) {
  return {
    subject: { input: SERVICE_DID, canonical: SERVICE_DID, label: 'example.com', type: 'web', source: 'input' },
    domain: 'example.com',
    controllerKeys: [],
    evidence: [],
    approvedIssuer: { status: 'not-configured', checkedIdentifiers: [], registryUrl: null },
    warnings: [],
    ...overrides,
  }
}

function makeRegisteredSigningKey(overrides: Record<string, unknown> = {}) {
  return {
    id: 'k1',
    accountId: 'a1',
    keyDid: KEY_DID,
    keyType: 'service-signing',
    displayName: 'Prod signer',
    tags: ['x402'],
    notes: 'AWS KMS',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function setupServiceTrustWorkspace(overrides: {
  attesterAttestations?: EnrichedAttestationResult[]
  serviceAttestations?: EnrichedAttestationResult[]
  trustAnchors?: Record<string, unknown>
} = {}) {
  setupConnected()
  mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
    makeAttestation({
      schemaId: 'linked-identifier',
      decodedData: { subject: SERVICE_DID },
    }),
    ...(overrides.attesterAttestations ?? []),
  ])
  mockGetAllAttestationsForDIDWithMetadata.mockResolvedValue(overrides.serviceAttestations ?? [])
  mockGetPublicTrustAnchors.mockResolvedValue(
    overrides.trustAnchors ?? {
      version: 1,
      updatedAt: '2024-01-01T00:00:00.000Z',
      widgetOrigins: [],
      chains: {},
      registries: [],
    }
  )
  mockResolvePublicIdentities.mockResolvedValue({ identities: [] })
}

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
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
    mockNormalizeDid.mockImplementation((d: string) => d)
    mockToEthers.mockResolvedValue({ provider: {} })
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
    mockListSigningKeys.mockResolvedValue({ keys: [] })
    mockGetControllerConfirmation.mockResolvedValue(makeControllerConfirmation())
    mockGetAllAttestationsForDIDWithMetadata.mockResolvedValue([])
    mockGetPublicTrustAnchors.mockResolvedValue({
      version: 1,
      updatedAt: '2024-01-01T00:00:00.000Z',
      widgetOrigins: [],
      chains: {},
      registries: [],
    })
    mockResolvePublicIdentities.mockResolvedValue({ identities: [] })
    mockListSubjects.mockResolvedValue({ subjects: [] })
    subjectDialogMock.lastProps = null
    subjectDialogMock.lastOpenProps = null
    mockCallControllerWitness.mockResolvedValue({ uid: '0x' + 'w'.repeat(64) })
    mockUpsertSigningKey.mockResolvedValue({
      id: 'k1',
      accountId: 'a1',
      keyDid: 'did:jwk:eyJrdHkiOiJPS1AifQ',
      keyType: 'service-signing',
      displayName: 'Prod signer',
      tags: ['x402'],
      notes: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      created: true,
    })
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

    // App currently surfaces a placeholder until SDK revocation is fully wired.
    await waitFor(() => {
      expect(screen.getByText('Attestation revocation is not available yet.')).toBeInTheDocument()
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
    expect(screen.getByText('External Key Authorizations')).toBeInTheDocument()
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

  it('shows the empty signing-keys state and opens the register dialog', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({
        schemaId: 'linked-identifier',
        decodedData: { subject: 'did:web:example.com' },
      }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText(/No signing keys registered yet/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '+ Add Signing Key' }))

    expect(await screen.findByText('Register a Service Signing Key')).toBeInTheDocument()
    expect(screen.getByText(/OMATrust will not ask for your private key/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/private key/i)).not.toBeInTheDocument()
  })

  it('registers a signing key through the dialog and refreshes the list', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({
        schemaId: 'linked-identifier',
        decodedData: { subject: 'did:web:example.com' },
      }),
    ])
    mockListSigningKeys
      .mockResolvedValueOnce({ keys: [] })
      .mockResolvedValueOnce({
        keys: [
          {
            id: 'k1',
            accountId: 'a1',
            keyDid: 'did:jwk:eyJrdHkiOiJPS1AifQ',
            keyType: 'service-signing',
            displayName: 'Prod signer',
            tags: ['x402'],
            notes: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '+ Add Signing Key' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '+ Add Signing Key' }))
    await screen.findByText('Register a Service Signing Key')

    fireEvent.click(screen.getByRole('button', { name: 'x402 Offers & Receipts' }))
    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Prod signer' },
    })
    fireEvent.change(screen.getByLabelText('Public key'), {
      target: { value: 'did:jwk:eyJrdHkiOiJPS1AifQ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Register key' }))

    await waitFor(() => {
      expect(mockUpsertSigningKey).toHaveBeenCalledWith({
        keyDid: 'did:jwk:eyJrdHkiOiJPS1AifQ',
        keyType: 'service-signing',
        displayName: 'Prod signer',
        tags: ['x402'],
        notes: null,
      })
    })

    await waitFor(() => {
      expect(mockListSigningKeys).toHaveBeenCalledTimes(2)
    })
  })

  it('renders registered signing-key cards for each service subject', async () => {
    setupConnected()
    mockListSigningKeys.mockResolvedValue({
      keys: [
        {
          id: 'k1',
          accountId: 'a1',
          keyDid: 'did:jwk:eyJrdHkiOiJPS1AifQ',
          keyType: 'service-signing',
          displayName: 'Prod signer',
          tags: ['x402'],
          notes: 'AWS KMS',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({
        schemaId: 'linked-identifier',
        decodedData: { subject: 'did:web:example.com' },
      }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Prod signer')).toBeInTheDocument()
    })
    expect(screen.getByText('x402 Offers & Receipts')).toBeInTheDocument()
    expect(screen.getByText('AWS KMS')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  // ── Signing-key authorization signals ───────────────────────────────

  it('shows Not authorized when a signing key has no basic or intermediate signals', async () => {
    setupServiceTrustWorkspace()
    mockListSigningKeys.mockResolvedValue({ keys: [makeRegisteredSigningKey()] })
    mockGetControllerConfirmation.mockResolvedValue(makeControllerConfirmation())

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Prod signer')).toBeInTheDocument()
    })

    const externalSection = screen.getByText('External Key Authorizations').closest('section')
    expect(externalSection).toBeTruthy()
    expect(within(externalSection!).getByText('Not authorized')).toBeInTheDocument()
  })

  it('shows Basic, Intermediate, and Advanced signals when fully authorized', async () => {
    setupServiceTrustWorkspace()
    mockListSigningKeys.mockResolvedValue({ keys: [makeRegisteredSigningKey()] })
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        controllerKeys: [{ canonicalId: KEY_DID, label: 'Prod', sources: ['dns-txt'], basic: true }],
      })
    )
    mockGetAllAttestationsForDIDWithMetadata.mockResolvedValue([
      makeAttestation({
        schemaId: 'controller-witness',
        uid: '0x' + 'w'.repeat(64),
        decodedData: { controller: KEY_DID, subject: SERVICE_DID },
      }),
      makeAttestation({
        schemaId: 'key-binding',
        uid: '0x' + 'k'.repeat(64),
        decodedData: { keyId: KEY_DID, subject: SERVICE_DID },
      }),
    ])

    render(<DashboardPage />)

    const externalSection = () => screen.getByText('External Key Authorizations').closest('section')!

    await waitFor(() => {
      expect(within(externalSection()).getByText('Basic: Yes')).toBeInTheDocument()
    })
    expect(within(externalSection()).getByText('Intermediate: Yes')).toBeInTheDocument()
    expect(within(externalSection()).getByText('Advanced: Yes')).toBeInTheDocument()
  })

  it('submits a controller witness when basic ownership is proven but no witness exists', async () => {
    setupServiceTrustWorkspace()
    mockListSigningKeys.mockResolvedValue({ keys: [makeRegisteredSigningKey()] })
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        controllerKeys: [{ canonicalId: KEY_DID, label: 'Prod', sources: ['dns-txt'], basic: true }],
      })
    )
    mockGetAllAttestationsForDIDWithMetadata.mockResolvedValue([])

    render(<DashboardPage />)

    const externalSection = () => screen.getByText('External Key Authorizations').closest('section')!

    await waitFor(() => {
      expect(within(externalSection()).getByRole('button', { name: 'Add controller witness' })).toBeInTheDocument()
    })

    fireEvent.click(within(externalSection()).getByRole('button', { name: 'Add controller witness' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(mockCallControllerWitness).toHaveBeenCalledWith({
        subject: SERVICE_DID,
        controller: KEY_DID,
      })
    })
  })

  it('edits a registered signing key and saves metadata changes', async () => {
    setupServiceTrustWorkspace()
    mockListSigningKeys.mockResolvedValue({ keys: [makeRegisteredSigningKey()] })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    expect(await screen.findByText('Edit Signing Key')).toBeInTheDocument()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Key identifier (immutable):')).toBeInTheDocument()
    expect(within(dialog).getByText(KEY_DID)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Staging signer' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(mockUpsertSigningKey).toHaveBeenCalledWith({
        keyDid: KEY_DID,
        keyType: 'service-signing',
        displayName: 'Staging signer',
        tags: ['x402'],
        notes: 'AWS KMS',
      })
    })

    await waitFor(() => {
      expect(screen.queryByText('Edit Signing Key')).not.toBeInTheDocument()
    })
  })

  it('filters registered signing keys out of Account Key Authorizations', async () => {
    setupServiceTrustWorkspace()
    mockListSigningKeys.mockResolvedValue({ keys: [makeRegisteredSigningKey()] })
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        controllerKeys: [{ canonicalId: KEY_DID, label: 'Prod', sources: ['dns-txt'], basic: true }],
      })
    )

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Account Key Authorizations')).toBeInTheDocument()
    })

    const accountSection = screen.getByText('Account Key Authorizations').closest('section')
    expect(accountSection).toBeTruthy()
    expect(within(accountSection!).queryByText(KEY_DID)).not.toBeInTheDocument()
    expect(within(accountSection!).getByText(ACCOUNT_WALLET_DID)).toBeInTheDocument()
  })

  // ── Controller witness error handling ───────────────────────────────

  async function submitControllerWitnessFromAccountSection() {
    const accountSection = () => screen.getByText('Account Key Authorizations').closest('section')!

    await waitFor(() => {
      expect(within(accountSection()).getAllByRole('button', { name: 'Add controller witness' }).length).toBeGreaterThan(0)
    })

    fireEvent.click(within(accountSection()).getAllByRole('button', { name: 'Add controller witness' })[0]!)
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
  }

  function setupAccountKeyWitnessFlow() {
    setupServiceTrustWorkspace()
    mockListSigningKeys.mockResolvedValue({ keys: [makeRegisteredSigningKey()] })
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        controllerKeys: [
          { canonicalId: ACCOUNT_CONTROLLER_DID, label: 'Account ctrl', sources: ['dns-txt'], basic: true },
        ],
      })
    )
    mockGetAllAttestationsForDIDWithMetadata.mockResolvedValue([])
  }

  it('shows endpoint evidence error when controller witness API returns null (Account Key Authorizations)', async () => {
    setupAccountKeyWitnessFlow()
    mockCallControllerWitness.mockResolvedValue(null)

    render(<DashboardPage />)
    await submitControllerWitnessFromAccountSection()

    await waitFor(() => {
      expect(screen.getByText(/could not confirm endpoint evidence/i)).toBeInTheDocument()
    })
  })

  it('shows witness error message when controller witness API throws (SigningKeyCard path)', async () => {
    setupServiceTrustWorkspace()
    mockListSigningKeys.mockResolvedValue({ keys: [makeRegisteredSigningKey()] })
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        controllerKeys: [{ canonicalId: KEY_DID, label: 'Prod', sources: ['dns-txt'], basic: true }],
      })
    )
    mockGetAllAttestationsForDIDWithMetadata.mockResolvedValue([])
    mockCallControllerWitness.mockRejectedValue(new Error('Witness API unavailable'))

    render(<DashboardPage />)

    const externalSection = () => screen.getByText('External Key Authorizations').closest('section')!

    await waitFor(() => {
      expect(within(externalSection()).getByRole('button', { name: 'Add controller witness' })).toBeInTheDocument()
    })

    fireEvent.click(within(externalSection()).getByRole('button', { name: 'Add controller witness' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(screen.getByText('Witness API unavailable')).toBeInTheDocument()
    })
  })

  // ── Issuer Tools ────────────────────────────────────────────────────

  it('shows Issuer Tools with publish links when user has a security-assessment attestation', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({
        schemaId: 'security-assessment',
        schemaTitle: 'Security Assessment',
        decodedData: { subject: SERVICE_DID },
      }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Issuer Tools')).toBeInTheDocument()
    })
    expect(screen.getByText('Publish a security assessment')).toBeInTheDocument()
    expect(screen.getByText('Issue a certification')).toBeInTheDocument()

    const openLinks = screen.getAllByRole('link', { name: 'Open' })
    expect(openLinks.some((link) => link.getAttribute('href') === '/publish/security-assessment')).toBe(true)
    expect(openLinks.some((link) => link.getAttribute('href') === '/publish/certification')).toBe(true)
  })

  it('shows Issuer Tools when user has a certification attestation', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({
        schemaId: 'certification',
        schemaTitle: 'Certification',
        decodedData: { subject: SERVICE_DID },
      }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Issuer Tools')).toBeInTheDocument()
    })
    expect(screen.getAllByRole('link', { name: 'Open' }).some(
      (link) => link.getAttribute('href') === '/publish/certification'
    )).toBe(true)
  })

  // ── Signing key upsert failure ──────────────────────────────────────

  it('shows upsert error and keeps the dialog open when saving a signing key fails', async () => {
    setupServiceTrustWorkspace()
    mockUpsertSigningKey.mockRejectedValue(new Error('Failed to save signing key.'))

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '+ Add Signing Key' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '+ Add Signing Key' }))
    await screen.findByText('Register a Service Signing Key')

    fireEvent.click(screen.getByRole('button', { name: 'x402 Offers & Receipts' }))
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Prod signer' } })
    fireEvent.change(screen.getByLabelText('Public key'), {
      target: { value: KEY_DID },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Register key' }))

    await waitFor(() => {
      expect(screen.getByText('Failed to save signing key.')).toBeInTheDocument()
    })
    expect(screen.getByText('Register a Service Signing Key')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  // ── Publish key binding CTA ─────────────────────────────────────────

  it('shows Publish key binding link when intermediate is yes and no key-binding exists', async () => {
    setupServiceTrustWorkspace()
    mockListSigningKeys.mockResolvedValue({ keys: [makeRegisteredSigningKey()] })
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        controllerKeys: [{ canonicalId: KEY_DID, label: 'Prod', sources: ['dns-txt'], basic: true }],
      })
    )
    mockGetAllAttestationsForDIDWithMetadata.mockResolvedValue([
      makeAttestation({
        schemaId: 'controller-witness',
        uid: '0x' + 'w'.repeat(64),
        decodedData: { controller: KEY_DID, subject: SERVICE_DID },
      }),
    ])

    render(<DashboardPage />)

    const externalSection = () => screen.getByText('External Key Authorizations').closest('section')!

    await waitFor(() => {
      expect(within(externalSection()).getByText('Intermediate: Yes')).toBeInTheDocument()
    })

    const publishLink = within(externalSection()).getByRole('link', { name: 'Publish key binding' })
    expect(publishLink).toHaveAttribute(
      'href',
      `/publish/key-binding?subject=${encodeURIComponent(SERVICE_DID)}&keyId=${encodeURIComponent(KEY_DID)}`
    )
  })

  // ── Service reviews ─────────────────────────────────────────────────

  it('shows unanswered service review with Respond link including refUID and subject', async () => {
    setupServiceTrustWorkspace({
      serviceAttestations: [
        makeAttestation({
          uid: REVIEW_UID,
          schemaId: 'user-review',
          schemaTitle: 'User Review',
          attester: OTHER_ADDRESS,
          decodedData: { subject: SERVICE_DID, reviewBody: 'Needs improvement', ratingValue: 2 },
        }),
      ],
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Reviews of My Services')).toBeInTheDocument()
      expect(screen.getByText('Needs improvement')).toBeInTheDocument()
    })

    const respondLink = await screen.findByRole('link', { name: 'Respond' })
    expect(respondLink).toHaveAttribute(
      'href',
      `/publish/user-review-response?refUID=${encodeURIComponent(REVIEW_UID)}&subject=${encodeURIComponent(SERVICE_DID)}`
    )
    expect(screen.queryByText('Responded')).not.toBeInTheDocument()
  })

  it('shows Responded badge without Respond button for answered reviews', async () => {
    setupServiceTrustWorkspace({
      attesterAttestations: [
        makeAttestation({
          uid: '0x' + 's'.repeat(64),
          schemaId: 'user-review-response',
          decodedData: { refUID: REVIEW_UID, subject: SERVICE_DID },
        }),
      ],
      serviceAttestations: [
        makeAttestation({
          uid: REVIEW_UID,
          schemaId: 'user-review',
          schemaTitle: 'User Review',
          attester: OTHER_ADDRESS,
          decodedData: { subject: SERVICE_DID, reviewBody: 'Already handled', ratingValue: 4 },
        }),
      ],
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Responded')).toBeInTheDocument()
    })
    expect(screen.queryByRole('link', { name: 'Respond' })).not.toBeInTheDocument()
  })

  // ── Trusted attestations ────────────────────────────────────────────

  it('renders trusted attestation cards from approved issuers instead of empty state', async () => {
    setupServiceTrustWorkspace({
      trustAnchors: {
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        widgetOrigins: [],
        chains: {},
        registries: [
          {
            type: 'approved-issuers',
            issuers: [
              {
                address: APPROVED_ISSUER,
                label: 'Trusted auditor',
                schemas: ['certification'],
                status: 'active',
                validFrom: '',
              },
            ],
          },
        ],
      },
      serviceAttestations: [
        makeAttestation({
          uid: '0x' + 't'.repeat(64),
          schemaId: 'certification',
          schemaTitle: 'Certification',
          attester: APPROVED_ISSUER,
          decodedData: { subject: SERVICE_DID },
        }),
      ],
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Trusted Attestations of My Services')).toBeInTheDocument()
      expect(screen.getByText('Certification')).toBeInTheDocument()
    })
    expect(screen.queryByText(/No trusted attestations found/i)).not.toBeInTheDocument()
  })

  it('shows controller warnings from controller confirmation summaries', async () => {
    setupServiceTrustWorkspace()
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        warnings: ['DNS TXT record not found for _controllers.example.com'],
      })
    )

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('DNS TXT record not found for _controllers.example.com')).toBeInTheDocument()
    })
  })

  it('shows Authorize-this-key DNS guidance for a signing key without basic ownership', async () => {
    setupServiceTrustWorkspace()
    mockListSigningKeys.mockResolvedValue({ keys: [makeRegisteredSigningKey()] })
    mockGetControllerConfirmation.mockResolvedValue(makeControllerConfirmation())

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Authorize this key')).toBeInTheDocument()
    })
    expect(screen.getByText(/Add a DNS TXT record or host a did\.json/i)).toBeInTheDocument()
    expect(screen.getByText(/_controllers\.example\.com/i)).toBeInTheDocument()
  })

  it('shows registered service DIDs from listSubjects and opens the subject dialog stub', async () => {
    mockListSubjects.mockResolvedValue({
      subjects: [
        {
          id: 'sub-1',
          canonicalDid: 'did:web:service.example.com',
          displayName: 'Service Example',
          isDefault: false,
        },
      ],
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(mockListSubjects).toHaveBeenCalled()
    })

    const accountCard = screen.getByText('Account').closest('[class*="mb-6"]')
    expect(accountCard).toBeTruthy()
    expect(within(accountCard!).getByText('did:web:service.example.com')).toBeInTheDocument()
    expect(within(accountCard!).getByText('Service Example')).toBeInTheDocument()

    fireEvent.click(within(accountCard!).getByRole('button', { name: '+ Add Service ID' }))

    await waitFor(() => {
      expect(screen.getByTestId('subject-confirmation-dialog-stub')).toBeInTheDocument()
    })
    expect(subjectDialogMock.lastOpenProps?.open).toBe(true)
    expect(subjectDialogMock.lastOpenProps?.walletDid).toBe(ACCOUNT_WALLET_DID)
  })

  it('registers a signing key via the did:pkh path', async () => {
    const pkhDid = `did:pkh:eip155:66238:${OTHER_ADDRESS}`
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({
        schemaId: 'linked-identifier',
        decodedData: { subject: SERVICE_DID },
      }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '+ Add Signing Key' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '+ Add Signing Key' }))
    await screen.findByText('Register a Service Signing Key')

    fireEvent.click(screen.getByRole('button', { name: 'Blockchain wallet (did:pkh)' }))
    fireEvent.change(screen.getByLabelText('did:pkh'), { target: { value: pkhDid } })
    fireEvent.click(screen.getByRole('button', { name: 'x402 Offers & Receipts' }))
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Wallet signer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Register key' }))

    await waitFor(() => {
      expect(mockUpsertSigningKey).toHaveBeenCalledWith({
        keyDid: pkhDid,
        keyType: 'service-signing',
        displayName: 'Wallet signer',
        tags: ['x402'],
        notes: null,
      })
    })
  })

  it('disables issuer mailto when all schema toggles are unchecked', async () => {
    setupServiceTrustWorkspace({
      attesterAttestations: [
        makeAttestation({
          schemaId: 'security-assessment',
          decodedData: { subject: SERVICE_DID },
        }),
      ],
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Request approved issuer status')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Request' }))

    const securityAudit = screen.getByRole('checkbox', { name: /security audit/i })
    const certification = screen.getByRole('checkbox', { name: /certification/i })
    fireEvent.click(securityAudit)
    fireEvent.click(certification)

    expect(securityAudit).not.toBeChecked()
    expect(certification).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Open email request' })).toBeDisabled()

    fireEvent.click(securityAudit)
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'issuer@example.com' } })
    expect(screen.getByRole('button', { name: 'Open email request' })).toBeEnabled()
  })

  it('opens the subject dialog from ServiceKeyCard when the subject is not registered', async () => {
    const unattachedDid = 'did:web:unattached.example.com'
    setupServiceTrustWorkspace()
    mockListSubjects.mockResolvedValue({ subjects: [] })
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({
        schemaId: 'linked-identifier',
        decodedData: { subject: SERVICE_DID },
      }),
      makeAttestation({
        schemaId: 'key-binding',
        uid: '0x' + 'u'.repeat(64),
        decodedData: { keyId: KEY_DID, subject: unattachedDid },
      }),
    ])
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        subject: { input: unattachedDid, canonical: unattachedDid, label: 'unattached.example.com', type: 'web', source: 'input' },
        domain: 'unattached.example.com',
        controllerKeys: [{ canonicalId: KEY_DID, label: 'Prod', sources: ['dns-txt'], basic: true }],
      })
    )

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Add subject to account' }).length).toBeGreaterThan(0)
    })

    const accountSection = screen.getByText('Account Key Authorizations').closest('section')
    expect(accountSection).toBeTruthy()
    const addButton = within(accountSection!)
      .getAllByRole('button', { name: 'Add subject to account' })
      .find((button) => button.closest('.rounded-xl')?.textContent?.includes(unattachedDid))
    expect(addButton).toBeTruthy()
    fireEvent.click(addButton!)

    await waitFor(() => {
      expect(screen.getByTestId('subject-confirmation-dialog-stub')).toBeInTheDocument()
    })
    expect(subjectDialogMock.lastOpenProps?.initialSubjectDid).toBe(unattachedDid)
    expect(subjectDialogMock.lastOpenProps?.open).toBe(true)
  })

  it('opens and closes the trusted attestation detail modal', async () => {
    setupServiceTrustWorkspace({
      trustAnchors: {
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        widgetOrigins: [],
        chains: {},
        registries: [
          {
            type: 'approved-issuers',
            issuers: [
              {
                address: APPROVED_ISSUER,
                label: 'Trusted auditor',
                schemas: ['certification'],
                status: 'active',
                validFrom: '',
              },
            ],
          },
        ],
      },
      serviceAttestations: [
        makeAttestation({
          uid: '0x' + 't'.repeat(64),
          schemaId: 'certification',
          schemaTitle: 'Certification',
          attester: APPROVED_ISSUER,
          decodedData: { subject: SERVICE_DID },
        }),
      ],
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Trusted Attestations of My Services')).toBeInTheDocument()
      expect(screen.getByText('Certification')).toBeInTheDocument()
    })

    const trustedSection = screen.getByText('Trusted Attestations of My Services').closest('section')
      ?? screen.getByText('Trusted Attestations of My Services').parentElement
    expect(trustedSection).toBeTruthy()
    fireEvent.click(within(trustedSection as HTMLElement).getByText('Certification'))

    await waitFor(() => {
      expect(screen.getByText('Attestation UID:')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    await waitFor(() => {
      expect(screen.queryByText('Attestation UID:')).not.toBeInTheDocument()
    })
  })

  it('shows the empty Account Key Authorizations message when all keys are signing keys', async () => {
    setupServiceTrustWorkspace()
    mockListSigningKeys.mockResolvedValue({
      keys: [
        makeRegisteredSigningKey(),
        makeRegisteredSigningKey({
          id: 'k2',
          keyDid: ACCOUNT_WALLET_DID,
          displayName: 'Account wallet signer',
        }),
      ],
    })
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        controllerKeys: [{ canonicalId: KEY_DID, label: 'Prod', sources: ['dns-txt'], basic: true }],
      })
    )
    mockGetAllAttestationsForDIDWithMetadata.mockResolvedValue([
      makeAttestation({
        schemaId: 'key-binding',
        uid: '0x' + 'k'.repeat(64),
        decodedData: { keyId: KEY_DID, subject: SERVICE_DID },
      }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Account Key Authorizations')).toBeInTheDocument()
    })

    const accountSection = screen.getByText('Account Key Authorizations').closest('section')
    expect(accountSection).toBeTruthy()
    expect(
      within(accountSection!).getByText(/No key authorizations found yet/i)
    ).toBeInTheDocument()
  })

  it('opens approved issuer mailto request when issuer UI is reachable', async () => {
    const hrefSetter = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href() {
          return 'http://localhost/'
        },
        set href(value: string) {
          hrefSetter(value)
        },
        host: 'localhost',
        origin: 'http://localhost',
      },
    })

    setupServiceTrustWorkspace({
      attesterAttestations: [
        makeAttestation({
          uid: '0x' + 'b'.repeat(64),
          schemaId: 'security-assessment',
          schemaTitle: 'Security Assessment',
          decodedData: { subject: SERVICE_DID },
        }),
      ],
    })
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        approvedIssuer: { status: 'not-configured', checkedIdentifiers: [], registryUrl: null },
      })
    )

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Request approved issuer status')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Request' }))
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'issuer@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open email request' }))

    await waitFor(() => {
      expect(hrefSetter).toHaveBeenCalled()
    })
    const mailtoHref = hrefSetter.mock.calls[0]![0] as string
    expect(mailtoHref).toMatch(/^mailto:authorizations@oma3\.org\?/)
    expect(mailtoHref).toContain(encodeURIComponent('OMA3 authorized issuer request'))
    expect(mailtoHref).toContain(encodeURIComponent('issuer@example.com'))
  })

  it('shows empty reviews copy when the service has no user reviews', async () => {
    setupServiceTrustWorkspace({ serviceAttestations: [] })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(
        screen.getByText('No OMATrust user reviews found for your services yet.')
      ).toBeInTheDocument()
    })
  })

  it('renders issuer credential table cells using resolvePublicIdentities labels', async () => {
    setupServiceTrustWorkspace({
      attesterAttestations: [
        makeAttestation({
          uid: '0x' + 'c'.repeat(64),
          schemaId: 'certification',
          schemaTitle: 'Certification',
          attester: APPROVED_ISSUER,
          decodedData: { subject: SERVICE_DID },
        }),
      ],
    })
    mockResolvePublicIdentities.mockResolvedValue({
      identities: [
        {
          canonical: APPROVED_ISSUER,
          label: 'Trusted auditor',
          type: 'evm-address',
        },
        {
          canonical: SERVICE_DID,
          label: 'Example Service',
          type: 'web',
        },
      ],
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Security Reviews and Certifications')).toBeInTheDocument()
      expect(screen.getByText('Trusted auditor')).toBeInTheDocument()
      expect(screen.getByText('Example Service')).toBeInTheDocument()
    })
  })

  it('maps controller confirmation sources to DID document and Account wallet labels', async () => {
    setupServiceTrustWorkspace()
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        controllerKeys: [
          {
            canonicalId: KEY_DID,
            label: 'Doc signer',
            sources: ['did-json'],
            basic: true,
          },
          {
            canonicalId: `did:pkh:eip155:66238:${OTHER_ADDRESS}`,
            label: 'Linked wallet',
            sources: ['account-wallet'],
            basic: true,
          },
        ],
      })
    )

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Account Key Authorizations')).toBeInTheDocument()
    })

    const accountSection = screen.getByText('Account Key Authorizations').closest('section')
    expect(accountSection).toBeTruthy()
    expect(within(accountSection!).getByText(/DID document/)).toBeInTheDocument()
    expect(
      within(accountSection!).getByText(`did:pkh:eip155:66238:${OTHER_ADDRESS}`)
    ).toBeInTheDocument()
    expect(within(accountSection!).getAllByText(/Public visibility: None/).length).toBeGreaterThan(0)
  })

  it('warns about duplicate signing keys and disables Register for invalid key DIDs', async () => {
    setupServiceTrustWorkspace()
    mockListSigningKeys.mockResolvedValue({ keys: [makeRegisteredSigningKey()] })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '+ Add Signing Key' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '+ Add Signing Key' }))
    await screen.findByText('Register a Service Signing Key')

    fireEvent.change(screen.getByLabelText('Public key'), { target: { value: KEY_DID } })
    expect(
      screen.getByText(/already registered on your account/i)
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Public key'), { target: { value: 'did:web:example.com' } })
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Invalid signer' } })
    fireEvent.click(screen.getByRole('button', { name: 'x402 Offers & Receipts' }))

    expect(screen.getByRole('button', { name: 'Register key' })).toBeDisabled()
  })

  it('cancels controller witness confirmation without calling the API', async () => {
    setupServiceTrustWorkspace()
    mockListSigningKeys.mockResolvedValue({ keys: [makeRegisteredSigningKey()] })
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        controllerKeys: [{ canonicalId: KEY_DID, label: 'Prod', sources: ['dns-txt'], basic: true }],
      })
    )
    mockGetAllAttestationsForDIDWithMetadata.mockResolvedValue([])

    render(<DashboardPage />)

    const externalSection = () => screen.getByText('External Key Authorizations').closest('section')!

    await waitFor(() => {
      expect(within(externalSection()).getByRole('button', { name: 'Add controller witness' })).toBeInTheDocument()
    })

    fireEvent.click(within(externalSection()).getByRole('button', { name: 'Add controller witness' }))
    expect(await screen.findByText('Confirm controller witness')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Confirm controller witness')).not.toBeInTheDocument()
    expect(mockCallControllerWitness).not.toHaveBeenCalled()
  })

  it('shows generic witness error when controller witness rejects a non-Error value', async () => {
    setupServiceTrustWorkspace()
    mockListSigningKeys.mockResolvedValue({ keys: [makeRegisteredSigningKey()] })
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        controllerKeys: [{ canonicalId: KEY_DID, label: 'Prod', sources: ['dns-txt'], basic: true }],
      })
    )
    mockGetAllAttestationsForDIDWithMetadata.mockResolvedValue([])
    mockCallControllerWitness.mockRejectedValue('witness failed')

    render(<DashboardPage />)

    const externalSection = () => screen.getByText('External Key Authorizations').closest('section')!

    await waitFor(() => {
      expect(within(externalSection()).getByRole('button', { name: 'Add controller witness' })).toBeInTheDocument()
    })

    fireEvent.click(within(externalSection()).getByRole('button', { name: 'Add controller witness' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(screen.getByText('Failed to submit controller witness.')).toBeInTheDocument()
    })
  })

  it('shows generic upsert error when saving a signing key rejects a non-Error value', async () => {
    setupServiceTrustWorkspace()
    mockUpsertSigningKey.mockRejectedValue('save failed')

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '+ Add Signing Key' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '+ Add Signing Key' }))
    await screen.findByText('Register a Service Signing Key')

    fireEvent.click(screen.getByRole('button', { name: 'x402 Offers & Receipts' }))
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Prod signer' } })
    fireEvent.change(screen.getByLabelText('Public key'), { target: { value: KEY_DID } })
    fireEvent.click(screen.getByRole('button', { name: 'Register key' }))

    await waitFor(() => {
      expect(screen.getByText('Failed to save signing key.')).toBeInTheDocument()
    })
  })

  it('shows Not set when account displayName is empty', async () => {
    mockUseBackendSession.mockReturnValue({
      session: makeSession({ account: { displayName: '' } }),
      isSessionLoading: false,
      openAuthDialog: vi.fn(),
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Not set')).toBeInTheDocument()
    })
  })

  it('hides default wallet subject and shows empty service ID copy when nothing else is registered', async () => {
    mockListSubjects.mockResolvedValue({
      subjects: [
        {
          id: 'sub-default',
          canonicalDid: ACCOUNT_WALLET_DID,
          displayName: 'Wallet',
          isDefault: true,
        },
      ],
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(mockListSubjects).toHaveBeenCalled()
    })

    const accountCard = screen.getByText('Account').closest('[class*="mb-6"]')
    expect(accountCard).toBeTruthy()
    expect(within(accountCard!).queryByText(ACCOUNT_WALLET_DID)).not.toBeInTheDocument()
    expect(within(accountCard!).getByText('No service ID configured.')).toBeInTheDocument()
  })

  it('shows loading banners while signing keys, controller summaries, and trusted attestations resolve', async () => {
    setupServiceTrustWorkspace()
    let resolveSigningKeys: (value: { keys: [] }) => void = () => {}
    let resolveController: (value: ReturnType<typeof makeControllerConfirmation>) => void = () => {}
    let resolveServiceAttestations: (value: EnrichedAttestationResult[]) => void = () => {}

    mockListSigningKeys.mockImplementation(
      () => new Promise((resolve) => { resolveSigningKeys = resolve })
    )
    mockGetControllerConfirmation.mockImplementation(
      () => new Promise((resolve) => { resolveController = resolve })
    )
    mockGetAllAttestationsForDIDWithMetadata.mockImplementation(
      () => new Promise((resolve) => { resolveServiceAttestations = resolve })
    )

    render(<DashboardPage />)

    expect(await screen.findByText('Loading signing keys...')).toBeInTheDocument()
    expect(screen.getByText(/Checking DNS TXT, did\.json, and issuer approval/i)).toBeInTheDocument()
    expect(screen.getByText('Loading trusted attestations...')).toBeInTheDocument()

    resolveSigningKeys({ keys: [] })
    resolveController(makeControllerConfirmation())
    resolveServiceAttestations([])

    await waitFor(() => {
      expect(screen.queryByText('Loading signing keys...')).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.queryByText('Loading trusted attestations...')).not.toBeInTheDocument()
    })
  })

  it('does not show Request approved issuer status when approvedIssuer.status is approved', async () => {
    setupServiceTrustWorkspace({
      attesterAttestations: [
        makeAttestation({
          schemaId: 'security-assessment',
          decodedData: { subject: SERVICE_DID },
        }),
      ],
    })
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        approvedIssuer: { status: 'approved', checkedIdentifiers: [], registryUrl: null },
      })
    )

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Service Management')).toBeInTheDocument()
    })
    expect(screen.queryByText('Request approved issuer status')).not.toBeInTheDocument()
  })

  it('shows controller witness success message and refreshes service attestations', async () => {
    setupServiceTrustWorkspace()
    mockListSigningKeys.mockResolvedValue({ keys: [makeRegisteredSigningKey()] })
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        controllerKeys: [{ canonicalId: KEY_DID, label: 'Prod', sources: ['dns-txt'], basic: true }],
      })
    )
    mockGetAllAttestationsForDIDWithMetadata
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeAttestation({
          schemaId: 'controller-witness',
          uid: '0x' + 'w'.repeat(64),
          decodedData: { controller: KEY_DID, subject: SERVICE_DID },
        }),
      ])

    render(<DashboardPage />)

    const externalSection = () => screen.getByText('External Key Authorizations').closest('section')!

    await waitFor(() => {
      expect(within(externalSection()).getByRole('button', { name: 'Add controller witness' })).toBeInTheDocument()
    })

    fireEvent.click(within(externalSection()).getByRole('button', { name: 'Add controller witness' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(screen.getByText('Controller witness submitted.')).toBeInTheDocument()
    })
    expect(mockGetAllAttestationsForDIDWithMetadata).toHaveBeenCalledTimes(2)
  })

  it('renders StarRating with accessible label for user-review rows and dash for others', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({
        schemaId: 'user-review',
        schemaTitle: 'User Review',
        decodedData: { subject: 'did:web:example.com', ratingValue: 3 },
      }),
      makeAttestation({
        uid: '0x' + 'b'.repeat(64),
        schemaId: 'certification',
        schemaTitle: 'Certification',
        decodedData: { subject: 'did:web:example.com' },
      }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('3 out of 5 stars')).toBeInTheDocument()
    })

    const myAttestationsCard = screen.getByText('My Attestations').closest('.rounded-lg')
    expect(myAttestationsCard).toBeTruthy()
    const certificationRow = within(myAttestationsCard!)
      .getAllByRole('row')
      .find((row) => row.textContent?.includes('Certification') && row.textContent?.includes('Active'))
    expect(certificationRow).toBeTruthy()
    expect(within(certificationRow!).getByText('-')).toBeInTheDocument()
  })

  it('shows raw custom-source label for unknown controller confirmation sources', async () => {
    setupServiceTrustWorkspace()
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        controllerKeys: [
          {
            canonicalId: KEY_DID,
            label: 'Custom signer',
            sources: ['custom-source'],
            basic: true,
          },
        ],
      })
    )

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Account Key Authorizations')).toBeInTheDocument()
    })

    const accountSection = () => screen.getByText('Account Key Authorizations').closest('section')!
    await waitFor(() => {
      expect(within(accountSection()).getByText(/custom-source/)).toBeInTheDocument()
    })
  })

  it('does not create service key pairs when key-binding or controller-witness attestation fields are missing', async () => {
    setupServiceTrustWorkspace({
      serviceAttestations: [
        makeAttestation({
          schemaId: 'key-binding',
          uid: '0x' + 'k'.repeat(64),
          decodedData: { subject: SERVICE_DID },
        }),
        makeAttestation({
          schemaId: 'controller-witness',
          uid: '0x' + 'w'.repeat(64),
          decodedData: { subject: SERVICE_DID },
        }),
      ],
    })
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        controllerKeys: [{ canonicalId: KEY_DID, label: 'Prod', sources: ['dns-txt'], basic: true }],
      })
    )

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('External Key Authorizations')).toBeInTheDocument()
    })

    const externalSection = screen.getByText('External Key Authorizations').closest('section')!
    expect(within(externalSection).queryByText('Intermediate: Yes')).not.toBeInTheDocument()
    expect(within(externalSection).queryByText('Advanced: Yes')).not.toBeInTheDocument()
  })

  it('shows No review text provided for reviews without reviewBody and renders bigint ratings', async () => {
    setupServiceTrustWorkspace({
      serviceAttestations: [
        makeAttestation({
          uid: REVIEW_UID,
          schemaId: 'user-review',
          schemaTitle: 'User Review',
          attester: OTHER_ADDRESS,
          decodedData: { subject: SERVICE_DID, ratingValue: BigInt(4) },
        }),
      ],
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('No review text provided.')).toBeInTheDocument()
      expect(screen.getByLabelText('4 out of 5 stars')).toBeInTheDocument()
    })
  })

  it('falls back to truncated DID labels when resolvePublicIdentities rejects', async () => {
    setupServiceTrustWorkspace({
      attesterAttestations: [
        makeAttestation({
          uid: '0x' + 'c'.repeat(64),
          schemaId: 'certification',
          schemaTitle: 'Certification',
          attester: APPROVED_ISSUER,
          decodedData: { subject: SERVICE_DID },
        }),
      ],
    })
    mockResolvePublicIdentities.mockRejectedValue(new Error('Identity lookup failed'))

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Security Reviews and Certifications')).toBeInTheDocument()
    })

    expect(screen.getByText(`${APPROVED_ISSUER.slice(0, 16)}...${APPROVED_ISSUER.slice(-8)}`)).toBeInTheDocument()
  })

  it('filters did:key and did:artifact primary subjects from service management', async () => {
    mockUseBackendSession.mockReturnValue({
      session: makeSession({
        primarySubject: { canonicalDid: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK' },
      }),
      isSessionLoading: false,
      openAuthDialog: vi.fn(),
    })
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({
        schemaId: 'linked-identifier',
        decodedData: { subject: SERVICE_DID },
      }),
      makeAttestation({
        uid: '0x' + 'f'.repeat(64),
        schemaId: 'linked-identifier',
        decodedData: { subject: 'did:artifact:bafkreiabc' },
      }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Service Management')).toBeInTheDocument()
    })

    const serviceManagement = screen.getByText('Service Management').closest('.mb-6')!
    expect(within(serviceManagement).getAllByText(SERVICE_DID).length).toBeGreaterThan(0)
    expect(within(serviceManagement).queryByText('did:artifact:bafkreiabc')).not.toBeInTheDocument()
    expect(
      within(serviceManagement).queryByText('did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK')
    ).not.toBeInTheDocument()
  })

  it('labels multiple registered subjects as Service IDs and omits empty display names', async () => {
    mockListSubjects.mockResolvedValue({
      subjects: [
        {
          id: 'sub-1',
          canonicalDid: 'did:web:alpha.example.com',
          displayName: 'Alpha',
          isDefault: false,
        },
        {
          id: 'sub-2',
          canonicalDid: 'did:web:beta.example.com',
          displayName: null,
          isDefault: false,
        },
      ],
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Service IDs')).toBeInTheDocument()
    })
    const accountCard = screen.getByText('Account').closest('.mb-6')!
    expect(within(accountCard).getByText('did:web:alpha.example.com')).toBeInTheDocument()
    expect(within(accountCard).getByText('did:web:beta.example.com')).toBeInTheDocument()
    expect(within(accountCard).getByText('Alpha')).toBeInTheDocument()
  })

  it('includes Not specified for empty email in approved issuer mailto body', async () => {
    const hrefSetter = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href() {
          return 'http://localhost/'
        },
        set href(value: string) {
          hrefSetter(value)
        },
        host: 'localhost',
        origin: 'http://localhost',
      },
    })

    setupServiceTrustWorkspace({
      attesterAttestations: [
        makeAttestation({
          uid: '0x' + 'b'.repeat(64),
          schemaId: 'security-assessment',
          schemaTitle: 'Security Assessment',
          decodedData: { subject: SERVICE_DID },
        }),
      ],
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Request approved issuer status')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Request' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open email request' }))

    await waitFor(() => {
      expect(hrefSetter).toHaveBeenCalled()
    })
    const mailtoHref = hrefSetter.mock.calls[0]![0] as string
    expect(mailtoHref).toContain(encodeURIComponent('Email: Not specified'))
  })

  it('derives account wallet DID from connected address when session wallet is missing', async () => {
    mockUseBackendSession.mockReturnValue({
      session: makeSession({ wallet: null }),
      isSessionLoading: false,
      openAuthDialog: vi.fn(),
    })
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({
        schemaId: 'linked-identifier',
        decodedData: { subject: SERVICE_DID },
      }),
    ])
    mockListSubjects.mockResolvedValue({
      subjects: [
        {
          id: 'sub-pkh',
          canonicalDid: 'did:pkh:eip155:66238:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          displayName: 'PKH service',
          isDefault: false,
        },
      ],
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Service Management')).toBeInTheDocument()
    })
    const accountCard = screen.getByText('Account').closest('.mb-6')!
    expect(
      within(accountCard).getByText('did:pkh:eip155:66238:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    ).toBeInTheDocument()
  })

  it('rejects invalid controller and attestation key DIDs from service key pairs', async () => {
    const validExtraKey = 'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2In0'
    setupServiceTrustWorkspace()
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        controllerKeys: [
          { canonicalId: 'did:pkh:eip155:1', label: 'short-pkh', sources: ['dns-txt'], basic: true },
          { canonicalId: 'did:ethr:mainnet', label: 'short-ethr', sources: ['dns-txt'], basic: true },
          { canonicalId: 'did:key:ab', label: 'short-key', sources: ['dns-txt'], basic: true },
          { canonicalId: 'did:jwk:xy', label: 'short-jwk', sources: ['dns-txt'], basic: true },
          { canonicalId: 'did:web:not-a-key.example.com', label: 'web', sources: [], basic: true },
          {
            canonicalId: validExtraKey,
            label: 'Valid multi-source',
            sources: ['dns-txt', 'did-json', 'custom-registry'],
            basic: true,
          },
        ],
      })
    )
    mockGetAllAttestationsForDIDWithMetadata.mockResolvedValue([
      makeAttestation({
        schemaId: 'key-binding',
        uid: '0x' + '1'.repeat(64),
        decodedData: { keyId: 'did:pkh:bad', subject: SERVICE_DID },
      }),
      makeAttestation({
        schemaId: 'controller-witness',
        uid: '0x' + '2'.repeat(64),
        decodedData: { controller: 'did:ethr:x', subject: SERVICE_DID },
      }),
    ])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Account Key Authorizations')).toBeInTheDocument()
    })

    const accountSection = () => screen.getByText('Account Key Authorizations').closest('section')!
    await waitFor(() => {
      expect(within(accountSection()).getByText(validExtraKey)).toBeInTheDocument()
    })
    expect(within(accountSection()).queryByText('did:pkh:eip155:1')).not.toBeInTheDocument()
    expect(within(accountSection()).queryByText('did:web:not-a-key.example.com')).not.toBeInTheDocument()
    expect(within(accountSection()).getByText(/custom-registry/)).toBeInTheDocument()
  })

  it('shows schemaId when issuer credential schemaTitle is missing', async () => {
    setupServiceTrustWorkspace({
      attesterAttestations: [
        makeAttestation({
          uid: '0x' + 'c'.repeat(64),
          schemaId: 'certification',
          schemaTitle: undefined,
          attester: APPROVED_ISSUER,
          decodedData: { subject: SERVICE_DID },
        }),
      ],
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Security Reviews and Certifications')).toBeInTheDocument()
    })
    const section = screen.getByText('Security Reviews and Certifications').closest('section')!
    expect(within(section).getByText('certification')).toBeInTheDocument()
  })

  it('shows generic your-domain.com guidance for did:pkh service subjects', async () => {
    const pkhService = 'did:pkh:eip155:66238:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({
        schemaId: 'linked-identifier',
        decodedData: { subject: pkhService },
      }),
    ])
    mockListSigningKeys.mockResolvedValue({ keys: [makeRegisteredSigningKey()] })
    mockGetControllerConfirmation.mockResolvedValue(makeControllerConfirmation())
    mockGetAllAttestationsForDIDWithMetadata.mockResolvedValue([])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Authorize this key')).toBeInTheDocument()
    })
    expect(screen.getByText(/_controllers\.your-domain\.com/i)).toBeInTheDocument()
    expect(screen.getByText(/https:\/\/your-domain\.com\/\.well-known\/did\.json/i)).toBeInTheDocument()
  })

  it('handles trust-anchor, signing-key, controller, and service-attestation load failures', async () => {
    setupServiceTrustWorkspace()
    mockGetPublicTrustAnchors.mockRejectedValue(new Error('anchors down'))
    mockListSigningKeys.mockRejectedValue(new Error('keys down'))
    mockGetControllerConfirmation.mockRejectedValue(new Error('controller down'))
    mockGetAllAttestationsForDIDWithMetadata.mockRejectedValue(new Error('service atts down'))

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Service Management')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByText(/No trusted attestations found/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/No signing keys registered yet/i)).toBeInTheDocument()
  })

  it('passes search-param context through to the sign-in redirect', () => {
    const openAuthDialog = vi.fn()
    mockUseSearchParams.mockReturnValue(new URLSearchParams('context=issuer'))
    mockUseBackendSession.mockReturnValue({
      session: null,
      isSessionLoading: false,
      openAuthDialog,
    })

    render(<DashboardPage />)
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(openAuthDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'chooser',
        redirectTo: '/dashboard?context=issuer',
      })
    )
  })

  it('shows generic attestation load error when rejection is not an Error', async () => {
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockRejectedValue('boom')

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load attestations.')).toBeInTheDocument()
    })
  })

  it('shows wallet/EAS unavailable error when revoking without an active thirdweb account', async () => {
    setupConnected()
    mockUseActiveAccount.mockReturnValue(null)
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([makeAttestation()])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    await waitFor(() => {
      expect(screen.getByText('Wallet account or EAS contract not available.')).toBeInTheDocument()
    })
  })

  it('shows revocation unavailable when the ethers signer cannot be obtained', async () => {
    setupConnected()
    mockToEthers.mockResolvedValue(null)
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([makeAttestation()])

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    await waitFor(() => {
      expect(screen.getByText('Attestation revocation is not available yet.')).toBeInTheDocument()
    })
  })

  it('toggles signing-key tags off and clears public-key input to null', async () => {
    setupServiceTrustWorkspace()

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '+ Add Signing Key' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: '+ Add Signing Key' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /x402 Offers/i }))
    fireEvent.click(within(dialog).getByRole('button', { name: /x402 Offers/i }))
    fireEvent.change(within(dialog).getByLabelText('Public key'), {
      target: { value: 'did:jwk:eyJrdHkiOiJPS1AifQ' },
    })
    fireEvent.change(within(dialog).getByLabelText('Public key'), {
      target: { value: '' },
    })
    expect(within(dialog).getByLabelText('Public key')).toHaveValue('')
  })

  it('edits a did:pkh signing key with null notes and shows immutable key identifier', async () => {
    const pkhKey = `did:pkh:eip155:66238:${OTHER_ADDRESS}`
    setupServiceTrustWorkspace()
    mockListSigningKeys.mockResolvedValue({
      keys: [
        makeRegisteredSigningKey({
          keyDid: pkhKey,
          tags: [],
          notes: null,
          displayName: 'PKH signer',
        }),
      ],
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Edit Signing Key')).toBeInTheDocument()
    expect(within(dialog).getByText(pkhKey)).toBeInTheDocument()
    expect(within(dialog).queryByTestId('did-pkh-input')).not.toBeInTheDocument()
    expect(within(dialog).queryByTestId('public-key-input')).not.toBeInTheDocument()
  })

  it('maps unknown signing-key tags to their raw values', async () => {
    setupServiceTrustWorkspace()
    mockListSigningKeys.mockResolvedValue({
      keys: [
        makeRegisteredSigningKey({
          tags: ['custom-tag' as 'x402'],
          notes: null,
        }),
      ],
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText(/Uses:/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/custom-tag/)).toBeInTheDocument()
  })

  it('shows SigningKeyCard endpoint evidence error when witness API returns null', async () => {
    setupServiceTrustWorkspace()
    mockListSigningKeys.mockResolvedValue({ keys: [makeRegisteredSigningKey()] })
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        controllerKeys: [{ canonicalId: KEY_DID, label: 'Prod', sources: ['dns-txt'], basic: true }],
      })
    )
    mockGetAllAttestationsForDIDWithMetadata.mockResolvedValue([])
    mockCallControllerWitness.mockResolvedValue(null)

    render(<DashboardPage />)

    const externalSection = () => screen.getByText('External Key Authorizations').closest('section')!

    await waitFor(() => {
      expect(within(externalSection()).getByRole('button', { name: 'Add controller witness' })).toBeInTheDocument()
    })
    fireEvent.click(within(externalSection()).getByRole('button', { name: 'Add controller witness' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(screen.getByText(/could not confirm endpoint evidence/i)).toBeInTheDocument()
    })
  })

  it('falls back when normalizeDid throws and ignores non-DID attestation subjects', async () => {
    mockNormalizeDid.mockImplementation((d: string) => {
      if (d.includes('throw-me')) throw new Error('bad did')
      return d
    })
    setupConnected()
    mockGetAttestationsByAttesterWithMetadata.mockResolvedValue([
      makeAttestation({
        schemaId: 'linked-identifier',
        decodedData: { subject: SERVICE_DID },
      }),
      makeAttestation({
        uid: '0x' + 'n'.repeat(64),
        schemaId: 'linked-identifier',
        decodedData: { subject: 'example.com', organization: 'not-a-did' },
      }),
    ])
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        controllerKeys: [
          {
            canonicalId: 'did:jwk:eyJrdHkiOiJUSFJPVyJ9-throw-me',
            label: 'Throwing key',
            sources: ['dns-txt'],
            basic: true,
          },
        ],
      })
    )

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Service Management')).toBeInTheDocument()
    })
    const serviceManagement = screen.getByText('Service Management').closest('.mb-6')!
    expect(within(serviceManagement).queryByText('example.com')).not.toBeInTheDocument()
  })

  it('swallows listSubjects failures without blocking the dashboard', async () => {
    mockListSubjects.mockRejectedValue(new Error('subjects unavailable'))
    setupConnected()

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Account')).toBeInTheDocument()
    })
    expect(screen.getByText('No service ID configured.')).toBeInTheDocument()
  })

  it('shows Not set when credential attester is empty', async () => {
    setupServiceTrustWorkspace({
      attesterAttestations: [
        makeAttestation({
          uid: '0x' + 'c'.repeat(64),
          schemaId: 'certification',
          schemaTitle: 'Certification',
          attester: '',
          decodedData: { subject: SERVICE_DID },
        }),
      ],
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Security Reviews and Certifications')).toBeInTheDocument()
    })
    const section = screen.getByText('Security Reviews and Certifications').closest('section')!
    expect(within(section).getByText('Not set')).toBeInTheDocument()
  })

  it('clears did:pkh input to null while registering a signing key', async () => {
    setupServiceTrustWorkspace()

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '+ Add Signing Key' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: '+ Add Signing Key' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /Blockchain wallet/i }))
    fireEvent.change(within(dialog).getByLabelText('did:pkh'), {
      target: { value: ACCOUNT_WALLET_DID },
    })
    fireEvent.change(within(dialog).getByLabelText('did:pkh'), {
      target: { value: '' },
    })
    expect(within(dialog).getByLabelText('did:pkh')).toHaveValue('')
  })

  it('keeps did:pkh service subjects when session has no wallet and wallet is disconnected', async () => {
    const pkhSubject = 'did:pkh:eip155:66238:0xcccccccccccccccccccccccccccccccccccccccc'
    mockUseBackendSession.mockReturnValue({
      session: makeSession({
        wallet: null,
        primarySubject: { canonicalDid: pkhSubject },
      }),
      isSessionLoading: false,
      openAuthDialog: vi.fn(),
    })
    mockUseWallet.mockReturnValue({ isConnected: false, address: null, chainId: 66238 })
    mockListSubjects.mockResolvedValue({
      subjects: [
        {
          id: 'sub-pkh',
          canonicalDid: pkhSubject,
          displayName: 'Disconnected PKH',
          isDefault: false,
        },
      ],
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Service Management')).toBeInTheDocument()
    })
    const accountCard = screen.getByText('Account').closest('.mb-6')!
    expect(within(accountCard).getByText(pkhSubject)).toBeInTheDocument()
  })

  it('seeds approved-issuer form wallets from address when session wallet is missing', async () => {
    const hrefSetter = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href() {
          return 'http://localhost/'
        },
        set href(value: string) {
          hrefSetter(value)
        },
        host: 'localhost',
        origin: 'http://localhost',
      },
    })

    mockUseBackendSession.mockReturnValue({
      session: makeSession({ wallet: null }),
      isSessionLoading: false,
      openAuthDialog: vi.fn(),
    })
    setupServiceTrustWorkspace({
      attesterAttestations: [
        makeAttestation({
          uid: '0x' + 'b'.repeat(64),
          schemaId: 'security-assessment',
          decodedData: { subject: SERVICE_DID },
        }),
      ],
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Request approved issuer status')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Request' }))
    expect(screen.getByLabelText('Key IDs')).toHaveValue(WALLET_ADDRESS)
    fireEvent.click(screen.getByRole('button', { name: 'Open email request' }))
    await waitFor(() => {
      expect(hrefSetter).toHaveBeenCalled()
    })
  })

  it('accepts valid did:key and did:jwk controller keys in authorizations', async () => {
    const keyDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
    const jwkDid = 'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJQLTI1NiJ9'
    setupServiceTrustWorkspace()
    mockGetControllerConfirmation.mockResolvedValue(
      makeControllerConfirmation({
        controllerKeys: [
          { canonicalId: keyDid, label: 'Key did', sources: ['dns-txt'], basic: true },
          { canonicalId: jwkDid, label: 'Jwk did', sources: ['did-json'], basic: true },
        ],
      })
    )

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Account Key Authorizations')).toBeInTheDocument()
    })
    const accountSection = () => screen.getByText('Account Key Authorizations').closest('section')!
    await waitFor(() => {
      expect(within(accountSection()).getByText(keyDid)).toBeInTheDocument()
    })
    expect(within(accountSection()).getByText(jwkDid)).toBeInTheDocument()
  })

  it('shows ServiceKeyCard witness success message for account key authorizations', async () => {
    setupAccountKeyWitnessFlow()
    mockCallControllerWitness.mockResolvedValue({ uid: '0x' + 'w'.repeat(64) })

    render(<DashboardPage />)
    await submitControllerWitnessFromAccountSection()

    await waitFor(() => {
      expect(screen.getByText('Controller witness submitted.')).toBeInTheDocument()
    })
  })
})


