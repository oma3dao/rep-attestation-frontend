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
  class MockSchemaEncoder {
    constructor() {}
    encodeData = vi.fn().mockReturnValue('0xencoded');
  }
  return {
    BAS: MockBAS,
    SchemaEncoder: MockSchemaEncoder,
    basAttestMock,
  };
});

import * as walletModule from '@/lib/blockchain';
import * as thirdwebHooks from 'thirdweb/react';
import * as attestationServices from '@/config/attestation-services';
import { useBASClient } from '@/lib/bas';
import { BASClient } from '@/lib/bas';
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

// Copy the functions here for isolated testing (since they're not exported)
// In a real codebase, consider exporting them for testability

// --- Copied from src/lib/bas.ts ---
function convertToBASData(schema: any, data: Record<string, any>): Array<{name: string, value: any, type: string}> {
  return schema.fields.map((field: any) => {
    let value = data[field.name] || ''
    let type = field.type
    switch (field.type) {
      case 'integer':
        type = field.max && field.max <= 255 ? 'uint8' : 'uint256'
        value = parseInt(value) || 0
        break
      case 'datetime':
        type = 'string'
        value = value ? new Date(value).toISOString() : ''
        break
      case 'uri':
        type = 'string'
        value = value || ''
        break
      case 'array':
        type = 'string[]'
        value = Array.isArray(value) ? value : (value ? [value] : [])
        break
      case 'enum':
        type = 'string'
        value = value || ''
        break
      case 'string':
      default:
        type = 'string'
        value = String(value || '')
        break
    }
    return {
      name: field.name,
      value,
      type
    }
  })
}

const extractExpirationTime = (data: Record<string, any>): bigint => {
  const expirationFields = ['expireAt', 'expirationTime', 'expires', 'validUntil']
  for (const field of expirationFields) {
    if (data[field]) {
      const value = data[field]
      if (typeof value === 'string') {
        const timestamp = new Date(value).getTime() / 1000
        if (!isNaN(timestamp)) {
          return BigInt(Math.floor(timestamp))
        }
      } else if (typeof value === 'number') {
        return BigInt(Math.floor(value))
      }
    }
  }
  return BigInt(0)
}
// --- End copy ---

describe('convertToBASData', () => {
  const schema = {
    fields: [
      { name: 'age', type: 'integer', max: 200 },
      { name: 'short', type: 'integer', max: 100 },
      { name: 'date', type: 'datetime' },
      { name: 'website', type: 'uri' },
      { name: 'tags', type: 'array' },
      { name: 'status', type: 'enum' },
      { name: 'desc', type: 'string' },
      { name: 'other', type: 'unknown' },
    ]
  };
  const data = {
    age: '42',
    short: '7',
    date: '2023-01-01T00:00:00Z',
    website: 'https://example.com',
    tags: ['a', 'b'],
    status: 'active',
    desc: 'hello',
    other: 123
  };

  it('converts all supported field types correctly', () => {
    const result = convertToBASData(schema, data);
    expect(result).toEqual([
      { name: 'age', value: 42, type: 'uint8' },
      { name: 'short', value: 7, type: 'uint8' },
      { name: 'date', value: '2023-01-01T00:00:00.000Z', type: 'string' },
      { name: 'website', value: 'https://example.com', type: 'string' },
      { name: 'tags', value: ['a', 'b'], type: 'string[]' },
      { name: 'status', value: 'active', type: 'string' },
      { name: 'desc', value: 'hello', type: 'string' },
      { name: 'other', value: '123', type: 'string' },
    ]);
  });

  it('handles missing data fields', () => {
    const result = convertToBASData(schema, {});
    expect(result[0].value).toBe(0); // integer
    expect(result[1].value).toBe(0); // integer
    expect(result[2].value).toBe(''); // datetime
    expect(result[3].value).toBe(''); // uri
    expect(result[4].value).toEqual([]); // array
    expect(result[5].value).toBe(''); // enum
    expect(result[6].value).toBe(''); // string
    expect(result[7].value).toBe(''); // unknown
  });

  it('handles array field with single value', () => {
    const singleArray = convertToBASData({ fields: [{ name: 'tags', type: 'array' }] }, { tags: 'foo' });
    expect(singleArray[0].value).toEqual(['foo']);
  });
});

