import { vi, describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock modules before imports
vi.mock('thirdweb/adapters/ethers6', () => ({
  ethers6Adapter: {
    signer: {
      toEthers: vi.fn().mockResolvedValue({
        getAddress: vi.fn().mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
        // Add more methods if needed by the code under test
      }),
    },
  },
}));

vi.mock('@bnb-attestation-service/bas-sdk', () => {
  // Export a shared mock for bas.attest
  const basAttestMock = vi.fn();
  class MockBAS {
    constructor() {}
    connect = vi.fn();
    attest = (...args: any[]) => basAttestMock(...args);
  }
  return {
    BAS: MockBAS,
    basAttestMock,
  };
});

vi.mock('@oma3/omatrust/reputation', () => ({
  encodeAttestationData: vi.fn().mockReturnValue('0xencoded'),
  extractExpirationTime: vi.fn().mockReturnValue(undefined),
}));

vi.mock('@oma3/omatrust/identity', () => ({
  didToAddress: vi.fn().mockReturnValue('0x1234567890123456789012345678901234567890'),
}));

import * as walletModule from '@/lib/blockchain';
import * as thirdwebHooks from 'thirdweb/react';
import * as attestationServices from '@/config/attestation-services';
import { useBASClient } from '@/lib/bas';
import * as schemasModule from '@/config/schemas';

// Mock thirdweb/react and thirdweb/chains to avoid BigInt/Math errors in dependencies
vi.mock('thirdweb/react', () => ({
  useActiveAccount: vi.fn(),
  useActiveWallet: vi.fn(),
  useActiveWalletChain: vi.fn(),
}));
vi.mock('thirdweb/chains', () => ({
  bsc: { id: 56, rpc: 'https://bsc.rpc' },
  bscTestnet: { id: 97, rpc: 'https://testnet.rpc' },
  sepolia: { id: 11155111, rpc: 'https://sepolia.rpc' },
  mainnet: { id: 1, rpc: 'https://mainnet.rpc' },
}));

// For the enabled state test, mock the attestation-services module with a factory
vi.mock('@/config/attestation-services', () => ({
  getContractAddress: vi.fn(() => '0xcontract'),
  BAS_CONFIG: {
    id: 'bas',
    name: 'Binance Attestation Service',
    description: '',
    website: '',
    docs: '',
    supportedChains: [97, 56],
    contracts: {},
    features: [],
    estimatedGasCost: {},
  },
}));

// Mock @/app/client to provide a dummy clientId
vi.mock("@/app/client", () => ({
  client: {}, // Provide a dummy client export
}));

describe('useBASClient hook', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns disabled state and throws when wallet/contract/account is missing', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue({
      isConnected: false,
      address: null,
      chainId: undefined as unknown as number,
      isChainSupported: false,
      isAttestationSupported: false,
      account: undefined,
      chain: undefined,
      supportedChainIds: [],
    } as any);
    vi.spyOn(thirdwebHooks, 'useActiveAccount').mockReturnValue(undefined);
    vi.spyOn(thirdwebHooks, 'useActiveWallet').mockReturnValue(undefined);
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue(undefined);
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue(undefined);

    const { result } = renderHook(() => useBASClient());
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isChainSupported).toBe(false);
    await expect(result.current.createAttestation({ schemaId: 'test', data: { subject: 'did:web:example.com' }, recipient: 'did:web:example.com' })).rejects.toThrow(/not supported/);
    await expect(result.current.estimateGas()).rejects.toThrow(/not supported/);
    await expect(result.current.getAttestation()).rejects.toThrow(/not supported/);
    await expect(result.current.revokeAttestation()).rejects.toThrow(/not supported/);
    await expect(result.current.registerSchema()).rejects.toThrow(/not supported/);
    await expect(result.current.getSchema()).rejects.toThrow(/not supported/);
  });

  it('returns enabled state and exposes methods when wallet/contract/account is present', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chainId: 97,
      isChainSupported: true,
      isAttestationSupported: true,
      account: { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() },
      chain: { id: 97, rpc: 'https://testnet.rpc' } as any,
      supportedChainIds: [97, 56],
    } as any);
    vi.spyOn(thirdwebHooks, 'useActiveAccount').mockReturnValue({ address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() });
    vi.spyOn(thirdwebHooks, 'useActiveWallet').mockReturnValue({
      id: 'wallet1' as any,
      getChain: vi.fn(),
      getAccount: vi.fn(),
      autoConnect: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchChain: vi.fn(),
      subscribe: vi.fn(),
      getConfig: vi.fn(),
    });
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' } as any);
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    vi.spyOn(schemasModule, 'getSchema').mockImplementation((id: string) =>
      id === 'test'
        ? {
            id: 'test',
            title: 'Test',
            description: '',
            deployedUIDs: { 97: '0x' + '1'.repeat(64) }, easSchemaString: 'string test',
            fields: [],
          }
        : undefined
    );

    const basAttestMock = (await import('@bnb-attestation-service/bas-sdk') as any).basAttestMock;
    basAttestMock.mockResolvedValue({ wait: vi.fn().mockResolvedValue('0xhash') });

    const ethers6 = await import('thirdweb/adapters/ethers6');
    vi.mocked(ethers6.ethers6Adapter.signer.toEthers).mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    } as any);

    const { result } = renderHook(() => useBASClient());
    expect(result.current.isConnected).toBe(true);
    expect(result.current.isChainSupported).toBe(true);
    expect(result.current.contractAddress).toBe('0xcontract');
    expect(Array.isArray(result.current.supportedChains)).toBe(true);
    expect(typeof result.current.createAttestation).toBe('function');
    expect(typeof result.current.estimateGas).toBe('function');
    expect(typeof result.current.getAttestation).toBe('function');
    expect(typeof result.current.revokeAttestation).toBe('function');
    expect(typeof result.current.registerSchema).toBe('function');
    expect(typeof result.current.getSchema).toBe('function');
    expect(typeof result.current.getCurrentChain).toBe('function');
    await result.current.createAttestation({ schemaId: 'test', data: { subject: 'did:web:example.com' }, recipient: 'did:web:example.com' });
    await result.current.estimateGas();
  });
});

