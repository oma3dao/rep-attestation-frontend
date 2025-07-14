import React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { Header } from '../../src/components/header';
import { act } from 'react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));
vi.mock('@/lib/blockchain', () => ({
  useWallet: () => ({ isConnected: false, isChainSupported: true, chain: null }),
}));
vi.mock('thirdweb/react', () => ({
  useActiveAccount: () => null,
  useActiveWallet: () => null,
  useActiveWalletChain: () => null,
  useSwitchActiveWalletChain: () => null,
  ConnectButton: () => <button>Connect Wallet</button>,
}));
vi.mock('@/app/client', () => ({ client: {} }));

describe('Header', () => {
  it('renders logo and navigation links', async () => {
    await act(async () => {
      render(<Header />);
    });
    expect(screen.getByAltText('OMA3 Logo')).not.toBeNull();
    expect(screen.getByText('Attestation Portal')).not.toBeNull();
    expect(screen.getByText('Home')).not.toBeNull();
    expect(screen.getByText('Create Attestation')).not.toBeNull();
    expect(screen.getByText('Dashboard')).not.toBeNull();
  });

  it('renders wallet connect button', async () => {
    await act(async () => {
      render(<Header />);
    });
    expect(screen.getByText(/connect wallet/i)).not.toBeNull();
  });

  it('shows network warning when not supported', async () => {
    vi.mock('@/lib/blockchain', () => ({
      useWallet: () => ({ isConnected: true, isChainSupported: false, chain: null }),
    }));
    await act(async () => {
      render(<Header />);
    });
    expect(screen.getByText(/wrong network/i)).not.toBeNull();
  });
}); 