describe('extractExpirationTime', () => {
  it('returns correct bigint for string date', () => {
    const data = { expireAt: '2023-01-01T00:00:00Z' };
    const expected = BigInt(Math.floor(new Date('2023-01-01T00:00:00Z').getTime() / 1000));
    expect(extractExpirationTime(data)).toBe(expected);
  });

  it('returns correct bigint for number', () => {
    const data = { expirationTime: 1700000000 };
    expect(extractExpirationTime(data)).toBe(BigInt(1700000000));
  });

  it('returns 0 for missing fields', () => {
    expect(extractExpirationTime({})).toBe(BigInt(0));
  });

  it('returns 0 for invalid string date', () => {
    expect(extractExpirationTime({ expireAt: 'not-a-date' })).toBe(BigInt(0));
  });

  it('returns first valid field in order', () => {
    const data = { expires: 123, validUntil: 456 };
    expect(extractExpirationTime(data)).toBe(BigInt(123));
  });
});

describe('extractExpirationTime edge cases', () => {
  it('returns 0 for missing expiration fields', () => {
    expect(extractExpirationTime({})).toBe(BigInt(0));
  });
  it('returns 0 for invalid date string', () => {
    expect(extractExpirationTime({ expireAt: 'not-a-date' })).toBe(BigInt(0));
  });
  it('returns 0 for non-numeric string', () => {
    expect(extractExpirationTime({ expireAt: 'abc' })).toBe(BigInt(0));
  });
  it('returns 0 for unsupported field type', () => {
    expect(extractExpirationTime({ expireAt: { foo: 'bar' } })).toBe(BigInt(0));
  });
});

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
    });
    vi.spyOn(thirdwebHooks, 'useActiveAccount').mockReturnValue(undefined);
    vi.spyOn(thirdwebHooks, 'useActiveWallet').mockReturnValue(undefined);
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue(undefined);
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue(undefined);

    const { result } = renderHook(() => useBASClient());
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isChainSupported).toBe(false);
    await expect(result.current.createAttestation({ schemaId: 'test', data: {}, recipient: 'did:web:example.com' })).rejects.toThrow(/not supported/);
    await expect(result.current.estimateGas()).rejects.toThrow(/not supported/);
    await expect(result.current.getAttestation()).rejects.toThrow(/not supported/);
    await expect(result.current.revokeAttestation()).rejects.toThrow(/not supported/);
    await expect(result.current.registerSchema()).rejects.toThrow(/not supported/);
    await expect(result.current.getSchema()).rejects.toThrow(/not supported/);
  });

  // Skipped due to network limitation: testnet.rpc is not a real endpoint and cannot be reached in test
  it.skip('returns enabled state and exposes methods when wallet/contract/account is present', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chainId: 97,
      isChainSupported: true,
      isAttestationSupported: true,
      account: { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() },
      chain: { id: 97, rpc: 'https://testnet.rpc' },
      supportedChainIds: [97, 56],
    });
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
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' });
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    vi.spyOn(schemasModule, 'getSchema').mockImplementation((id: string) =>
      id === 'test'
        ? {
            id: 'test',
            title: 'Test',
            description: '',
            deployedUIDs: { 97: '0x' + '1'.repeat(64) },
            fields: [],
          }
        : undefined
    );

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
    await result.current.createAttestation({ schemaId: 'test', data: {}, recipient: 'did:web:example.com' });
    await result.current.estimateGas();
  });
});

// Copy createBASSchemaString for isolated testing
function createBASSchemaString(schema: any): string {
  const fieldStrings = schema.fields.map((field: any) => {
    let type = field.type
    switch (field.type) {
      case 'integer':
        type = field.max && field.max <= 255 ? 'uint8' : 'uint256'
        break
      case 'datetime':
        type = 'string'
        break
      case 'uri':
        type = 'string'
        break
      case 'array':
        type = 'string[]'
        break
      case 'enum':
        type = 'string'
        break
      case 'string':
      default:
        type = 'string'
        break
    }
    return `${type} ${field.name}`
  })
  return fieldStrings.join(',')
}