describe('useBASClient uncovered branches', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws error if schema is missing in createAttestation', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chainId: 97,
      isChainSupported: true,
      isAttestationSupported: true,
      account: { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() },
      chain: { id: 97, rpc: 'https://testnet.rpc' } as any,
      supportedChainIds: [97, 56],
    } as any);
    vi.spyOn(thirdwebHooks, 'useActiveAccount').mockReturnValue({ address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() });
    vi.spyOn(thirdwebHooks, 'useActiveWallet').mockReturnValue({
      id: 'wallet1' as any,
      getChain: vi.fn(),
      getAccount: vi.fn(),
      autoConnect: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchChain: vi.fn(),
      subscribe: vi.fn(),
      getConfig: vi.fn(),
    });
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' } as any);
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    vi.spyOn(schemasModule, 'getSchema').mockReturnValue(undefined);

    const { result } = renderHook(() => useBASClient());
    await expect(result.current.createAttestation({ schemaId: 'missing', data: { subject: 'did:web:example.com' }, recipient: 'did:web:example.com' }))
      .rejects.toThrow(/not found/);
  });

  it('throws error if deployedUID is missing', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chainId: 97,
      isChainSupported: true,
      isAttestationSupported: true,
      account: { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() },
      chain: { id: 97, rpc: 'https://testnet.rpc' } as any,
      supportedChainIds: [97, 56],
    } as any);
    vi.spyOn(thirdwebHooks, 'useActiveAccount').mockReturnValue({ address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() });
    vi.spyOn(thirdwebHooks, 'useActiveWallet').mockReturnValue({
      id: 'wallet1' as any,
      getChain: vi.fn(),
      getAccount: vi.fn(),
      autoConnect: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchChain: vi.fn(),
      subscribe: vi.fn(),
      getConfig: vi.fn(),
    });
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' } as any);
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    vi.spyOn(schemasModule, 'getSchema').mockReturnValue({
      id: 'test',
      title: 'Test',
      description: '',
      deployedUIDs: {},
      fields: [{ name: 'foo', type: 'string', label: 'Foo', required: false }],
    } as any);
    const { ethers6Adapter } = await import('thirdweb/adapters/ethers6');
    vi.spyOn(ethers6Adapter.signer, 'toEthers').mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    } as any);
    const { result } = renderHook(() => useBASClient());
    await expect(result.current.createAttestation({ schemaId: 'test', data: { foo: 'bar', subject: 'did:web:example.com' }, recipient: 'did:web:example.com' }))
      .rejects.toThrow(/not deployed/);
  });

  it('throws error if deployedUID is zero', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chainId: 97,
      isChainSupported: true,
      isAttestationSupported: true,
      account: { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() },
      chain: { id: 97, rpc: 'https://testnet.rpc' } as any,
      supportedChainIds: [97, 56],
    } as any);
    vi.spyOn(thirdwebHooks, 'useActiveAccount').mockReturnValue({ address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() });
    vi.spyOn(thirdwebHooks, 'useActiveWallet').mockReturnValue({
      id: 'wallet1' as any,
      getChain: vi.fn(),
      getAccount: vi.fn(),
      autoConnect: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchChain: vi.fn(),
      subscribe: vi.fn(),
      getConfig: vi.fn(),
    });
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' } as any);
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    vi.spyOn(schemasModule, 'getSchema').mockReturnValue({
      id: 'test',
      title: 'Test',
      description: '',
      deployedUIDs: { 97: '0x0000000000000000000000000000000000000000000000000000000000000000' },
      fields: [{ name: 'foo', type: 'string', label: 'Foo', required: false }],
    } as any);
    const { ethers6Adapter } = await import('thirdweb/adapters/ethers6');
    vi.spyOn(ethers6Adapter.signer, 'toEthers').mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    } as any);
    const { result } = renderHook(() => useBASClient());
    await expect(result.current.createAttestation({ schemaId: 'test', data: { foo: 'bar', subject: 'did:web:example.com' }, recipient: 'did:web:example.com' }))
      .rejects.toThrow(/deployment UID not set/);
  });

  it('throws error if signer cannot be obtained in createAttestation', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chainId: 97,
      isChainSupported: true,
      isAttestationSupported: true,
      account: { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() },
      chain: { id: 97, rpc: 'https://testnet.rpc' } as any,
      supportedChainIds: [97, 56],
    } as any);
    vi.spyOn(thirdwebHooks, 'useActiveAccount').mockReturnValue({ address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() });
    vi.spyOn(thirdwebHooks, 'useActiveWallet').mockReturnValue({
      id: 'wallet1' as any,
      getChain: vi.fn(),
      getAccount: vi.fn(),
      autoConnect: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchChain: vi.fn(),
      subscribe: vi.fn(),
      getConfig: vi.fn(),
    });
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' } as any);
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    vi.spyOn(schemasModule, 'getSchema').mockReturnValue({
      id: 'test',
      title: 'Test',
      description: '',
      deployedUIDs: { 97: '0x' + '1'.repeat(64) }, easSchemaString: 'string test',
      fields: [{ name: 'foo', type: 'string', label: 'Foo', required: false }],
    });
    const { ethers6Adapter } = await import('thirdweb/adapters/ethers6');
    vi.spyOn(ethers6Adapter.signer, 'toEthers').mockResolvedValue(undefined as any);
    const { result } = renderHook(() => useBASClient());
    await expect(result.current.createAttestation({ schemaId: 'test', data: { foo: 'bar', subject: 'did:web:example.com' }, recipient: 'did:web:example.com' }))
      .rejects.toThrow(/Failed to obtain ethers.js signer/);
  });

  it('throws error if recipient is missing in createAttestation', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chainId: 97,
      isChainSupported: true,
      isAttestationSupported: true,
      account: { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() },
      chain: { id: 97, rpc: 'https://testnet.rpc' } as any,
      supportedChainIds: [97, 56],
    } as any);
    vi.spyOn(thirdwebHooks, 'useActiveAccount').mockReturnValue({ address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() });
    vi.spyOn(thirdwebHooks, 'useActiveWallet').mockReturnValue({
      id: 'wallet1' as any,
      getChain: vi.fn(),
      getAccount: vi.fn(),
      autoConnect: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchChain: vi.fn(),
      subscribe: vi.fn(),
      getConfig: vi.fn(),
    });
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' } as any);
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    vi.spyOn(schemasModule, 'getSchema').mockReturnValue({
      id: 'test',
      title: 'Test',
      description: '',
      deployedUIDs: { 97: '0x' + '1'.repeat(64) }, easSchemaString: 'string test',
      fields: [{ name: 'foo', type: 'string', label: 'Foo', required: false }],
    });
    const { ethers6Adapter } = await import('thirdweb/adapters/ethers6');
    vi.spyOn(ethers6Adapter.signer, 'toEthers').mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    } as any);
    const { result } = renderHook(() => useBASClient());
    await expect(result.current.createAttestation({ schemaId: 'test', data: { foo: 'bar' }, recipient: '' }))
      .rejects.toThrow(/must include a subject DID/i);
  });

  it('throws error for not implemented methods', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chainId: 97,
      isChainSupported: true,
      isAttestationSupported: true,
      account: { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() },
      chain: { id: 97, rpc: 'https://testnet.rpc' } as any,
      supportedChainIds: [97, 56],
    } as any);
    vi.spyOn(thirdwebHooks, 'useActiveAccount').mockReturnValue({ address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() });
    vi.spyOn(thirdwebHooks, 'useActiveWallet').mockReturnValue({
      id: 'wallet1' as any,
      getChain: vi.fn(),
      getAccount: vi.fn(),
      autoConnect: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchChain: vi.fn(),
      subscribe: vi.fn(),
      getConfig: vi.fn(),
    });
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' } as any);
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    vi.spyOn(schemasModule, 'getSchema').mockReturnValue({
      id: 'test',
      title: 'Test',
      description: '',
      deployedUIDs: { 97: '0x' + '1'.repeat(64) }, easSchemaString: 'string test',
      fields: [{ name: 'foo', type: 'string', label: 'Foo', required: false }],
    });
    const { ethers6Adapter } = await import('thirdweb/adapters/ethers6');
    vi.spyOn(ethers6Adapter.signer, 'toEthers').mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    } as any);
    const { result } = renderHook(() => useBASClient());
    await expect(result.current.revokeAttestation()).rejects.toThrow(/not implemented/);
    await expect(result.current.getAttestation()).rejects.toThrow(/not implemented/);
    await expect(result.current.registerSchema()).rejects.toThrow(/not implemented/);
    await expect(result.current.getSchema()).rejects.toThrow(/not implemented/);
  });

  it('returns default estimateGas value', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chainId: 97,
      isChainSupported: true,
      isAttestationSupported: true,
      account: { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() },
      chain: { id: 97, rpc: 'https://testnet.rpc' } as any,
      supportedChainIds: [97, 56],
    } as any);
    vi.spyOn(thirdwebHooks, 'useActiveAccount').mockReturnValue({ address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() });
    vi.spyOn(thirdwebHooks, 'useActiveWallet').mockReturnValue({
      id: 'wallet1' as any,
      getChain: vi.fn(),
      getAccount: vi.fn(),
      autoConnect: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchChain: vi.fn(),
      subscribe: vi.fn(),
      getConfig: vi.fn(),
    });
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' } as any);
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    vi.spyOn(schemasModule, 'getSchema').mockReturnValue({
      id: 'test',
      title: 'Test',
      description: '',
      deployedUIDs: { 97: '0x' + '1'.repeat(64) }, easSchemaString: 'string test',
      fields: [{ name: 'foo', type: 'string', label: 'Foo', required: false }],
    });
    const { ethers6Adapter } = await import('thirdweb/adapters/ethers6');
    vi.spyOn(ethers6Adapter.signer, 'toEthers').mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    } as any);
    const { result } = renderHook(() => useBASClient());
    expect(await result.current.estimateGas()).toBe(BigInt('100000'));
  });
});

