import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearWalletBrowserState } from '@/lib/wallet-cleanup';

describe('clearWalletBrowserState', () => {
  let deleteDatabase: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    deleteDatabase = vi.fn();
    // jsdom does not implement indexedDB; provide a stub.
    vi.stubGlobal('indexedDB', { deleteDatabase });
  });

  it('deletes the WalletConnect v2 IndexedDB database', () => {
    clearWalletBrowserState();
    expect(deleteDatabase).toHaveBeenCalledWith('WALLET_CONNECT_V2_INDEXED_DB');
  });

  it('removes thirdweb: and wc@2: localStorage keys but keeps others', () => {
    localStorage.setItem('thirdweb:active-wallet', '1');
    localStorage.setItem('wc@2:core:session', '1');
    localStorage.setItem('unrelated-key', 'keep');

    clearWalletBrowserState();

    expect(localStorage.getItem('thirdweb:active-wallet')).toBeNull();
    expect(localStorage.getItem('wc@2:core:session')).toBeNull();
    expect(localStorage.getItem('unrelated-key')).toBe('keep');
  });

  it('swallows IndexedDB deletion errors and still cleans localStorage', () => {
    deleteDatabase.mockImplementation(() => {
      throw new Error('blocked by open connection');
    });
    localStorage.setItem('thirdweb:x', '1');

    expect(() => clearWalletBrowserState()).not.toThrow();
    expect(localStorage.getItem('thirdweb:x')).toBeNull();
  });
});