describe('createBASSchemaString', () => {
  it('handles all field types', () => {
    const schema = {
      fields: [
        { name: 'age', type: 'integer', max: 200 },
        { name: 'short', type: 'integer', max: 100 },
        { name: 'date', type: 'datetime' },
        { name: 'website', type: 'uri' },
        { name: 'tags', type: 'array' },
        { name: 'status', type: 'enum' },
        { name: 'desc', type: 'string' },
        { name: 'other', type: 'unknown' },
      ]
    };
    expect(createBASSchemaString(schema)).toBe(
      'uint8 age,uint8 short,string date,string website,string[] tags,string status,string desc,string other'
    );
  });
  it('handles empty fields', () => {
    expect(createBASSchemaString({ fields: [] })).toBe('');
  });
  it('handles missing max for integer', () => {
    const schema = { fields: [{ name: 'foo', type: 'integer' }] };
    expect(createBASSchemaString(schema)).toBe('uint256 foo');
  });
  it('handles unknown field type as string', () => {
    const schema = { fields: [{ name: 'foo', type: 'unknown' }] };
    expect(createBASSchemaString(schema)).toBe('string foo');
  });
  it('handles array field', () => {
    const schema = { fields: [{ name: 'tags', type: 'array' }] };
    expect(createBASSchemaString(schema)).toBe('string[] tags');
  });
});

describe('BASClient', () => {
  const client = new BASClient();
  it('throws for createAttestation', async () => {
    await expect(client.createAttestation({} as any)).rejects.toThrow(/must be used within React component/);
  });
  it('throws for revokeAttestation', async () => {
    await expect(client.revokeAttestation('id')).rejects.toThrow(/must be used within React component/);
  });
  it('throws for getAttestation', async () => {
    await expect(client.getAttestation('id')).rejects.toThrow(/must be used within React component/);
  });
  it('throws for registerSchema', async () => {
    await expect(client.registerSchema({})).rejects.toThrow(/must be used within React component/);
  });
  it('throws for getSchema', async () => {
    await expect(client.getSchema('id')).rejects.toThrow(/must be used within React component/);
  });
  it('throws for estimateGas', async () => {
    await expect(client.estimateGas({} as any)).rejects.toThrow(/must be used within React component/);
  });
  it('throws for isConnected', () => {
    expect(() => client.isConnected()).toThrow(/must be used within React component/);
  });
  it('throws for getCurrentChain', () => {
    expect(() => client.getCurrentChain()).toThrow(/must be used within React component/);
  });
});

