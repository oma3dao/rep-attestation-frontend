import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetVerifiedAttestations = vi.fn()
const mockGetControllerConfirmation = vi.fn()
let mockTrustAnchors = { version: 1, updatedAt: '', widgetOrigins: [], chains: {}, registries: [] as unknown[] }

vi.mock('@oma3/omatrust/identity', () => ({
  isSameControllerId: (a: string, b: string) => a.toLowerCase() === b.toLowerCase(),
}))

vi.mock('@/lib/blockchain', () => ({
  getActiveChain: () => ({
    id: 66238,
    rpc: 'https://rpc.testnet.chain.oma3.org/',
    name: 'OMAChain Testnet',
    nativeCurrency: { name: 'OMA', symbol: 'OMA', decimals: 18 },
    blockExplorers: [],
  }),
}))

vi.mock('@/lib/attestation-queries', () => ({
  getVerifiedAttestationsForDIDWithMetadata: (...args: unknown[]) => mockGetVerifiedAttestations(...args),
  sortByCategoryPriority: (attestations: unknown[]) => attestations,
}))

vi.mock('@/lib/omatrust-backend', () => ({
  getControllerConfirmation: (...args: unknown[]) => mockGetControllerConfirmation(...args),
  getPublicTrustAnchors: () => Promise.resolve(mockTrustAnchors),
}))

