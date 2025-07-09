// Unit test for selectAttestationService logic
// Covers: service selection based on chain and preferences, with mocks

// Use Vitest globals
import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import * as attestationServices from '@/config/attestation-services';
import * as walletModule from './blockchain';
import * as basModule from './bas';
import { useAttestation } from './service';

// Mock @/app/client to provide a dummy clientId
vi.mock('@/app/client', () => ({ default: { clientId: 'dummy-client-id' } }));

// Mock thirdweb/react to avoid <ThirdwebProvider> errors
vi.mock('thirdweb/react', () => ({
  useActiveAccount: vi.fn(),
  useActiveWallet: vi.fn(),
  useActiveWalletChain: vi.fn(),
}));

// Minimal valid AttestationData for tests
const validAttestationData = { schemaId: 'schema', recipient: 'did:web:example.com', data: {} };
function mockWallet(overrides = {}) {
  return {
    isConnected: true,
    address: '0xabc',
    chainId: 1,
    isChainSupported: true,
    isAttestationSupported: true,
    account: undefined,
    chain: undefined,
    supportedChainIds: [1],
    ...overrides,
  };
}
function mockBASClient(overrides = {}) {
  return {
    createAttestation: vi.fn(),
    revokeAttestation: vi.fn(),
    getAttestation: vi.fn(),
    registerSchema: vi.fn(),
    getSchema: vi.fn(),
    estimateGas: vi.fn(),
    isConnected: true,
    isChainSupported: true,
    getCurrentChain: vi.fn(),
    contractAddress: '0xcontract',
    supportedChains: [1],
    ...overrides,
  };
}

// Copy selectAttestationService for isolated testing
function selectAttestationService(chainId: number, preferredService?: string) {
  const availableServices = attestationServices.getServicesForChain(chainId);
  if (preferredService) {
    const preferredServiceConfig = attestationServices.getAttestationService(preferredService);
    if (preferredServiceConfig?.supportedChains.includes(chainId)) {
      return preferredService;
    }
  }
  if (availableServices.length > 0) {
    return availableServices[0].id;
  }
  return 'bas';
}

// Copy isServiceAvailable for isolated testing
function isServiceAvailable(serviceId: any) {
  const service = attestationServices.getAttestationService(serviceId);
  if (!service) return false;
  switch (serviceId) {
    case 'bas':
      return true;
    default:
      return false;
  }
}

describe('selectAttestationService logic', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns preferredService if supported', () => {
    vi.spyOn(attestationServices, 'getAttestationService').mockReturnValue({
      id: 'bas',
      name: 'Binance Attestation Service',
      description: '',
      website: '',
      docs: '',
      supportedChains: [1, 2],
      contracts: {},
      features: [],
    });
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([]);
    expect(selectAttestationService(1, 'bas')).toBe('bas');
  });

  it('returns first available service if preferred not supported', () => {
    vi.spyOn(attestationServices, 'getAttestationService').mockReturnValue({
      id: 'bas',
      name: 'Binance Attestation Service',
      description: '',
      website: '',
      docs: '',
      supportedChains: [2],
      contracts: {},
      features: [],
    });
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([
      { id: 'bas', name: '', description: '', website: '', docs: '', supportedChains: [], contracts: {}, features: [] },
      { id: 'other', name: '', description: '', website: '', docs: '', supportedChains: [], contracts: {}, features: [] },
    ]);
    expect(selectAttestationService(1, 'bas')).toBe('bas');
  });

  it('returns bas if no services available', () => {
    vi.spyOn(attestationServices, 'getAttestationService').mockReturnValue(undefined);
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([]);
    expect(selectAttestationService(99, undefined)).toBe('bas');
  });
});

describe('isServiceAvailable', () => {
  afterEach(() => vi.restoreAllMocks());
  it('returns true for bas', () => {
    vi.spyOn(attestationServices, 'getAttestationService').mockReturnValue({ id: 'bas', name: '', description: '', website: '', docs: '', supportedChains: [], contracts: {}, features: [] });
    expect(isServiceAvailable('bas')).toBe(true);
  });
  it('returns false for unknown service', () => {
    vi.spyOn(attestationServices, 'getAttestationService').mockReturnValue({ id: 'foo', name: '', description: '', website: '', docs: '', supportedChains: [], contracts: {}, features: [] });
    expect(isServiceAvailable('foo')).toBe(false);
  });
  it('returns false for missing service', () => {
    vi.spyOn(attestationServices, 'getAttestationService').mockReturnValue(undefined);
    expect(isServiceAvailable('bas')).toBe(false);
  });
});

