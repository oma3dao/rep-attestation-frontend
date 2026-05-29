import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const mockUseActiveAccount = vi.fn();
const mockUseActiveWallet = vi.fn();
const mockUseAutoConnect = vi.fn();
const mockDisconnect = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('thirdweb/react', () => ({
  useActiveAccount: () => mockUseActiveAccount(),
  useActiveWallet: () => mockUseActiveWallet(),
  useAutoConnect: () => mockUseAutoConnect(),
  useDisconnect: () => ({ disconnect: mockDisconnect }),
}));

vi.mock('@/app/client', () => ({ client: {} }));
vi.mock('@/config/wallets', () => ({ allWallets: [] }));

const mockClearWalletBrowserState = vi.fn();
vi.mock('@/lib/wallet-cleanup', () => ({
  clearWalletBrowserState: () => mockClearWalletBrowserState(),
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
    getSessionMe: vi.fn(),
    logoutSession: vi.fn(),
    isBackendNetworkError: (e: unknown) =>
      e instanceof BackendApiError && e.code === 'BACKEND_UNREACHABLE',
  };
});

import { BackendSessionProvider, useBackendSession } from '@/components/backend-session-provider';
import { getSessionMe, logoutSession, BackendApiError } from '@/lib/omatrust-backend';

const SESSION = {
  account: { id: 'a1', displayName: 'Jane' },
  wallet: { did: 'did:pkh:eip155:1:0xabc', walletProviderId: null, executionMode: 'native', isManagedWallet: false },
  credential: null,
  subscription: { plan: 'free', status: 'active' },
  client: null,
  primarySubject: null,
};

function wrapper({ children }: { children: React.ReactNode }) {
  return <BackendSessionProvider>{children}</BackendSessionProvider>;
}

describe('backend-session-provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseActiveAccount.mockReturnValue(undefined);
    mockUseActiveWallet.mockReturnValue(undefined);
    mockUseAutoConnect.mockReturnValue({ isLoading: false });
    (getSessionMe as ReturnType<typeof vi.fn>).mockResolvedValue(SESSION);
    (logoutSession as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
  });

  it('throws when used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useBackendSession())).toThrow(
      /useBackendSession must be used within BackendSessionProvider/
    );
    spy.mockRestore();
  });

  it('clears the session and stops loading when autoConnect restores no wallet', async () => {
    const { result } = renderHook(() => useBackendSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSessionLoading).toBe(false);
    });
    expect(result.current.session).toBeNull();
    expect(getSessionMe).not.toHaveBeenCalled();
  });

  it('loads the session when a wallet is connected', async () => {
    mockUseActiveAccount.mockReturnValue({ address: '0xabc' });

    const { result } = renderHook(() => useBackendSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.session).toEqual(SESSION);
    });
    expect(getSessionMe).toHaveBeenCalledTimes(1);
    expect(result.current.isSessionLoading).toBe(false);
  });

  it('treats a 401 from session/me as signed-out', async () => {
    mockUseActiveAccount.mockReturnValue({ address: '0xabc' });
    (getSessionMe as ReturnType<typeof vi.fn>).mockRejectedValue(new BackendApiError('unauthorized', 401));

    const { result } = renderHook(() => useBackendSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSessionLoading).toBe(false);
    });
    expect(result.current.session).toBeNull();
  });

  it('opens and closes the auth dialog with merged request fields', async () => {
    const { result } = renderHook(() => useBackendSession(), { wrapper });

    await waitFor(() => expect(result.current.isSessionLoading).toBe(false));

    act(() => {
      result.current.openAuthDialog({ mode: 'signin', redirectTo: '/dashboard' });
    });
    expect(result.current.authDialog.open).toBe(true);
    expect(result.current.authDialog.mode).toBe('signin');
    expect(result.current.authDialog.redirectTo).toBe('/dashboard');

    act(() => {
      result.current.closeAuthDialog();
    });
    expect(result.current.authDialog.open).toBe(false);
  });

  it('logout clears the session, disconnects the wallet, and cleans browser state', async () => {
    const activeWallet = { id: 'wallet-1' };
    mockUseActiveAccount.mockReturnValue({ address: '0xabc' });
    mockUseActiveWallet.mockReturnValue(activeWallet);

    const { result } = renderHook(() => useBackendSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.session).toEqual(SESSION);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(logoutSession).toHaveBeenCalledTimes(1);
    expect(result.current.session).toBeNull();
    expect(mockDisconnect).toHaveBeenCalledWith(activeWallet);
    expect(mockClearWalletBrowserState).toHaveBeenCalledTimes(1);
  });
});
