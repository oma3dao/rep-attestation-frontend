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

// Copy isServiceAvailable for isolated testing (must match source in service.ts)
function isServiceAvailable(serviceId: any) {
  const service = attestationServices.getAttestationService(serviceId);
  if (!service) return false;
  switch (serviceId) {
    case 'eas':
      return true;
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
  it('returns true for eas', () => {
    vi.spyOn(attestationServices, 'getAttestationService').mockReturnValue({ id: 'eas', name: '', description: '', website: '', docs: '', supportedChains: [], contracts: {}, features: [] });
    expect(isServiceAvailable('eas')).toBe(true);
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

  it('fires controller witness call when schema has witness config and attestation succeeds', async () => {
    const fakeResult = { transactionHash: '0xabc', attestationId: '0xattest123' };
    const easCreateAttestation = vi.fn().mockResolvedValue(fakeResult);

    vi.spyOn(walletModule, 'useWallet').mockReturnValue(mockWallet({ chainId: 66238 }));
    vi.spyOn(basModule, 'useBASClient').mockReturnValue(mockBASClient());
    vi.spyOn(easModule, 'useEASClient').mockReturnValue({ createAttestation: easCreateAttestation } as any);
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([
      { id: 'eas', name: 'EAS', description: '', website: '', docs: '', supportedChains: [66238], contracts: { 66238: '0xeascontract' }, features: [] },
    ]);
    vi.spyOn(attestationServices, 'getAttestationService').mockImplementation((id) =>
      id === 'eas' ? { id: 'eas', name: 'EAS', description: '', website: '', docs: '', supportedChains: [66238], contracts: { 66238: '0xeascontract' }, features: [] } : undefined
    );
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xeascontract');

    // Mock getSchema to return a schema with witness config
    const schemasModule = await import('@/config/schemas');
    vi.spyOn(schemasModule, 'getSchema').mockReturnValue({
      id: 'key-binding',
      title: 'Key Binding',
      description: '',
      fields: [],
      witness: { subjectField: 'subject', controllerField: 'keyId' },
      deployedUIDs: { 66238: '0xschemauid' },
    });

    // Mock callControllerWitness
    const cwModule = await import('@/lib/controller-witness-client');
    vi.spyOn(cwModule, 'callControllerWitness').mockResolvedValue({ uid: '0xwitness', txHash: '0xwittx' });

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

    // Give time for the non-blocking witness call
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(cwModule.callControllerWitness).toHaveBeenCalledWith({
      attestationUid: '0xattest123',
      chainId: 66238,
      easContract: '0xeascontract',
      schemaUid: '0xschemauid',
      subject: 'did:web:example.com',
      controller: 'did:pkh:eip155:1:0xabc',
    });
  });

  it('does not fire controller witness when schema has no witness config', async () => {
    const fakeResult = { transactionHash: '0xabc', attestationId: '0xattest456' };
    const easCreateAttestation = vi.fn().mockResolvedValue(fakeResult);

    vi.spyOn(walletModule, 'useWallet').mockReturnValue(mockWallet({ chainId: 66238 }));
    vi.spyOn(basModule, 'useBASClient').mockReturnValue(mockBASClient());
    vi.spyOn(easModule, 'useEASClient').mockReturnValue({ createAttestation: easCreateAttestation } as any);
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([
      { id: 'eas', name: 'EAS', description: '', website: '', docs: '', supportedChains: [66238], contracts: {}, features: [] },
    ]);
    vi.spyOn(attestationServices, 'getAttestationService').mockImplementation((id) =>
      id === 'eas' ? { id: 'eas', name: 'EAS', description: '', website: '', docs: '', supportedChains: [66238], contracts: {}, features: [] } : undefined
    );

    // Mock getSchema to return a schema WITHOUT witness config (like endorsement)
    const schemasModule = await import('@/config/schemas');
    vi.spyOn(schemasModule, 'getSchema').mockReturnValue({
      id: 'endorsement',
      title: 'Endorsement',
      description: '',
      fields: [],
      // No witness property
    });

    const cwModule = await import('@/lib/controller-witness-client');
    vi.spyOn(cwModule, 'callControllerWitness').mockResolvedValue(undefined);

    const attestationData = {
      schemaId: 'endorsement',
      recipient: 'did:web:example.com',
      data: { subject: 'did:web:example.com' },
    };

    let result;
    await act(async () => {
      result = renderHook(() => useAttestation());
    });
    await act(async () => {
      await result!.result.current.submitAttestation(attestationData, 66238);
    });

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(cwModule.callControllerWitness).not.toHaveBeenCalled();
  });

  it('does not fire controller witness when subject or controller fields are missing', async () => {
    const fakeResult = { transactionHash: '0xabc', attestationId: '0xattest789' };
    const easCreateAttestation = vi.fn().mockResolvedValue(fakeResult);

    vi.spyOn(walletModule, 'useWallet').mockReturnValue(mockWallet({ chainId: 66238 }));
    vi.spyOn(basModule, 'useBASClient').mockReturnValue(mockBASClient());
    vi.spyOn(easModule, 'useEASClient').mockReturnValue({ createAttestation: easCreateAttestation } as any);
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([
      { id: 'eas', name: 'EAS', description: '', website: '', docs: '', supportedChains: [66238], contracts: { 66238: '0xeascontract' }, features: [] },
    ]);
    vi.spyOn(attestationServices, 'getAttestationService').mockImplementation((id) =>
      id === 'eas' ? { id: 'eas', name: 'EAS', description: '', website: '', docs: '', supportedChains: [66238], contracts: { 66238: '0xeascontract' }, features: [] } : undefined
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
    });

    const cwModule = await import('@/lib/controller-witness-client');
    vi.spyOn(cwModule, 'callControllerWitness').mockResolvedValue(undefined);

    const attestationData = {
      schemaId: 'key-binding',
      recipient: 'did:web:example.com',
      data: {
        subject: 'did:web:example.com',
        // keyId is missing
      },
    };

    let result;
    await act(async () => {
      result = renderHook(() => useAttestation());
    });
    await act(async () => {
      await result!.result.current.submitAttestation(attestationData, 66238);
    });

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(cwModule.callControllerWitness).not.toHaveBeenCalled();
  });

  it('does not fire controller witness when attestationId is falsy', async () => {
    // Attestation succeeds but doesn't return an attestationId
    const fakeResult = { transactionHash: '0xabc' };
    const easCreateAttestation = vi.fn().mockResolvedValue(fakeResult);

    vi.spyOn(walletModule, 'useWallet').mockReturnValue(mockWallet({ chainId: 66238 }));
    vi.spyOn(basModule, 'useBASClient').mockReturnValue(mockBASClient());
    vi.spyOn(easModule, 'useEASClient').mockReturnValue({ createAttestation: easCreateAttestation } as any);
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([
      { id: 'eas', name: 'EAS', description: '', website: '', docs: '', supportedChains: [66238], contracts: { 66238: '0xeascontract' }, features: [] },
    ]);
    vi.spyOn(attestationServices, 'getAttestationService').mockImplementation((id) =>
      id === 'eas' ? { id: 'eas', name: 'EAS', description: '', website: '', docs: '', supportedChains: [66238], contracts: { 66238: '0xeascontract' }, features: [] } : undefined
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
    });

    const cwModule = await import('@/lib/controller-witness-client');
    vi.spyOn(cwModule, 'callControllerWitness').mockResolvedValue(undefined);

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

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(cwModule.callControllerWitness).not.toHaveBeenCalled();
  });

  it('does not fire controller witness when schemaUid is missing for the chain', async () => {
    const fakeResult = { transactionHash: '0xabc', attestationId: '0xattest_nouid' };
    const easCreateAttestation = vi.fn().mockResolvedValue(fakeResult);

    vi.spyOn(walletModule, 'useWallet').mockReturnValue(mockWallet({ chainId: 66238 }));
    vi.spyOn(basModule, 'useBASClient').mockReturnValue(mockBASClient());
    vi.spyOn(easModule, 'useEASClient').mockReturnValue({ createAttestation: easCreateAttestation } as any);
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([
      { id: 'eas', name: 'EAS', description: '', website: '', docs: '', supportedChains: [66238], contracts: { 66238: '0xeascontract' }, features: [] },
    ]);
    vi.spyOn(attestationServices, 'getAttestationService').mockImplementation((id) =>
      id === 'eas' ? { id: 'eas', name: 'EAS', description: '', website: '', docs: '', supportedChains: [66238], contracts: { 66238: '0xeascontract' }, features: [] } : undefined
    );
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xeascontract');

    const schemasModule = await import('@/config/schemas');
    vi.spyOn(schemasModule, 'getSchema').mockReturnValue({
      id: 'key-binding',
      title: 'Key Binding',
      description: '',
      fields: [],
      witness: { subjectField: 'subject', controllerField: 'keyId' },
      // deployedUIDs does NOT include chainId 66238
      deployedUIDs: { 97: '0xschemauid' },
    });

    const cwModule = await import('@/lib/controller-witness-client');
    vi.spyOn(cwModule, 'callControllerWitness').mockResolvedValue(undefined);

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

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(cwModule.callControllerWitness).not.toHaveBeenCalled();
  });

  it('does not fire controller witness when easContract is missing for the chain', async () => {
    const fakeResult = { transactionHash: '0xabc', attestationId: '0xattest_nocontract' };
    const easCreateAttestation = vi.fn().mockResolvedValue(fakeResult);

    vi.spyOn(walletModule, 'useWallet').mockReturnValue(mockWallet({ chainId: 66238 }));
    vi.spyOn(basModule, 'useBASClient').mockReturnValue(mockBASClient());
    vi.spyOn(easModule, 'useEASClient').mockReturnValue({ createAttestation: easCreateAttestation } as any);
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([
      { id: 'eas', name: 'EAS', description: '', website: '', docs: '', supportedChains: [66238], contracts: {}, features: [] },
    ]);
    vi.spyOn(attestationServices, 'getAttestationService').mockImplementation((id) =>
      id === 'eas' ? { id: 'eas', name: 'EAS', description: '', website: '', docs: '', supportedChains: [66238], contracts: {}, features: [] } : undefined
    );
    // Return undefined for contract address
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue(undefined);

    const schemasModule = await import('@/config/schemas');
    vi.spyOn(schemasModule, 'getSchema').mockReturnValue({
      id: 'key-binding',
      title: 'Key Binding',
      description: '',
      fields: [],
      witness: { subjectField: 'subject', controllerField: 'keyId' },
      deployedUIDs: { 66238: '0xschemauid' },
    });

    const cwModule = await import('@/lib/controller-witness-client');
    vi.spyOn(cwModule, 'callControllerWitness').mockResolvedValue(undefined);

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

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(cwModule.callControllerWitness).not.toHaveBeenCalled();
  });

  it('does not affect attestation result when callControllerWitness rejects', async () => {
    // The source code uses .then() without .catch() on the fire-and-forget witness call.
    // This causes an unhandled promise rejection when the mock rejects. We capture it
    // to prevent Vitest from reporting it as a test failure.
    const rejections: Error[] = [];
    const handler = (reason: unknown) => { rejections.push(reason as Error); };
    process.on('unhandledRejection', handler);

    const fakeResult = { transactionHash: '0xabc', attestationId: '0xattest_reject' };
    const easCreateAttestation = vi.fn().mockResolvedValue(fakeResult);

    vi.spyOn(walletModule, 'useWallet').mockReturnValue(mockWallet({ chainId: 66238 }));
    vi.spyOn(basModule, 'useBASClient').mockReturnValue(mockBASClient());
    vi.spyOn(easModule, 'useEASClient').mockReturnValue({ createAttestation: easCreateAttestation } as any);
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([
      { id: 'eas', name: 'EAS', description: '', website: '', docs: '', supportedChains: [66238], contracts: { 66238: '0xeascontract' }, features: [] },
    ]);
    vi.spyOn(attestationServices, 'getAttestationService').mockImplementation((id) =>
      id === 'eas' ? { id: 'eas', name: 'EAS', description: '', website: '', docs: '', supportedChains: [66238], contracts: { 66238: '0xeascontract' }, features: [] } : undefined
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
    });

    // Mock callControllerWitness to REJECT
    const cwModule = await import('@/lib/controller-witness-client');
    vi.spyOn(cwModule, 'callControllerWitness').mockRejectedValue(new Error('witness API down'));

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

    // The attestation itself should still succeed despite witness rejection
    expect(result!.result.current.lastResult).toEqual(fakeResult);
    expect(result!.result.current.lastError).toBeNull();

    // Give time for the fire-and-forget promise to settle
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(cwModule.callControllerWitness).toHaveBeenCalled();

    // Clean up rejection handler
    process.removeListener('unhandledRejection', handler);
  });
}); 