describe('useAttestation hook', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws if not connected', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue(mockWallet({ isConnected: false }));
    let result;
    await act(async () => {
      result = renderHook(() => useAttestation());
    });
    await expect(result.result.current.submitAttestation(validAttestationData)).rejects.toThrow(/Wallet not connected/);
  });

  it('throws if service not available', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue(mockWallet());
    vi.spyOn(basModule, 'useBASClient').mockReturnValue(mockBASClient());
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([]);
    vi.spyOn(attestationServices, 'getAttestationService').mockReturnValue(undefined);
    let result;
    await act(async () => {
      result = renderHook(() => useAttestation());
    });
    await expect(result.result.current.submitAttestation(validAttestationData)).rejects.toThrow(/not yet available/);
  });

  it('throws for unsupported service', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue(mockWallet());
    vi.spyOn(basModule, 'useBASClient').mockReturnValue(mockBASClient());
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([{ id: 'foo', name: '', description: '', website: '', docs: '', supportedChains: [1], contracts: {}, features: [] }]);
    vi.spyOn(attestationServices, 'getAttestationService').mockImplementation((id) => id === 'foo' ? { id: 'foo', name: '', description: '', website: '', docs: '', supportedChains: [1], contracts: {}, features: [] } : undefined);
    let result;
    await act(async () => {
      result = renderHook(() => useAttestation());
    });
    await expect(result.result.current.submitAttestation(validAttestationData, undefined, 'foo')).rejects.toThrow('Service foo is not yet available');
  });

  it('sets isSubmitting, lastResult, lastError, and clears them', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue(mockWallet());
    const fakeResult = { transactionHash: '0xabc' };
    vi.spyOn(basModule, 'useBASClient').mockReturnValue(mockBASClient({ createAttestation: vi.fn().mockResolvedValue(fakeResult) }));
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([{ id: 'bas', name: '', description: '', website: '', docs: '', supportedChains: [1], contracts: {}, features: [] }]);
    vi.spyOn(attestationServices, 'getAttestationService').mockReturnValue({ id: 'bas', name: '', description: '', website: '', docs: '', supportedChains: [1], contracts: {}, features: [] });
    let result;
    await act(async () => {
      result = renderHook(() => useAttestation());
    });
    let promise;
    await act(async () => {
      promise = result.result.current.submitAttestation(validAttestationData);
      await promise;
    });
    expect(result.result.current.isSubmitting).toBe(false);
    expect(result.result.current.lastResult).toEqual(fakeResult);
    expect(result.result.current.lastError).toBeNull();
    act(() => result.result.current.clearResult());
    expect(result.result.current.lastResult).toBeNull();
    act(() => result.result.current.clearError());
    expect(result.result.current.lastError).toBeNull();
  });

  it('sets lastError on error', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue(mockWallet());
    vi.spyOn(basModule, 'useBASClient').mockReturnValue(mockBASClient({ createAttestation: vi.fn().mockRejectedValue(new Error('fail')) }));
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([{ id: 'bas', name: '', description: '', website: '', docs: '', supportedChains: [1], contracts: {}, features: [] }]);
    vi.spyOn(attestationServices, 'getAttestationService').mockReturnValue({ id: 'bas', name: '', description: '', website: '', docs: '', supportedChains: [1], contracts: {}, features: [] });
    let result;
    await act(async () => {
      result = renderHook(() => useAttestation());
    });
    await act(async () => {
      await expect(result.result.current.submitAttestation(validAttestationData)).rejects.toThrow('fail');
    });
    expect(result.result.current.lastError).toBe('fail');
  });

  it('returns correct service info', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue(mockWallet());
    vi.spyOn(basModule, 'useBASClient').mockReturnValue(mockBASClient());
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([{ id: 'bas', name: 'BAS', description: 'desc', website: '', docs: '', supportedChains: [1], contracts: {}, features: [] }]);
    vi.spyOn(attestationServices, 'getAttestationService').mockReturnValue({ id: 'bas', name: 'BAS', description: 'desc', website: '', docs: '', supportedChains: [1], contracts: {}, features: [] });
    let result;
    await act(async () => {
      result = renderHook(() => useAttestation());
    });
    expect(result.result.current.isNetworkSupported).toBe(true);
    expect(result.result.current.availableServices.length).toBe(1);
    expect(result.result.current.recommendedService.id).toBe('bas');
  });
}); 