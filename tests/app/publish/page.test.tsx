import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockPush = vi.fn()
const mockOpenAuthDialog = vi.fn()
const mockUseBackendSession = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/backend-session-provider', () => ({
  useBackendSession: () => mockUseBackendSession(),
}))

import PublishPage from '@/app/publish/page'

describe('PublishPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    mockUseBackendSession.mockReturnValue({
      session: null,
      openAuthDialog: mockOpenAuthDialog,
    })
  })

  it('renders all publish options by default', () => {
    render(<PublishPage />)

    expect(screen.getByRole('heading', { name: 'Publish' })).toBeInTheDocument()
    expect(screen.getByText('Authorize a signing key')).toBeInTheDocument()
    expect(screen.getByText('Review an app or service')).toBeInTheDocument()
    expect(screen.getByText('Publish a responsibility claim')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Dashboard' })).toBeInTheDocument()
  })

  it('filters options for category=issuer and shows a back link', () => {
    mockSearchParams = new URLSearchParams('category=issuer')
    render(<PublishPage />)

    expect(screen.getByRole('heading', { name: 'Audit / Certification' })).toBeInTheDocument()
    expect(screen.getByText('Publish a security assessment')).toBeInTheDocument()
    expect(screen.getByText('Issue a certification')).toBeInTheDocument()
    expect(screen.queryByText('Authorize a signing key')).not.toBeInTheDocument()
    expect(screen.getByText('← View all attestation types')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open Dashboard' })).not.toBeInTheDocument()
  })

  it('opens the auth dialog when signed-out users click Open Dashboard', () => {
    render(<PublishPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Dashboard' }))

    expect(mockOpenAuthDialog).toHaveBeenCalledWith({
      mode: 'chooser',
      reason: 'navigation',
      redirectTo: '/dashboard',
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('navigates to the dashboard when signed-in users click Open Dashboard', () => {
    mockUseBackendSession.mockReturnValue({
      session: { account: { displayName: 'Jane' } },
      openAuthDialog: mockOpenAuthDialog,
    })

    render(<PublishPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Dashboard' }))

    expect(mockPush).toHaveBeenCalledWith('/dashboard')
    expect(mockOpenAuthDialog).not.toHaveBeenCalled()
  })
})
