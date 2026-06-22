// Unit test for selectAttestationService logic
// Covers: service selection based on chain and preferences, with mocks

import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import * as attestationServices from '@/config/attestation-services';
import * as walletModule from '@/lib/blockchain';
import * as easModule from '@/lib/eas';
import { useAttestation } from '@/lib/service';
import { omachainTestnet } from '@/config/chains';

vi.mock('@/app/client', () => ({ default: { clientId: 'dummy-client-id' } }));

vi.mock('thirdweb/react', () => ({
  useActiveAccount: vi.fn(),
  useActiveWallet: vi.fn(),
  useActiveWalletChain: vi.fn(),
}));

vi.mock('@/components/backend-session-provider', () => ({
  useBackendSession: () => ({ session: null }),
}));

const validAttestationData = { schemaId: 'schema', recipient: 'did:web:example.com', data: {} };

const easServiceConfig = {
  id: 'eas',
  name: 'EAS',
  description: '',
  website: '',
  docs: '',
  supportedChains: [omachainTestnet.id],
  contracts: {},
  features: [],
};

function mockWallet(overrides = {}): ReturnType<typeof walletModule.useWallet> {
  return {
    isConnected: true,
    address: '0xabc',
    chainId: omachainTestnet.id,
    isChainSupported: true,
    isAttestationSupported: true,
    account: undefined,
    chain: undefined,
    supportedChainIds: [omachainTestnet.id],
    ...overrides,
  } as any;
}

function mockEASClient(overrides = {}): any {
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
    supportedChains: [omachainTestnet.id],
    ...overrides,
  } as any;
}

describe('useAttestation hook', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws if not connected', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue(mockWallet({ isConnected: false }));
    vi.spyOn(easModule, 'useEASClient').mockReturnValue(mockEASClient());
    let result;
    await act(async () => {
      result = renderHook(() => useAttestation());
    });
    await expect(result!.result.current.submitAttestation(validAttestationData)).rejects.toThrow(/Wallet not connected/);
  });

  it('throws if service not available', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue(mockWallet());
    vi.spyOn(easModule, 'useEASClient').mockReturnValue(mockEASClient());
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
    vi.spyOn(easModule, 'useEASClient').mockReturnValue(mockEASClient());
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
    const fakeResult = { transactionHash: '0xabc', attestationId: '0xattest' };
    vi.spyOn(easModule, 'useEASClient').mockReturnValue(mockEASClient({ createAttestation: vi.fn().mockResolvedValue(fakeResult) }));
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([easServiceConfig]);
    vi.spyOn(attestationServices, 'getAttestationService').mockReturnValue(easServiceConfig);
    let result;
    await act(async () => {
      result = renderHook(() => useAttestation());
    });
    await act(async () => {
      await result!.result.current.submitAttestation(validAttestationData);
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
    vi.spyOn(easModule, 'useEASClient').mockReturnValue(mockEASClient({ createAttestation: vi.fn().mockRejectedValue(new Error('fail')) }));
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([easServiceConfig]);
    vi.spyOn(attestationServices, 'getAttestationService').mockReturnValue(easServiceConfig);
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
    vi.spyOn(easModule, 'useEASClient').mockReturnValue(mockEASClient());
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([{ ...easServiceConfig, name: 'EAS', description: 'desc' }]);
    vi.spyOn(attestationServices, 'getAttestationService').mockReturnValue({ ...easServiceConfig, name: 'EAS', description: 'desc' });
    let result;
    await act(async () => {
      result = renderHook(() => useAttestation());
    });
    expect(result!.result.current.isNetworkSupported).toBe(true);
    expect(result!.result.current.availableServices.length).toBe(1);
    expect(result!.result.current.recommendedService?.id).toBe('eas');
  });

  it('uses EAS when chain supports EAS and preferredNetwork selects it', async () => {
    const easCreateAttestation = vi.fn().mockResolvedValue({ transactionHash: '0xea5', attestationId: '0xattest' });
    vi.spyOn(walletModule, 'useWallet').mockReturnValue(mockWallet({ chainId: omachainTestnet.id }));
    vi.spyOn(easModule, 'useEASClient').mockReturnValue({ createAttestation: easCreateAttestation } as any);
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([easServiceConfig]);
    vi.spyOn(attestationServices, 'getAttestationService').mockImplementation((id) =>
      id === 'eas' ? easServiceConfig : undefined
    );
    let result;
    await act(async () => {
      result = renderHook(() => useAttestation());
    });
    await act(async () => {
      await result!.result.current.submitAttestation(validAttestationData, omachainTestnet.id);
    });
    expect(easCreateAttestation).toHaveBeenCalledWith(validAttestationData);
    expect(result!.result.current.lastResult).toEqual({ transactionHash: '0xea5', attestationId: '0xattest' });
  });
});

describe('controller witness integration in useAttestation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not invoke callControllerWitness from useAttestation, even for witness-configured schemas', async () => {
    const fakeResult = { transactionHash: '0xabc', attestationId: '0xattest123' };
    const easCreateAttestation = vi.fn().mockResolvedValue(fakeResult);

    vi.spyOn(walletModule, 'useWallet').mockReturnValue(mockWallet({ chainId: omachainTestnet.id }));
    vi.spyOn(easModule, 'useEASClient').mockReturnValue({ createAttestation: easCreateAttestation } as any);
    vi.spyOn(attestationServices, 'getServicesForChain').mockReturnValue([
      { ...easServiceConfig, contracts: { [omachainTestnet.id]: '0xeascontract' } },
    ]);
    vi.spyOn(attestationServices, 'getAttestationService').mockImplementation((id) =>
      id === 'eas'
        ? { ...easServiceConfig, contracts: { [omachainTestnet.id]: '0xeascontract' } }
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
      deployedUIDs: { [omachainTestnet.id]: '0xschemauid' },
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
      await result!.result.current.submitAttestation(attestationData, omachainTestnet.id);
    });

    expect(easCreateAttestation).toHaveBeenCalledWith(attestationData);
    expect(result!.result.current.lastResult).toEqual(fakeResult);
    expect(result!.result.current.lastError).toBeNull();
    expect(witnessSpy).not.toHaveBeenCalled();
  });
});
