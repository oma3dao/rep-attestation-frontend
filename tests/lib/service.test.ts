// Unit test for selectAttestationService logic
// Covers: service selection based on chain and preferences, with mocks

// Use Vitest globals
import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import * as attestationServices from '@/config/attestation-services';
import * as walletModule from '@/lib/blockchain';
import * as basModule from '@/lib/bas';
import * as easModule from '@/lib/eas';
import { useAttestation } from '@/lib/service';

// Mock @/app/client to provide a dummy clientId
vi.mock('@/app/client', () => ({ default: { clientId: 'dummy-client-id' } }));

// Mock thirdweb/react to avoid <ThirdwebProvider> errors
vi.mock('thirdweb/react', () => ({
  useActiveAccount: vi.fn(),
  useActiveWallet: vi.fn(),
  useActiveWalletChain: vi.fn(),
}));

// The EAS client now reads the backend session; provide a benign default so the
// hook can mount outside of a BackendSessionProvider.
vi.mock('@/components/backend-session-provider', () => ({
  useBackendSession: () => ({ session: null }),
}));

// Minimal valid AttestationData for tests
const validAttestationData = { schemaId: 'schema', recipient: 'did:web:example.com', data: {} };
function mockWallet(overrides = {}): ReturnType<typeof walletModule.useWallet> {
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
  } as any;
}
function mockBASClient(overrides = {}): any {
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
  } as any;
}

// NOTE: selectAttestationService and isServiceAvailable are intentionally not
// imported or duplicated here. They are private helpers in @/lib/service and
// their behavior is exercised indirectly through the useAttestation hook
// tests below (service selection, throws-when-unavailable, EAS preference, etc.).

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
    await expect(result!.result.current.submitAttestation(validAttestationData)).rejects.toThrow(/Wallet not connected/);
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
    await expect(result!.result.current.submitAttestation(validAttestationData)).rejects.toThrow(/not yet available/);
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
    await expect(result!.result.current.submitAttestation(validAttestationData, undefined, 'foo')).rejects.toThrow('Service foo is not yet available');
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
      promise = result!.result.current.submitAttestation(validAttestationData);
      await promise;
    });
    expect(result!.result.current.isSubmitting).toBe(false);
    expect(result!.result.current.lastResult).toEqual(fakeResult);
    expect(result!.result.current.lastError).toBeNull();
    act(() => result!.result.current.clearResult());
    expect(result!.result.current.lastResult).toBeNull();
    act(() => result!.result.current.clearError());
    expect(result!.result.current.lastError).toBeNull();
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
      await expect(result!.result.current.submitAttestation(validAttestationData)).rejects.toThrow('fail');
    });
    expect(result!.result.current.lastError).toBe('fail');
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
    expect(result!.result.current.isNetworkSupported).toBe(true);
    expect(result!.result.current.availableServices.length).toBe(1);
    expect(result!.result.current.recommendedService.id).toBe('bas');
  });

  it('uses EAS when chain supports EAS and preferredNetwork selects it', async () => {
    const easCreateAttestation = vi.fn().mockResolvedValue({ transactionHash: '0xea5' });
    vi.spyOn(walletModule, 'useWallet').mockReturnValue(mockWallet({ chainId: 66238 }));
    vi.spyOn(basModule, 'useBASClient').mockReturnValue(mockBASClient());
    vi.spyOn(easModule, 'useEASClient').mockReturnValue({ createAttestation: easCreateAttestation } as any);
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([
      { id: 'eas', name: 'EAS', description: '', website: '', docs: '', supportedChains: [66238], contracts: {}, features: [] },
    ]);
    vi.spyOn(attestationServices, 'getAttestationService').mockImplementation((id) =>
      id === 'eas' ? { id: 'eas', name: 'EAS', description: '', website: '', docs: '', supportedChains: [66238], contracts: {}, features: [] } : undefined
    );
    let result;
    await act(async () => {
      result = renderHook(() => useAttestation());
    });
    await act(async () => {
      await result!.result.current.submitAttestation(validAttestationData, 66238);
    });
    expect(easCreateAttestation).toHaveBeenCalledWith(validAttestationData);
    expect(result!.result.current.lastResult).toEqual({ transactionHash: '0xea5' });
  });
});

describe('controller witness integration in useAttestation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Regression guard: the controller-witness flow has been moved out of
  // useAttestation. A single test is sufficient to catch accidental
  // reintroduction; we deliberately do NOT use setTimeout-based waits since
  // the call should never be queued in the first place.
  it('does not invoke callControllerWitness from useAttestation, even for witness-configured schemas', async () => {
    const fakeResult = { transactionHash: '0xabc', attestationId: '0xattest123' };
    const easCreateAttestation = vi.fn().mockResolvedValue(fakeResult);

    vi.spyOn(walletModule, 'useWallet').mockReturnValue(mockWallet({ chainId: 66238 }));
    vi.spyOn(basModule, 'useBASClient').mockReturnValue(mockBASClient());
    vi.spyOn(easModule, 'useEASClient').mockReturnValue({ createAttestation: easCreateAttestation } as any);
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([
      { id: 'eas', name: 'EAS', description: '', website: '', docs: '', supportedChains: [66238], contracts: { 66238: '0xeascontract' }, features: [] },
    ]);
    vi.spyOn(attestationServices, 'getAttestationService').mockImplementation((id) =>
      id === 'eas'
        ? { id: 'eas', name: 'EAS', description: '', website: '', docs: '', supportedChains: [66238], contracts: { 66238: '0xeascontract' }, features: [] }
        : undefined
    );
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xeascontract');

    const schemasModule = await import('@/config/schemas');
    vi.spyOn(schemasModule, 'getSchema').mockReturnValue({
      id: 'key-binding',
      title: 'Key Binding',
      description: '',
      fields: [],
      witness: { subjectField: 'subject', controllerField: 'keyId' },
      deployedUIDs: { 66238: '0xschemauid' },
    } as any);

    const cwModule = await import('@/lib/controller-witness-client');
    const witnessSpy = vi.spyOn(cwModule, 'callControllerWitness').mockResolvedValue(undefined);

    const attestationData = {
      schemaId: 'key-binding',
      recipient: 'did:web:example.com',
      data: {
        subject: 'did:web:example.com',
        keyId: 'did:pkh:eip155:1:0xabc',
      },
    };

    let result;
    await act(async () => {
      result = renderHook(() => useAttestation());
    });
    await act(async () => {
      await result!.result.current.submitAttestation(attestationData, 66238);
    });

    expect(easCreateAttestation).toHaveBeenCalledWith(attestationData);
    expect(result!.result.current.lastResult).toEqual(fakeResult);
    expect(result!.result.current.lastError).toBeNull();
    expect(witnessSpy).not.toHaveBeenCalled();
  });
});