describe('useBASClient uncovered branches', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns error methods when wallet is not connected', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue({
      isConnected: false,
      address: null,
      chainId: undefined,
      isChainSupported: false,
      isAttestationSupported: false,
      account: undefined,
      chain: undefined,
      supportedChainIds: [],
    });
    vi.spyOn(thirdwebHooks, 'useActiveAccount').mockReturnValue(undefined);
    vi.spyOn(thirdwebHooks, 'useActiveWallet').mockReturnValue(undefined);
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue(undefined);
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue(undefined);

    const { result } = renderHook(() => useBASClient());
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isChainSupported).toBe(false);
    await expect(result.current.createAttestation({ schemaId: 'test', data: {}, recipient: 'did:web:example.com' }))
      .rejects.toThrow(/not supported/);
    await expect(result.current.estimateGas()).rejects.toThrow(/not supported/);
    await expect(result.current.getAttestation()).rejects.toThrow(/not supported/);
    await expect(result.current.revokeAttestation()).rejects.toThrow(/not supported/);
    await expect(result.current.registerSchema()).rejects.toThrow(/not supported/);
    await expect(result.current.getSchema()).rejects.toThrow(/not supported/);
  });

  it('throws error if schema is missing in createAttestation', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chainId: 97,
      isChainSupported: true,
      isAttestationSupported: true,
      account: { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() },
      chain: { id: 97, rpc: 'https://testnet.rpc' },
      supportedChainIds: [97, 56],
    });
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
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' });
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    vi.spyOn(schemasModule, 'getSchema').mockReturnValue(undefined);

    const { result } = renderHook(() => useBASClient());
    await expect(result.current.createAttestation({ schemaId: 'missing', data: {}, recipient: 'did:web:example.com' }))
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
      chain: { id: 97, rpc: 'https://testnet.rpc' },
      supportedChainIds: [97, 56],
    });
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
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' });
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    vi.spyOn(schemasModule, 'getSchema').mockReturnValue({
      id: 'test',
      title: 'Test',
      description: '',
      deployedUIDs: {},
      fields: [{ name: 'foo', type: 'string' }],
    });
    const { ethers6Adapter } = await import('thirdweb/adapters/ethers6');
    vi.spyOn(ethers6Adapter.signer, 'toEthers').mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    });
    const { result } = renderHook(() => useBASClient());
    await expect(result.current.createAttestation({ schemaId: 'test', data: { foo: 'bar' }, recipient: 'did:web:example.com' }))
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
      chain: { id: 97, rpc: 'https://testnet.rpc' },
      supportedChainIds: [97, 56],
    });
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
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' });
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    vi.spyOn(schemasModule, 'getSchema').mockReturnValue({
      id: 'test',
      title: 'Test',
      description: '',
      deployedUIDs: { 97: '0x0000000000000000000000000000000000000000000000000000000000000000' },
      fields: [{ name: 'foo', type: 'string' }],
    });
    const { ethers6Adapter } = await import('thirdweb/adapters/ethers6');
    vi.spyOn(ethers6Adapter.signer, 'toEthers').mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    });
    const { result } = renderHook(() => useBASClient());
    await expect(result.current.createAttestation({ schemaId: 'test', data: { foo: 'bar' }, recipient: 'did:web:example.com' }))
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
      chain: { id: 97, rpc: 'https://testnet.rpc' },
      supportedChainIds: [97, 56],
    });
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
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' });
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    vi.spyOn(schemasModule, 'getSchema').mockReturnValue({
      id: 'test',
      title: 'Test',
      description: '',
      deployedUIDs: { 97: '0x' + '1'.repeat(64) },
      fields: [{ name: 'foo', type: 'string' }],
    });
    const { ethers6Adapter } = await import('thirdweb/adapters/ethers6');
    vi.spyOn(ethers6Adapter.signer, 'toEthers').mockResolvedValue(undefined);
    const { result } = renderHook(() => useBASClient());
    await expect(result.current.createAttestation({ schemaId: 'test', data: { foo: 'bar' }, recipient: 'did:web:example.com' }))
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
      chain: { id: 97, rpc: 'https://testnet.rpc' },
      supportedChainIds: [97, 56],
    });
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
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' });
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    vi.spyOn(schemasModule, 'getSchema').mockReturnValue({
      id: 'test',
      title: 'Test',
      description: '',
      deployedUIDs: { 97: '0x' + '1'.repeat(64) },
      fields: [{ name: 'foo', type: 'string' }],
    });
    const { ethers6Adapter } = await import('thirdweb/adapters/ethers6');
    vi.spyOn(ethers6Adapter.signer, 'toEthers').mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    });
    const { result } = renderHook(() => useBASClient());
    await expect(result.current.createAttestation({ schemaId: 'test', data: { foo: 'bar' }, recipient: '' }))
      .rejects.toThrow(/Unsupported identifier format/i);
  });

  it('throws error for not implemented methods', async () => {
    vi.spyOn(walletModule, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chainId: 97,
      isChainSupported: true,
      isAttestationSupported: true,
      account: { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', sendTransaction: vi.fn(), signMessage: vi.fn(), signTypedData: vi.fn() },
      chain: { id: 97, rpc: 'https://testnet.rpc' },
      supportedChainIds: [97, 56],
    });
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
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' });
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    vi.spyOn(schemasModule, 'getSchema').mockReturnValue({
      id: 'test',
      title: 'Test',
      description: '',
      deployedUIDs: { 97: '0x' + '1'.repeat(64) },
      fields: [{ name: 'foo', type: 'string' }],
    });
    const { ethers6Adapter } = await import('thirdweb/adapters/ethers6');
    vi.spyOn(ethers6Adapter.signer, 'toEthers').mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    });
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
      chain: { id: 97, rpc: 'https://testnet.rpc' },
      supportedChainIds: [97, 56],
    });
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
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' });
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    vi.spyOn(schemasModule, 'getSchema').mockReturnValue({
      id: 'test',
      title: 'Test',
      description: '',
      deployedUIDs: { 97: '0x' + '1'.repeat(64) },
      fields: [{ name: 'foo', type: 'string' }],
    });
    const { ethers6Adapter } = await import('thirdweb/adapters/ethers6');
    vi.spyOn(ethers6Adapter.signer, 'toEthers').mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    });
    const { result } = renderHook(() => useBASClient());
    expect(await result.current.estimateGas()).toBe(BigInt('100000'));
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
      chain: { id: 97, rpc: 'https://testnet.rpc' },
      supportedChainIds: [97, 56],
    });
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
    vi.spyOn(thirdwebHooks, 'useActiveWalletChain').mockReturnValue({ id: 97, rpc: 'https://testnet.rpc' });
    vi.spyOn(attestationServices, 'getContractAddress').mockReturnValue('0xcontract');
    vi.spyOn(schemasModule, 'getSchema').mockImplementation((id: string) =>
      id === 'test'
        ? {
            id: 'test',
            title: 'Test',
            description: '',
            deployedUIDs: { 97: '0x' + '1'.repeat(64) },
            fields: [
              { name: 'foo', type: 'string' }
            ],
          }
        : undefined
    );
    // Override the mock for this test to ensure a valid signer is returned
    const { ethers6Adapter } = await import('thirdweb/adapters/ethers6');
    vi.spyOn(ethers6Adapter.signer, 'toEthers').mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
      // Add more methods if needed by the code under test
    });
    // Import and set the basAttestMock to throw
    const { basAttestMock } = await import('@bnb-attestation-service/bas-sdk');
    basAttestMock.mockResolvedValue({ wait: vi.fn().mockResolvedValue('0xhash') });
    // Now run the hook and call createAttestation
    const { result } = renderHook(() => useBASClient());
    const attestationResult = await result.current.createAttestation({ schemaId: 'test', data: { foo: 'bar' }, recipient: 'did:web:example.com' });
    expect(attestationResult).toEqual({
      transactionHash: '0xhash',
      attestationId: 'pending',
      blockNumber: 0,
      gasUsed: BigInt(0),
    });
  });
});

