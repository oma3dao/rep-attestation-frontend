import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockReplace = vi.fn()
const mockRefreshSession = vi.fn()
const mockLogout = vi.fn()
const mockUseBackendSession = vi.fn()
const mockGetAccountMe = vi.fn()
const mockGetCurrentSubscription = vi.fn()
const mockPatchAccountMe = vi.fn()
const mockCreateSubscriptionCheckoutSession = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
}))

vi.mock('@/components/backend-session-provider', () => ({
  useBackendSession: () => mockUseBackendSession(),
}))

vi.mock('@/lib/omatrust-backend', () => ({
  getAccountMe: (...args: unknown[]) => mockGetAccountMe(...args),
  getCurrentSubscription: (...args: unknown[]) => mockGetCurrentSubscription(...args),
  patchAccountMe: (...args: unknown[]) => mockPatchAccountMe(...args),
  createSubscriptionCheckoutSession: (...args: unknown[]) =>
    mockCreateSubscriptionCheckoutSession(...args),
}))

vi.mock('@/components/ui/button', async () => {
  const React = await import('react')
  const Button = React.forwardRef<HTMLButtonElement, any>(
    ({ children, isConnectButton, connectButtonProps, connectMode, asChild, ...props }, ref) => {
      if (isConnectButton) {
        return (
          <button ref={ref} type="button" {...props}>
            {connectButtonProps?.label ?? 'Connect Wallet'}
          </button>
        )
      }
      return (
        <button ref={ref} type="button" {...props}>
          {children}
        </button>
      )
    }
  )
  Button.displayName = 'Button'
  return { Button }
})

import AccountPage from '@/app/account/page'

const SESSION = {
  account: { displayName: 'Test User' },
  wallet: {
    did: 'did:pkh:eip155:66238:0x1111111111111111111111111111111111111111',
    isManagedWallet: false,
  },
  subscription: { plan: 'free', status: 'active' },
}

const ACCOUNT_ME = {
  account: { id: 'a1', displayName: 'Test User' },
}

const SUBSCRIPTION = {
  subscription: {
    plan: 'free',
    status: 'active',
    annualPremiumReadLimit: 100,
    premiumReadsUsedCurrentYear: 10,
    annualSponsoredWriteLimit: 50,
    sponsoredWritesUsedCurrentYear: 5,
    entitlementPeriodEnd: '2026-12-31T00:00:00.000Z',
  },
}