vi.mock('@/components/SubjectIdInput', () => ({
  SubjectIdInput: ({
    value,
    onChange,
    allowedMethods,
  }: {
    value: string
    onChange: (value: string | null) => void
    allowedMethods?: string[]
  }) => (
    <input
      aria-label={allowedMethods?.includes('web') ? 'Subject DID' : 'Controller DID'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

vi.mock('@/components/latest-attestations', () => ({
  LatestAttestations: ({ data, emptyMessage }: { data: unknown[]; emptyMessage: string }) => (
    <div data-testid="latest-attestations">
      {data.length > 0 ? `${data.length} attestations` : emptyMessage}
    </div>
  ),
}))

import VerifyPage from '@/app/verify/page'

const attestation = {
  uid: `0x${'1'.repeat(64)}`,
  schema: `0x${'2'.repeat(64)}`,
  attester: `0x${'a'.repeat(40)}`,
  recipient: `0x${'b'.repeat(40)}`,
  data: '0x',
  time: 1,
  expirationTime: 0,
  revocationTime: 0,
  refUID: `0x${'0'.repeat(64)}`,
  revocable: true,
  schemaId: 'certification',
  schemaTitle: 'Certification',
  verification: {
    valid: true,
    checks: { schema: true },
    reasons: [],
  },
}

const responsibilityClaimAttestation = {
  ...attestation,
  uid: `0x${'3'.repeat(64)}`,
  attester: '0x123',
  schemaId: 'responsibility-claim',
  schemaTitle: 'Responsibility Claim',
  decodedData: {
    responsibleParty: 'did:web:example.com',
    subject: 'did:artifact:bafkreiabc',
    subjectLabel: 'example artifact',
    responsibilityType: ['creator'],
    effectiveAt: 0,
    expiresAt: 0,
  },
}

const securityAssessmentAttestation = {
  ...attestation,
  uid: `0x${'4'.repeat(64)}`,
  schemaId: 'security-assessment',
  schemaTitle: 'Security Assessment',
  decodedData: { subject: 'did:artifact:bafkreiabc', effectiveAt: 0, expiresAt: 0 },
  verification: undefined,
}

const certificationAttestation = {
  ...attestation,
  uid: `0x${'5'.repeat(64)}`,
  decodedData: { subject: 'did:artifact:bafkreiabc', effectiveAt: 0, expiresAt: 0 },
  verification: undefined,
}

describe('Verify page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTrustAnchors = { version: 1, updatedAt: '', widgetOrigins: [], chains: {}, registries: [] }
    mockGetVerifiedAttestations.mockResolvedValue([attestation])
    mockGetControllerConfirmation.mockResolvedValue({
      subject: { did: 'did:web:example.com', label: 'example.com' },
      domain: 'example.com',
      controllerKeys: [
        {
          id: `did:pkh:eip155:66238:0x${'1'.repeat(40)}`,
          canonicalId: 'did:pkh:eip155:66238:0x123',
          label: '0x123',
          sources: ['dns-txt'],
          basic: true,
        },
      ],
      evidence: [],
      approvedIssuer: { status: 'not-configured', checkedIdentifiers: [], registryUrl: null },
      warnings: [],
    })
  })

  it('verifies a subject without controller input', async () => {
    render(<VerifyPage />)

    fireEvent.change(screen.getByLabelText('Subject DID'), {
      target: { value: 'did:web:example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /verify/i }))

    await waitFor(() => {
      expect(mockGetVerifiedAttestations).toHaveBeenCalledWith('did:web:example.com')
    })

    expect(mockGetControllerConfirmation).not.toHaveBeenCalled()
    expect(screen.getByText('Service Summary')).toBeInTheDocument()
    expect(screen.getByText('1 attestations')).toBeInTheDocument()
    expect(screen.getByText('Certifications')).toBeInTheDocument()
  })

  it('renders controller authorization when controller input is provided', async () => {
    render(<VerifyPage />)

    fireEvent.change(screen.getByLabelText('Subject DID'), {
      target: { value: 'did:web:example.com' },
    })
    fireEvent.change(screen.getByLabelText('Controller DID'), {
      target: { value: 'did:pkh:eip155:66238:0x123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /verify/i }))

    await waitFor(() => {
      expect(mockGetControllerConfirmation).toHaveBeenCalledWith({
        subjectDid: 'did:web:example.com',
      })
    })

    expect(screen.getByText('Authorized')).toBeInTheDocument()
    expect(screen.getByText(/Basic:/)).toBeInTheDocument()
    expect(screen.getByText(/Intermediate:/)).toBeInTheDocument()
    expect(screen.getByText(/Advanced:/)).toBeInTheDocument()
    expect(screen.getByText(/DNS TXT/)).toBeInTheDocument()
  })

  it('shows an error when subject verification fails', async () => {
    mockGetVerifiedAttestations.mockRejectedValueOnce(new Error('Query failed'))
    render(<VerifyPage />)

    fireEvent.change(screen.getByLabelText('Subject DID'), {
      target: { value: 'did:web:example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /verify/i }))

    await waitFor(() => {
      expect(screen.getByText('Query failed')).toBeInTheDocument()
    })
  })

  it('queries artifact attestations and renders schema-aware artifact verification', async () => {
    mockGetVerifiedAttestations.mockResolvedValueOnce([
      responsibilityClaimAttestation,
      securityAssessmentAttestation,
      certificationAttestation,
    ])
    mockTrustAnchors = {
      version: 1,
      updatedAt: '',
      widgetOrigins: [],
      chains: {},
      registries: [
        {
          type: 'approved-issuers',
          issuers: [
            {
              address: attestation.attester,
              label: 'Approved issuer',
              schemas: ['security-assessment', 'certification'],
              status: 'active',
              validFrom: '',
            },
          ],
        },
      ],
    }
    render(<VerifyPage />)

    fireEvent.change(screen.getByLabelText('Subject DID'), {
      target: { value: 'did:artifact:bafkreiabc' },
    })
    fireEvent.click(screen.getByRole('button', { name: /verify/i }))

    await waitFor(() => {
      expect(mockGetVerifiedAttestations).toHaveBeenCalledWith('did:artifact:bafkreiabc')
    })

    expect(mockGetControllerConfirmation).toHaveBeenCalledWith({ subjectDid: 'did:web:example.com' })
    expect(screen.getByText('Artifact')).toBeInTheDocument()
    expect(screen.getByText('Security Assessments Summary')).toBeInTheDocument()
    expect(screen.getAllByText('Responsibility Claims').length).toBeGreaterThan(0)
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.getByText('did:web:example.com')).toBeInTheDocument()
    expect(screen.queryByText('Responsibility Claims', { selector: '.text-sm' })).not.toBeInTheDocument()
  })
})