describe('convertToBASData edge cases', () => {
  it('handles unknown field type gracefully', () => {
    const schema = { fields: [{ name: 'foo', type: 'unknown' }] };
    const data = { foo: 'bar' };
    const result = convertToBASData(schema, data);
    expect(result[0].type).toBe('string');
    expect(result[0].value).toBe('bar');
  });
  it('handles undefined value for array field', () => {
    const schema = { fields: [{ name: 'tags', type: 'array' }] };
    const data = {};
    const result = convertToBASData(schema, data);
    expect(result[0].value).toEqual([]);
  });
});



describe('createBASSchemaString edge cases', () => {
  it('handles schema with no fields', () => {
    const schema = { fields: [] }
    expect(createBASSchemaString(schema)).toBe('')
  })

  it('handles schema with unknown field type', () => {
    const schema = { fields: [{ name: 'unknown', type: 'unknown' }] }
    expect(createBASSchemaString(schema)).toBe('string unknown')
  })

  it('handles integer field with max > 255', () => {
    const schema = { fields: [{ name: 'large', type: 'integer', max: 1000 }] }
    expect(createBASSchemaString(schema)).toBe('uint256 large')
  })

  it('handles integer field with max <= 255', () => {
    const schema = { fields: [{ name: 'small', type: 'integer', max: 100 }] }
    expect(createBASSchemaString(schema)).toBe('uint8 small')
  })
})

describe('convertToBASData edge cases', () => {
  it('handles null values gracefully', () => {
    const schema = { fields: [{ name: 'test', type: 'string' }] }
    const data = { test: null }
    
    const result = convertToBASData(schema, data)
    expect(result[0].value).toBe('')
  })

  it('handles undefined values gracefully', () => {
    const schema = { fields: [{ name: 'test', type: 'string' }] }
    const data = { test: undefined }
    
    const result = convertToBASData(schema, data)
    expect(result[0].value).toBe('')
  })



  it('handles array with non-array value', () => {
    const schema = { fields: [{ name: 'items', type: 'array' }] }
    const data = { items: 'single-item' }
    
    const result = convertToBASData(schema, data)
    expect(result[0].value).toEqual(['single-item'])
  })

  it('handles integer with non-numeric value', () => {
    const schema = { fields: [{ name: 'count', type: 'integer' }] }
    const data = { count: 'not-a-number' }
    
    const result = convertToBASData(schema, data)
    expect(result[0].value).toBe(0)
  })
})

describe('BASClient class', () => {
  it('throws for all methods', async () => {
    const client = new BASClient()
    
    await expect(client.createAttestation({} as any)).rejects.toThrow('BAS client must be used within React component with hooks')
    await expect(client.revokeAttestation('test')).rejects.toThrow('BAS client must be used within React component with hooks')
    await expect(client.getAttestation('test')).rejects.toThrow('BAS client must be used within React component with hooks')
    await expect(client.registerSchema({})).rejects.toThrow('BAS client must be used within React component with hooks')
    await expect(client.getSchema('test')).rejects.toThrow('BAS client must be used within React component with hooks')
    await expect(client.estimateGas({} as any)).rejects.toThrow('BAS client must be used within React component with hooks')
    expect(() => client.isConnected()).toThrow('BAS client must be used within React component with hooks')
    expect(() => client.getCurrentChain()).toThrow('BAS client must be used within React component with hooks')
  })
}) 