describe('AccountPage', () => {
  let locationHrefSpy: { get: () => string; set: (v: string) => void }
  let hrefValue = 'http://localhost/account'

  beforeEach(() => {
    vi.clearAllMocks()
    hrefValue = 'http://localhost/account'
    locationHrefSpy = {
      get: () => hrefValue,
      set: (v: string) => {
        hrefValue = v
      },
    }
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href() {
          return locationHrefSpy.get()
        },
        set href(v: string) {
          locationHrefSpy.set(v)
        },
      },
    })

    mockUseBackendSession.mockReturnValue({
      session: SESSION,
      isSessionLoading: false,
      refreshSession: mockRefreshSession,
      logout: mockLogout,
    })
    mockGetAccountMe.mockResolvedValue(ACCOUNT_ME)
    mockGetCurrentSubscription.mockResolvedValue(SUBSCRIPTION)
    mockRefreshSession.mockResolvedValue(SESSION)
    mockLogout.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading and redirects home when unauthenticated', async () => {
    mockUseBackendSession.mockReturnValue({
      session: null,
      isSessionLoading: false,
      refreshSession: mockRefreshSession,
      logout: mockLogout,
    })

    render(<AccountPage />)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/')
    })
  })

  it('loads account and subscription details for a signed-in user', async () => {
    render(<AccountPage />)

    await waitFor(() => {
      expect(mockGetAccountMe).toHaveBeenCalled()
      expect(mockGetCurrentSubscription).toHaveBeenCalled()
    })

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(
      screen.getByText('did:pkh:eip155:66238:0x1111111111111111111111111111111111111111')
    ).toBeInTheDocument()
    expect(screen.getByText('Self-custodial wallet')).toBeInTheDocument()
    expect(screen.getByText(/FREE/)).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument() // reads left
    expect(screen.getByText('45')).toBeInTheDocument() // writes left
    expect(screen.getByRole('button', { name: 'Upgrade' })).toBeInTheDocument()
  })

  it('shows managed wallet label when the session wallet is managed', async () => {
    mockUseBackendSession.mockReturnValue({
      session: {
        ...SESSION,
        wallet: { ...SESSION.wallet, isManagedWallet: true },
      },
      isSessionLoading: false,
      refreshSession: mockRefreshSession,
      logout: mockLogout,
    })

    render(<AccountPage />)

    await waitFor(() => {
      expect(screen.getByText('Managed wallet')).toBeInTheDocument()
    })
  })

  it('edits and saves the display name', async () => {
    mockPatchAccountMe.mockResolvedValue({
      account: { id: 'a1', displayName: 'Updated Name' },
    })

    render(<AccountPage />)

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByPlaceholderText('Your name or organization'), {
      target: { value: 'Updated Name' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockPatchAccountMe).toHaveBeenCalledWith({ displayName: 'Updated Name' })
    })
    await waitFor(() => {
      expect(screen.getByText('Updated Name')).toBeInTheDocument()
    })
    expect(mockRefreshSession).toHaveBeenCalled()
  })

  it('cancels name editing without saving', async () => {
    render(<AccountPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByPlaceholderText('Your name or organization'), {
      target: { value: 'Temp' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(mockPatchAccountMe).not.toHaveBeenCalled()
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('starts checkout when Upgrade is clicked on a free plan', async () => {
    mockCreateSubscriptionCheckoutSession.mockResolvedValue({
      checkoutUrl: 'https://checkout.test/session',
    })

    render(<AccountPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Upgrade' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Upgrade' }))

    await waitFor(() => {
      expect(mockCreateSubscriptionCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: 'paid',
          successUrl: expect.any(String),
          cancelUrl: expect.any(String),
        })
      )
    })
    expect(hrefValue).toBe('https://checkout.test/session')
  })

  it('shows an error when upgrade checkout fails', async () => {
    mockCreateSubscriptionCheckoutSession.mockRejectedValue(new Error('Checkout unavailable'))

    render(<AccountPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Upgrade' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Upgrade' }))

    await waitFor(() => {
      expect(screen.getByText('Checkout unavailable')).toBeInTheDocument()
    })
  })

  it('logs out and navigates home', async () => {
    render(<AccountPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Log Out' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Log Out' }))

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled()
    })
    expect(hrefValue).toBe('/')
  })

  it('shows an error when logout fails', async () => {
    mockLogout.mockRejectedValue(new Error('Logout failed'))

    render(<AccountPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Log Out' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Log Out' }))

    await waitFor(() => {
      expect(screen.getByText('Logout failed')).toBeInTheDocument()
    })
  })

  it('shows a load error when account details fail to fetch', async () => {
    mockGetAccountMe.mockRejectedValue(new Error('Backend down'))

    render(<AccountPage />)

    await waitFor(() => {
      expect(screen.getByText('Backend down')).toBeInTheDocument()
    })
  })

  it('hides Upgrade for paid plans', async () => {
    mockGetCurrentSubscription.mockResolvedValue({
      subscription: {
        ...SUBSCRIPTION.subscription,
        plan: 'paid',
      },
    })

    render(<AccountPage />)

    await waitFor(() => {
      expect(screen.getByText(/PAID/)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Upgrade' })).not.toBeInTheDocument()
  })

  it('saves display name when Enter is pressed in the edit field', async () => {
    mockPatchAccountMe.mockResolvedValue({
      account: { id: 'a1', displayName: 'Enter Saved' },
    })

    render(<AccountPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const input = screen.getByPlaceholderText('Your name or organization')
    fireEvent.change(input, { target: { value: 'Enter Saved' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(mockPatchAccountMe).toHaveBeenCalledWith({ displayName: 'Enter Saved' })
    })
  })

  it('cancels name editing when Escape is pressed', async () => {
    render(<AccountPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const input = screen.getByPlaceholderText('Your name or organization')
    fireEvent.change(input, { target: { value: 'Temporary' } })
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' })

    expect(mockPatchAccountMe).not.toHaveBeenCalled()
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Your name or organization')).not.toBeInTheDocument()
  })

  it('shows Loading without redirecting while the session is still loading', async () => {
    mockUseBackendSession.mockReturnValue({
      session: null,
      isSessionLoading: true,
      refreshSession: mockRefreshSession,
      logout: mockLogout,
    })

    render(<AccountPage />)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