describe('useBASClient when enabled', () => {
  const enableWalletAndContract = async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chainId: 97,
      isChainSupported: true,
      isAttestationSupported: true,
      account: { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() },
      chain: { id: 97, rpc: 'https://testnet.rpc' } as any,
      supportedChainIds: [97, 56],
    } as any);
    vi.spyOn(thirdwebHooks, 'useActiveAccount').mockReturnValue({ address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() });
    vi.spyOn(thirdwebHooks, 'useActiveWallet').mockReturnValue({
      id: 'wallet1' as any,
      getChain: vi.fn(),
      getAccount: vi.fn(),
      autoConnect: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchChain: vi.fn(),
      subscribe: vi.fn(),
      getConfig: vi.fn(),
    });
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' } as any);
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    vi.spyOn(schemasModule, 'getSchema').mockImplementation((id: string) =>
      id === 'test'
        ? ({ id: 'test', title: 'Test', description: '', deployedUIDs: { 97: '0x' + '1'.repeat(64) }, easSchemaString: 'string test', fields: [{ name: 'foo', type: 'string', label: 'Foo', required: false }] } as any)
        : undefined
    );
    const { ethers6Adapter } = await import('thirdweb/adapters/ethers6');
    vi.spyOn(ethers6Adapter.signer, 'toEthers').mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    } as any);
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('revokeAttestation rejects with not implemented when enabled', async () => {
    await enableWalletAndContract();
    const { result } = renderHook(() => useBASClient());
    await expect((result.current.revokeAttestation as (id: string) => Promise<unknown>)('any-id')).rejects.toThrow(/Revocation not implemented/);
  });

  it('getAttestation rejects with not implemented when enabled', async () => {
    await enableWalletAndContract();
    const { result } = renderHook(() => useBASClient());
    await expect((result.current.getAttestation as (id: string) => Promise<unknown>)('any-id')).rejects.toThrow(/Get attestation not implemented/);
  });

  it('createAttestation rethrows when bas.attest throws', async () => {
    await enableWalletAndContract();
    const basAttestMock = (await import('@bnb-attestation-service/bas-sdk') as any).basAttestMock;
    basAttestMock.mockRejectedValueOnce(new Error('tx failed'));
    const { result } = renderHook(() => useBASClient());
    await expect(
      result.current.createAttestation({ schemaId: 'test', data: { foo: 'bar', subject: 'did:web:example.com' }, recipient: 'did:web:example.com' })
    ).rejects.toThrow('tx failed');
  });

  it('createAttestation uses DID index when data.subject is a DID', async () => {
    await enableWalletAndContract();
    const basAttestMock = (await import('@bnb-attestation-service/bas-sdk') as any).basAttestMock;
    basAttestMock.mockResolvedValue({ wait: vi.fn().mockResolvedValue('0xhash') });
    const { result } = renderHook(() => useBASClient());
    await result.current.createAttestation({
      schemaId: 'test',
      data: { foo: 'bar', subject: 'did:pkh:eip155:1:0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed' },
      recipient: 'did:web:example.com',
    });
    expect(basAttestMock).toHaveBeenCalled();
    const call = basAttestMock.mock.calls[0][0];
    expect(call.data.recipient).toBeDefined();
  });

  it('createAttestation resolves recipient from subject DID', async () => {
    await enableWalletAndContract();
    const basAttestMock = (await import('@bnb-attestation-service/bas-sdk') as any).basAttestMock;
    basAttestMock.mockResolvedValue({ wait: vi.fn().mockResolvedValue('0xhash') });
    const { result } = renderHook(() => useBASClient());
    await result.current.createAttestation({
      schemaId: 'test',
      data: { foo: 'bar', subject: 'did:web:example.com' },
      recipient: 'did:pkh:eip155:1:0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    });
    expect(basAttestMock).toHaveBeenCalled();
  });

  it('createAttestation auto-computes subjectDidHash when schema has subjectDidHash and data.subject is DID', async () => {
    await enableWalletAndContract();
    vi.spyOn(schemasModule, 'getSchema').mockImplementation(((id: string) =>
      id === 'test'
        ? {
            id: 'test',
            title: 'Test',
            description: '',
            deployedUIDs: { 97: '0x' + '1'.repeat(64) }, easSchemaString: 'string test',
            fields: [
              { name: 'foo', type: 'string', label: 'Foo', required: false },
              { name: 'subjectDidHash', type: 'string', label: 'Subject DID Hash', required: false },
            ],
          }
        : undefined
    ) as any);
    const basAttestMock = (await import('@bnb-attestation-service/bas-sdk') as any).basAttestMock;
    basAttestMock.mockResolvedValue({ wait: vi.fn().mockResolvedValue('0xhash') });
    const { result } = renderHook(() => useBASClient());
    await result.current.createAttestation({
      schemaId: 'test',
      data: { foo: 'bar', subject: 'did:pkh:eip155:1:0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed' },
      recipient: 'did:web:example.com',
    });
    expect(basAttestMock).toHaveBeenCalled();
    const call = basAttestMock.mock.calls[0][0];
    expect(call.data).toBeDefined();
  });

  it('createAttestation encodes bytes32 field when schema has format bytes32', async () => {
    await enableWalletAndContract();
    vi.spyOn(schemasModule, 'getSchema').mockImplementation(((id: string) =>
      id === 'test'
        ? {
            id: 'test',
            title: 'Test',
            description: '',
            deployedUIDs: { 97: '0x' + '1'.repeat(64) }, easSchemaString: 'string test',
            fields: [
              { name: 'foo', type: 'string', label: 'Foo', required: false },
              { name: 'hash', type: 'string', label: 'Hash', required: false, format: 'bytes32' },
            ],
          }
        : undefined
    ) as any);
    const basAttestMock = (await import('@bnb-attestation-service/bas-sdk') as any).basAttestMock;
    basAttestMock.mockResolvedValue({ wait: vi.fn().mockResolvedValue('0xhash') });
    const { result } = renderHook(() => useBASClient());
    const hashValue = '0x' + 'a'.repeat(64);
    await result.current.createAttestation({
      schemaId: 'test',
      data: { foo: 'bar', hash: hashValue, subject: 'did:web:example.com' },
      recipient: 'did:pkh:eip155:1:0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    });
    expect(basAttestMock).toHaveBeenCalled();
    const call = basAttestMock.mock.calls[0][0];
    expect(call.data).toBeDefined();
  });

  it('createAttestation throws when wallet is null (account present)', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chainId: 97,
      isChainSupported: true,
      isAttestationSupported: true,
      account: { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() },
      chain: { id: 97, rpc: 'https://testnet.rpc' } as any,
      supportedChainIds: [97, 56],
    } as any);
    vi.spyOn(thirdwebHooks, 'useActiveAccount').mockReturnValue({ address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() });
    vi.spyOn(thirdwebHooks, 'useActiveWallet').mockReturnValue(null as any);
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' } as any);
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    vi.spyOn(schemasModule, 'getSchema').mockImplementation((id: string) =>
      id === 'test'
        ? ({ id: 'test', title: 'Test', description: '', deployedUIDs: { 97: '0x' + '1'.repeat(64) }, easSchemaString: 'string test', fields: [{ name: 'foo', type: 'string', label: 'Foo', required: false }] } as any)
        : undefined
    );
    const { result } = renderHook(() => useBASClient());
    await expect(
      result.current.createAttestation({ schemaId: 'test', data: { foo: 'bar', subject: 'did:web:example.com' }, recipient: 'did:pkh:eip155:1:0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed' })
    ).rejects.toThrow(/Wallet not connected or account unavailable/);
  });

  it('createAttestation uses extractExpirationTime with string and number expiration data', async () => {
    await enableWalletAndContract();
    vi.spyOn(schemasModule, 'getSchema').mockImplementation((id: string) =>
      id === 'test'
        ? ({ id: 'test', title: 'Test', description: '', deployedUIDs: { 97: '0x' + '1'.repeat(64) }, easSchemaString: 'string test', fields: [{ name: 'foo', type: 'string', label: 'Foo', required: false }] } as any)
        : undefined
    );
    const basAttestMock = (await import('@bnb-attestation-service/bas-sdk') as any).basAttestMock;
    basAttestMock.mockResolvedValue({ wait: vi.fn().mockResolvedValue('0xhash') });
    const { result } = renderHook(() => useBASClient());
    await result.current.createAttestation({
      schemaId: 'test',
      data: { foo: 'bar', expireAt: '2023-01-01T00:00:00Z', subject: 'did:web:example.com' },
      recipient: 'did:pkh:eip155:1:0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    });
    expect(basAttestMock).toHaveBeenCalled();
    const call = basAttestMock.mock.calls[0][0];
    expect(call.data.expirationTime).toBeDefined();
  });

  it('createAttestation uses extractExpirationTime with number expirationTime', async () => {
    await enableWalletAndContract();
    vi.spyOn(schemasModule, 'getSchema').mockImplementation((id: string) =>
      id === 'test'
        ? ({ id: 'test', title: 'Test', description: '', deployedUIDs: { 97: '0x' + '1'.repeat(64) }, easSchemaString: 'string test', fields: [{ name: 'foo', type: 'string', label: 'Foo', required: false }] } as any)
        : undefined
    );
    const basAttestMock = (await import('@bnb-attestation-service/bas-sdk') as any).basAttestMock;
    basAttestMock.mockResolvedValue({ wait: vi.fn().mockResolvedValue('0xhash') });
    const { result } = renderHook(() => useBASClient());
    await result.current.createAttestation({
      schemaId: 'test',
      data: { foo: 'bar', expirationTime: 1700000000, subject: 'did:web:example.com' },
      recipient: 'did:pkh:eip155:1:0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    });
    expect(basAttestMock).toHaveBeenCalled();
    const call = basAttestMock.mock.calls[0][0];
    expect(call.data.expirationTime).toBeDefined();
  });

  it('createAttestation convertToBASData bytes32 field uses zero when value not valid hex', async () => {
    await enableWalletAndContract();
    vi.spyOn(schemasModule, 'getSchema').mockImplementation(((id: string) =>
      id === 'test'
        ? {
            id: 'test',
            title: 'Test',
            description: '',
            deployedUIDs: { 97: '0x' + '1'.repeat(64) }, easSchemaString: 'string test',
            fields: [
              { name: 'foo', type: 'string', label: 'Foo', required: false },
              { name: 'hash', type: 'string', label: 'Hash', required: false, format: 'bytes32' },
            ],
          }
        : undefined
    ) as any);
    const basAttestMock = (await import('@bnb-attestation-service/bas-sdk') as any).basAttestMock;
    basAttestMock.mockResolvedValue({ wait: vi.fn().mockResolvedValue('0xhash') });
    const { result } = renderHook(() => useBASClient());
    await result.current.createAttestation({
      schemaId: 'test',
      data: { foo: 'bar', hash: '', subject: 'did:web:example.com' },
      recipient: 'did:pkh:eip155:1:0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    });
    expect(basAttestMock).toHaveBeenCalled();
    const call = basAttestMock.mock.calls[0][0];
    expect(call.data).toBeDefined();
  });
});

describe('useBASClient happy path', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('successfully creates an attestation (happy path)', async () => {
    // Mock wallet and hooks
    vi.spyOn(walletModule, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chainId: 97,
      isChainSupported: true,
      isAttestationSupported: true,
      account: { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() },
      chain: { id: 97, rpc: 'https://testnet.rpc' } as any,
      supportedChainIds: [97, 56],
    } as any);
    vi.spyOn(thirdwebHooks, 'useActiveAccount').mockReturnValue({ address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() });
    vi.spyOn(thirdwebHooks, 'useActiveWallet').mockReturnValue({
      id: 'wallet1' as any,
      getChain: vi.fn(),
      getAccount: vi.fn(),
      autoConnect: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchChain: vi.fn(),
      subscribe: vi.fn(),
      getConfig: vi.fn(),
    });
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' } as any);
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    vi.spyOn(schemasModule, 'getSchema').mockImplementation(((id: string) =>
      id === 'test'
        ? {
            id: 'test',
            title: 'Test',
            description: '',
            deployedUIDs: { 97: '0x' + '1'.repeat(64) }, easSchemaString: 'string test',
            fields: [
              { name: 'foo', type: 'string', label: 'Foo', required: false },
            ],
          }
        : undefined
    ) as any);
    // Override the mock for this test to ensure a valid signer is returned
    const { ethers6Adapter } = await import('thirdweb/adapters/ethers6');
    vi.spyOn(ethers6Adapter.signer, 'toEthers').mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    } as any);
    // Import and set the basAttestMock to throw
    const basAttestMock = (await import('@bnb-attestation-service/bas-sdk') as any).basAttestMock;
    basAttestMock.mockResolvedValue({ wait: vi.fn().mockResolvedValue('0xhash') });
    // Now run the hook and call createAttestation
    const { result } = renderHook(() => useBASClient());
    const attestationResult = await result.current.createAttestation({ schemaId: 'test', data: { foo: 'bar', subject: 'did:web:example.com' }, recipient: 'did:web:example.com' });
    expect(attestationResult).toEqual({
      transactionHash: '0xhash',
      attestationId: 'pending',
      blockNumber: 0,
      gasUsed: BigInt(0),
    });
  });
});

describe('useBASClient with array and enum fields', () => {
  const enableWalletAndContract = async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chainId: 97,
      isChainSupported: true,
      isAttestationSupported: true,
      account: { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() },
      chain: { id: 97, rpc: 'https://testnet.rpc' } as any,
      supportedChainIds: [97, 56],
    } as any);
    vi.spyOn(thirdwebHooks, 'useActiveAccount').mockReturnValue({ address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() });
    vi.spyOn(thirdwebHooks, 'useActiveWallet').mockReturnValue({
      id: 'wallet1' as any,
      getChain: vi.fn(),
      getAccount: vi.fn(),
      autoConnect: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchChain: vi.fn(),
      subscribe: vi.fn(),
      getConfig: vi.fn(),
    });
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' } as any);
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    const { ethers6Adapter } = await import('thirdweb/adapters/ethers6');
    vi.spyOn(ethers6Adapter.signer, 'toEthers').mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    } as any);
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('createAttestation handles array field type', async () => {
    await enableWalletAndContract();
    vi.spyOn(schemasModule, 'getSchema').mockImplementation(((id: string) =>
      id === 'test-array'
        ? {
            id: 'test-array',
            title: 'Test Array',
            description: '',
            deployedUIDs: { 97: '0x' + '1'.repeat(64) }, easSchemaString: 'string test',
            fields: [
              { name: 'tags', type: 'array', label: 'Tags', required: false },
            ],
          }
        : undefined
    ) as any);
    const basAttestMock = (await import('@bnb-attestation-service/bas-sdk') as any).basAttestMock;
    basAttestMock.mockResolvedValue({ wait: vi.fn().mockResolvedValue('0xhash') });
    const { result } = renderHook(() => useBASClient());
    await result.current.createAttestation({
      schemaId: 'test-array',
      data: { tags: ['tag1', 'tag2'], subject: 'did:web:example.com' },
      recipient: 'did:pkh:eip155:1:0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    });
    expect(basAttestMock).toHaveBeenCalled();
  });

  it('createAttestation handles enum field type', async () => {
    await enableWalletAndContract();
    vi.spyOn(schemasModule, 'getSchema').mockImplementation(((id: string) =>
      id === 'test-enum'
        ? {
            id: 'test-enum',
            title: 'Test Enum',
            description: '',
            deployedUIDs: { 97: '0x' + '1'.repeat(64) }, easSchemaString: 'string test',
            fields: [
              { name: 'status', type: 'enum', label: 'Status', required: false },
            ],
          }
        : undefined
    ) as any);
    const basAttestMock = (await import('@bnb-attestation-service/bas-sdk') as any).basAttestMock;
    basAttestMock.mockResolvedValue({ wait: vi.fn().mockResolvedValue('0xhash') });
    const { result } = renderHook(() => useBASClient());
    await result.current.createAttestation({
      schemaId: 'test-enum',
      data: { status: 'active', subject: 'did:web:example.com' },
      recipient: 'did:pkh:eip155:1:0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    });
    expect(basAttestMock).toHaveBeenCalled();
  });

  it('createAttestation handles array field with non-array value', async () => {
    await enableWalletAndContract();
    vi.spyOn(schemasModule, 'getSchema').mockImplementation(((id: string) =>
      id === 'test-array-single'
        ? {
            id: 'test-array-single',
            title: 'Test Array Single',
            description: '',
            deployedUIDs: { 97: '0x' + '1'.repeat(64) }, easSchemaString: 'string test',
            fields: [
              { name: 'tags', type: 'array', label: 'Tags', required: false },
            ],
          }
        : undefined
    ) as any);
    const basAttestMock = (await import('@bnb-attestation-service/bas-sdk') as any).basAttestMock;
    basAttestMock.mockResolvedValue({ wait: vi.fn().mockResolvedValue('0xhash') });
    const { result } = renderHook(() => useBASClient());
    await result.current.createAttestation({
      schemaId: 'test-array-single',
      data: { tags: 'single-tag', subject: 'did:web:example.com' },
      recipient: 'did:pkh:eip155:1:0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    });
    expect(basAttestMock).toHaveBeenCalled();
  });

  it('createAttestation handles integer field type', async () => {
    await enableWalletAndContract();
    vi.spyOn(schemasModule, 'getSchema').mockImplementation(((id: string) =>
      id === 'test-integer'
        ? {
            id: 'test-integer',
            title: 'Test Integer',
            description: '',
            deployedUIDs: { 97: '0x' + '1'.repeat(64) }, easSchemaString: 'string test',
            fields: [
              { name: 'count', type: 'integer', label: 'Count', required: false, max: 255 },
            ],
          }
        : undefined
    ) as any);
    const basAttestMock = (await import('@bnb-attestation-service/bas-sdk') as any).basAttestMock;
    basAttestMock.mockResolvedValue({ wait: vi.fn().mockResolvedValue('0xhash') });
    const { result } = renderHook(() => useBASClient());
    await result.current.createAttestation({
      schemaId: 'test-integer',
      data: { count: '42', subject: 'did:web:example.com' },
      recipient: 'did:pkh:eip155:1:0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    });
    expect(basAttestMock).toHaveBeenCalled();
  });

  it('createAttestation handles datetime field type', async () => {
    await enableWalletAndContract();
    vi.spyOn(schemasModule, 'getSchema').mockImplementation(((id: string) =>
      id === 'test-datetime'
        ? {
            id: 'test-datetime',
            title: 'Test Datetime',
            description: '',
            deployedUIDs: { 97: '0x' + '1'.repeat(64) }, easSchemaString: 'string test',
            fields: [
              { name: 'createdAt', type: 'datetime', label: 'Created At', required: false },
            ],
          }
        : undefined
    ) as any);
    const basAttestMock = (await import('@bnb-attestation-service/bas-sdk') as any).basAttestMock;
    basAttestMock.mockResolvedValue({ wait: vi.fn().mockResolvedValue('0xhash') });
    const { result } = renderHook(() => useBASClient());
    await result.current.createAttestation({
      schemaId: 'test-datetime',
      data: { createdAt: '2023-01-01T00:00:00Z', subject: 'did:web:example.com' },
      recipient: 'did:pkh:eip155:1:0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    });
    expect(basAttestMock).toHaveBeenCalled();
  });

  it('createAttestation handles uri field type', async () => {
    await enableWalletAndContract();
    vi.spyOn(schemasModule, 'getSchema').mockImplementation(((id: string) =>
      id === 'test-uri'
        ? {
            id: 'test-uri',
            title: 'Test URI',
            description: '',
            deployedUIDs: { 97: '0x' + '1'.repeat(64) }, easSchemaString: 'string test',
            fields: [
              { name: 'website', type: 'uri', label: 'Website', required: false },
            ],
          }
        : undefined
    ) as any);
    const basAttestMock = (await import('@bnb-attestation-service/bas-sdk') as any).basAttestMock;
    basAttestMock.mockResolvedValue({ wait: vi.fn().mockResolvedValue('0xhash') });
    const { result } = renderHook(() => useBASClient());
    await result.current.createAttestation({
      schemaId: 'test-uri',
      data: { website: 'https://example.com', subject: 'did:web:example.com' },
      recipient: 'did:pkh:eip155:1:0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    });
    expect(basAttestMock).toHaveBeenCalled();
  });
}) 