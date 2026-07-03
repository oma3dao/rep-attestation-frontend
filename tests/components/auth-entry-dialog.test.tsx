import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockUseActiveAccount = vi.fn();
const mockUseActiveWallet = vi.fn();
const mockDisconnect = vi.fn();
const mockConnect = vi.fn();
const routerPush = vi.fn();

const mockRefreshSession = vi.fn();
const mockSetSession = vi.fn();

const mockCreateWalletChallenge = vi.fn();
const mockVerifyWalletSession = vi.fn();
const mockRegisterWalletSession = vi.fn();
const mockPatchAccountMe = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock('thirdweb/react', () => ({
  useActiveAccount: () => mockUseActiveAccount(),
  useActiveWallet: () => mockUseActiveWallet(),
  useDisconnect: () => ({ disconnect: mockDisconnect }),
  useConnectModal: () => ({ connect: mockConnect, isConnecting: false }),
}));

vi.mock('thirdweb/chains', () => ({
  defineChain: (x: unknown) => x,
}));

vi.mock('@/app/client', () => ({ client: {} }));
vi.mock('@/config/wallets', () => ({ allWallets: [], nativeWallets: [] }));
vi.mock('@/lib/wallet-cleanup', () => ({ clearWalletBrowserState: vi.fn() }));
vi.mock('@/lib/blockchain', () => ({ getActiveChain: () => ({ id: 1 }) }));

vi.mock('@/components/backend-session-provider', () => ({
  useBackendSession: () => ({
    refreshSession: mockRefreshSession,
    session: null,
    setSession: mockSetSession,
  }),
}));

vi.mock('@/lib/omatrust-backend', () => {
  class BackendApiError extends Error {
    status: number;
    code?: string;
    details?: string;
    constructor(message: string, status: number, code?: string, details?: string) {
      super(message);
      this.name = 'BackendApiError';
      this.status = status;
      this.code = code;
      this.details = details;
    }
  }
  return {
    BackendApiError,
    buildWalletDid: (address: string, chainId: number) => `did:pkh:eip155:${chainId}:${address}`,
    createSubject: vi.fn(),
    createWalletChallenge: (...args: unknown[]) => mockCreateWalletChallenge(...args),
    deriveDidWebFromInput: (input: string) => (input ? `did:web:${input}` : null),
    deriveSubjectUrlHint: (input?: string | null) => input ?? '',
    listSubjects: vi.fn(),
    patchAccountMe: (...args: unknown[]) => mockPatchAccountMe(...args),
    registerWalletSession: (...args: unknown[]) => mockRegisterWalletSession(...args),
    verifySubjectOwnership: vi.fn(),
    verifyWalletSession: (...args: unknown[]) => mockVerifyWalletSession(...args),
  };
});

import { AuthEntryDialog } from '@/components/auth-entry-dialog';
import { BackendApiError } from '@/lib/omatrust-backend';
import type { AuthDialogRequest } from '@/components/backend-session-provider';

function makeRequest(overrides: Partial<AuthDialogRequest> = {}): AuthDialogRequest {
  return {
    open: true,
    mode: 'chooser',
    reason: 'navigation',
    ...overrides,
  };
}

describe('AuthEntryDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseActiveAccount.mockReturnValue(undefined);
    mockUseActiveWallet.mockReturnValue(undefined);
  });

  it('renders the chooser with both account options', () => {
    render(<AuthEntryDialog request={makeRequest()} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Existing account')).toBeInTheDocument();
    expect(screen.getByText('New account')).toBeInTheDocument();
  });

  it('renders the sign-in step for mode "signin"', () => {
    render(<AuthEntryDialog request={makeRequest({ mode: 'signin' })} onOpenChange={vi.fn()} />);
    expect(screen.getAllByText('Sign In').length).toBeGreaterThan(0);
    expect(screen.queryByText('New account')).not.toBeInTheDocument();
  });

  it('renders the create-account step for mode "signup"', () => {
    render(<AuthEntryDialog request={makeRequest({ mode: 'signup' })} onOpenChange={vi.fn()} />);
    expect(screen.getByLabelText('Display name')).toBeInTheDocument();
  });

  it('renders a hint message when present', () => {
    render(
      <AuthEntryDialog
        request={makeRequest({ hintMessage: 'Please sign in to continue' })}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByText('Please sign in to continue')).toBeInTheDocument();
  });

  it('navigates from the chooser to the create-account step', () => {
    render(<AuthEntryDialog request={makeRequest()} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getByLabelText('Display name')).toBeInTheDocument();
  });

  it('keeps Create Account disabled until a display name is entered', () => {
    render(<AuthEntryDialog request={makeRequest({ mode: 'signup' })} onOpenChange={vi.fn()} />);
    const createButton = screen.getByRole('button', { name: 'Create Account' });
    expect(createButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Jane' } });
    expect(createButton).toBeEnabled();
  });

  it('runs the sign-in challenge/verify flow and navigates on success', async () => {
    const signMessage = vi.fn().mockResolvedValue('0xsignature');
    mockUseActiveAccount.mockReturnValue({ address: '0xabc', signMessage });
    mockUseActiveWallet.mockReturnValue({ id: 'io.metamask' });
    mockCreateWalletChallenge.mockResolvedValue({
      challengeId: 'c1',
      siweMessage: 'sign this',
      nonce: 'n1',
      expiresAt: 'later',
    });
    mockVerifyWalletSession.mockResolvedValue({});
    mockRefreshSession.mockResolvedValue({ account: { id: 'a1', displayName: 'Jane' } });

    const onOpenChange = vi.fn();
    render(<AuthEntryDialog request={makeRequest({ mode: 'signin' })} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockCreateWalletChallenge).toHaveBeenCalled();
    });
    expect(signMessage).toHaveBeenCalledWith({ message: 'sign this' });
    await waitFor(() => {
      expect(mockVerifyWalletSession).toHaveBeenCalledWith(
        expect.objectContaining({ challengeId: 'c1', walletDid: 'did:pkh:eip155:1:0xabc' })
      );
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(routerPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows a friendly error when the challenge request fails', async () => {
    mockUseActiveAccount.mockReturnValue({ address: '0xabc', signMessage: vi.fn() });
    mockUseActiveWallet.mockReturnValue({ id: 'io.metamask' });
    mockCreateWalletChallenge.mockRejectedValue(new BackendApiError('nope', 401, 'INVALID_CHALLENGE'));

    render(<AuthEntryDialog request={makeRequest({ mode: 'signin' })} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText(/expired or became invalid/i)).toBeInTheDocument();
    });
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
