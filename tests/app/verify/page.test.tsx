import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetVerifiedAttestations = vi.fn()
const mockGetControllerConfirmation = vi.fn()
const mockGetPublicTrustAnchors = vi.fn()
let mockTrustAnchors = { version: 1, updatedAt: '', widgetOrigins: [], chains: {}, registries: [] as unknown[] }

vi.mock('@oma3/omatrust/identity', () => ({
  isSameControllerId: (a: string, b: string) => a.toLowerCase() === b.toLowerCase(),
  artifactDidFromJson: vi.fn(async () => 'did:artifact:bafkreifromjson'),
  artifactDidFromBytes: vi.fn(async () => 'did:artifact:bafkreifrombytes'),
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
  getPublicTrustAnchors: (...args: unknown[]) => mockGetPublicTrustAnchors(...args),
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

function searchAndVerify(value: string) {
  fireEvent.change(screen.getByLabelText('Search DID'), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: /verify/i }))
}

describe('Verify page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTrustAnchors = { version: 1, updatedAt: '', widgetOrigins: [], chains: {}, registries: [] }
    mockGetPublicTrustAnchors.mockResolvedValue(mockTrustAnchors)
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

  it('shows a Google-style search before results', () => {
    render(<VerifyPage />)
    expect(screen.getByText('OMATrust')).toBeInTheDocument()
    expect(screen.getByLabelText('Search DID')).toBeInTheDocument()
    expect(screen.getByLabelText('Upload file')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /verify/i })).toBeDisabled()
  })

  it('detects DID type while typing', () => {
    render(<VerifyPage />)
    fireEvent.change(screen.getByLabelText('Search DID'), {
      target: { value: 'did:pkh:eip155:66238:0x1234567890123456789012345678901234567890' },
    })
    expect(screen.getByText(/Detected: Blockchain Address/)).toBeInTheDocument()
  })

  it('resolves a bare address to did:pkh and verifies', async () => {
    mockGetVerifiedAttestations.mockResolvedValueOnce([])
    render(<VerifyPage />)
    searchAndVerify('0x1234567890123456789012345678901234567890')

    await waitFor(() => {
      expect(mockGetVerifiedAttestations).toHaveBeenCalledWith(
        'did:pkh:eip155:66238:0x1234567890123456789012345678901234567890'
      )
    })
    expect(screen.getByText('Blockchain Address')).toBeInTheDocument()
    expect(screen.getByText('Who authorized this')).toBeInTheDocument()
  })

  it('verifies a web subject and shows a score', async () => {
    render(<VerifyPage />)
    searchAndVerify('did:web:example.com')

    await waitFor(() => {
      expect(mockGetVerifiedAttestations).toHaveBeenCalledWith('did:web:example.com')
    })

    expect(screen.getByText('Web Domain / URL')).toBeInTheDocument()
    expect(screen.getByText('1 attestations')).toBeInTheDocument()
  })

  it('shows authorizing parties for did:pkh', async () => {
    mockGetVerifiedAttestations.mockResolvedValueOnce([
      {
        ...attestation,
        schemaId: 'controller-witness',
        decodedData: {
          subject: 'did:pkh:eip155:66238:0xabc',
          controller: 'did:web:authorizer.example',
        },
      },
      {
        ...attestation,
        uid: `0x${'6'.repeat(64)}`,
        schemaId: 'key-binding',
        decodedData: {
          subject: 'did:pkh:eip155:66238:0xabc',
          keyId: 'did:web:authorizer.example',
        },
      },
    ])
    mockGetControllerConfirmation.mockResolvedValueOnce({
      subject: { did: 'did:pkh:eip155:66238:0xabc', label: '0xabc' },
      domain: null,
      controllerKeys: [
        {
          id: 'did:pkh:eip155:66238:0xowner',
          canonicalId: 'did:pkh:eip155:66238:0xowner',
          label: '0xowner',
          sources: ['did-json'],
          basic: true,
        },
      ],
      evidence: [],
      approvedIssuer: { status: 'not-configured', checkedIdentifiers: [], registryUrl: null },
      warnings: [],
    })

    render(<VerifyPage />)
    searchAndVerify('did:pkh:eip155:66238:0xabc')

    await waitFor(() => {
      expect(screen.getByText('Who authorized this')).toBeInTheDocument()
    })
    expect(screen.getByText('0xowner')).toBeInTheDocument()
    expect(screen.getByText(/DID document/)).toBeInTheDocument()
    expect(screen.getByText('did:web:authorizer.example')).toBeInTheDocument()
  })

  it('shows websites that claim an artifact', async () => {
    mockGetVerifiedAttestations.mockResolvedValueOnce([responsibilityClaimAttestation])
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

    render(<VerifyPage />)
    searchAndVerify('did:artifact:bafkreiabc')

    await waitFor(() => {
      expect(screen.getByText('Websites that claim this')).toBeInTheDocument()
    })
    expect(screen.getByText('example.com')).toBeInTheDocument()
    expect(screen.getByText('did:web:example.com')).toBeInTheDocument()
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.getByText('creator')).toBeInTheDocument()
  })

  it('shows empty website-claim copy when no websites claim the artifact', async () => {
    mockGetVerifiedAttestations.mockResolvedValueOnce([certificationAttestation])

    render(<VerifyPage />)
    searchAndVerify('did:artifact:bafkreiabc')

    await waitFor(() => {
      expect(screen.getByText('No websites claim this artifact yet.')).toBeInTheDocument()
    })
  })

  it('shows an error when subject verification fails', async () => {
    mockGetVerifiedAttestations.mockRejectedValueOnce(new Error('Query failed'))
    render(<VerifyPage />)
    searchAndVerify('did:web:example.com')

    await waitFor(() => {
      expect(screen.getByText('Query failed')).toBeInTheDocument()
    })
  })

  it('prompts when search is empty and submitted', async () => {
    render(<VerifyPage />)
    const form = screen.getByRole('button', { name: /verify/i }).closest('form')
    fireEvent.submit(form!)

    await waitFor(() => {
      expect(screen.getByText('Enter a DID, address, domain, or upload a file.')).toBeInTheDocument()
    })
    expect(mockGetVerifiedAttestations).not.toHaveBeenCalled()
  })

  it('still renders results when trust anchors fail to load', async () => {
    mockGetPublicTrustAnchors.mockRejectedValueOnce(new Error('anchors down'))
    render(<VerifyPage />)
    searchAndVerify('did:web:example.com')

    await waitFor(() => {
      expect(screen.getByText('1 attestations')).toBeInTheDocument()
    })
  })

  it('shows failed verification reasons on website claims', async () => {
    mockGetVerifiedAttestations.mockResolvedValueOnce([responsibilityClaimAttestation])
    mockGetControllerConfirmation.mockResolvedValue({
      subject: { did: 'did:web:example.com', label: 'example.com' },
      domain: 'example.com',
      controllerKeys: [],
      evidence: [],
      approvedIssuer: { status: 'not-configured', checkedIdentifiers: [], registryUrl: null },
      warnings: [],
    })

    render(<VerifyPage />)
    searchAndVerify('did:artifact:bafkreiabc')

    await waitFor(() => {
      expect(screen.getByText('Needs review')).toBeInTheDocument()
    })
    expect(
      screen.getByText('Attester is not an authorized controller for the responsible party.')
    ).toBeInTheDocument()
  })

  it('marks revoked responsibility claims as Needs review', async () => {
    mockGetVerifiedAttestations.mockResolvedValueOnce([
      { ...responsibilityClaimAttestation, revocationTime: 1700000000 },
    ])

    render(<VerifyPage />)
    searchAndVerify('did:artifact:bafkreiabc')

    await waitFor(() => {
      expect(screen.getByText('Needs review')).toBeInTheDocument()
    })
    expect(screen.getByText('Responsibility claim has been revoked.')).toBeInTheDocument()
  })

  it('does not count untrusted security assessments as verified', async () => {
    mockGetVerifiedAttestations.mockResolvedValueOnce([securityAssessmentAttestation])

    render(<VerifyPage />)
    searchAndVerify('did:artifact:bafkreiabc')

    await waitFor(() => {
      expect(screen.getByText('Security Assessments')).toBeInTheDocument()
    })
    const section = screen.getByText('Security Assessments').closest('section')!
    expect(within(section).getByText('verified').previousElementSibling).toHaveTextContent('0')
  })

  it('counts trusted security assessments as verified', async () => {
    mockGetVerifiedAttestations.mockResolvedValueOnce([
      { ...securityAssessmentAttestation, attester: attestation.attester },
    ])
    mockGetPublicTrustAnchors.mockResolvedValue({
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
              schemas: ['security-assessment'],
              status: 'active',
              validFrom: '',
            },
          ],
        },
      ],
    })

    render(<VerifyPage />)
    searchAndVerify('did:artifact:bafkreiabc')

    await waitFor(() => {
      expect(screen.getByText('Security Assessments')).toBeInTheDocument()
    })
    const section = screen.getByText('Security Assessments').closest('section')!
    expect(within(section).getByText('verified').previousElementSibling).toHaveTextContent('1')
  })

  it.each([
    ['did:web:example.com', 'Web Domain / URL'],
    ['did:jwk:eyJrdHkiOiJPS1AifQ', 'JWK Key'],
    ['did:handle:twitter:exampleuser', 'Social Handle'],
    ['did:unknown:foo', 'ID'],
  ])('shows subject type %s → %s', async (subjectDid, badgeLabel) => {
    mockGetVerifiedAttestations.mockResolvedValueOnce([])
    render(<VerifyPage />)
    searchAndVerify(subjectDid)

    await waitFor(() => {
      expect(screen.getByText(badgeLabel)).toBeInTheDocument()
    })
  })

  it('hashes an uploaded file into an artifact DID', async () => {
    render(<VerifyPage />)
    const file = new File(['{"hello":"world"}'], 'artifact.json', { type: 'application/json' })
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => new TextEncoder().encode('{"hello":"world"}').buffer,
    })
    const input = screen.getByLabelText('Upload artifact file')
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByLabelText('Search DID')).toHaveValue('did:artifact:bafkreifromjson')
    })
    expect(screen.getByText(/Detected: Artifact/)).toBeInTheDocument()
  })

  it('shows a generic fetch error when attestation loading rejects a non-Error', async () => {
    mockGetVerifiedAttestations.mockRejectedValueOnce('network down')
    render(<VerifyPage />)
    searchAndVerify('did:web:example.com')

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch attestations.')).toBeInTheDocument()
    })
  })

  it('shows authorization error for pkh when controller confirmation fails', async () => {
    mockGetVerifiedAttestations.mockResolvedValueOnce([])
    mockGetControllerConfirmation.mockRejectedValueOnce(new Error('Controller lookup failed'))

    render(<VerifyPage />)
    searchAndVerify('did:pkh:eip155:66238:0x1234567890123456789012345678901234567890')

    await waitFor(() => {
      expect(screen.getByText('Controller lookup failed')).toBeInTheDocument()
    })
  })

  it('accepts responsibilityType as a scalar string', async () => {
    mockGetVerifiedAttestations.mockResolvedValueOnce([
      {
        ...responsibilityClaimAttestation,
        decodedData: {
          ...responsibilityClaimAttestation.decodedData,
          responsibilityType: 'maintainer',
        },
      },
    ])
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

    render(<VerifyPage />)
    searchAndVerify('did:artifact:bafkreiabc')

    await waitFor(() => {
      expect(screen.getByText('maintainer')).toBeInTheDocument()
    })
  })
})
