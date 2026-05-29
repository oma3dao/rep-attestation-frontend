import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';

vi.mock('thirdweb/react', () => ({
  ThirdwebProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="thirdweb-provider">{children}</div>
  ),
  useActiveAccount: () => null,
  useActiveWallet: () => null,
  useActiveWalletChain: () => null,
  useAutoConnect: () => ({ isLoading: false }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  useConnect: () => ({ connect: vi.fn(), isConnecting: false, error: null }),
  useSwitchActiveWalletChain: () => vi.fn(),
  ConnectButton: () => <button>Connect Wallet</button>,
}));

vi.mock('@tanstack/react-query', () => ({
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="query-client-provider">{children}</div>
  ),
  QueryClient: class {},
}));

vi.mock('@/components/backend-session-provider', () => ({
  BackendSessionProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="backend-session-provider">{children}</div>
  ),
}));

describe('Providers', () => {
  it('renders children and wraps with providers', () => {
    render(
      <Providers>
        <div data-testid="child">Child</div>
      </Providers>
    );
    expect(screen.getByTestId('query-client-provider')).toBeInTheDocument();
    expect(screen.getByTestId('thirdweb-provider')).toBeInTheDocument();
    expect(screen.getByTestId('backend-session-provider')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('nests providers in the expected order (query > thirdweb > backend > children)', () => {
    render(
      <Providers>
        <div data-testid="child">Child</div>
      </Providers>
    );
    const queryProvider = screen.getByTestId('query-client-provider');
    const thirdwebProvider = screen.getByTestId('thirdweb-provider');
    const backendProvider = screen.getByTestId('backend-session-provider');
    const child = screen.getByTestId('child');

    expect(queryProvider).toContainElement(thirdwebProvider);
    expect(thirdwebProvider).toContainElement(backendProvider);
    expect(backendProvider).toContainElement(child);
  });
}); 