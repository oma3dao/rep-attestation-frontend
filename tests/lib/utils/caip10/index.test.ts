import { describe, it, expect } from 'vitest';
import * as caip10 from '@/lib/utils/caip10';

describe('lib/utils/caip10 index', () => {
  it('re-exports parse and build from parse', () => {
    expect(typeof caip10.parseCaip10).toBe('function');
    expect(typeof caip10.buildCaip10).toBe('function');
  });

  it('re-exports normalize from normalize', () => {
    expect(typeof caip10.normalizeCaip10).toBe('function');
  });

  it('re-exports NON_EVM_CAIP2 from chains', () => {
    expect(caip10.NON_EVM_CAIP2).toBeDefined();
    expect(caip10.NON_EVM_CAIP2.solana).toBeDefined();
    expect(caip10.NON_EVM_CAIP2.sui).toBeDefined();
  });

  it('re-exports chain search and getChainById from all-chains', () => {
    expect(typeof caip10.searchChains).toBe('function');
    expect(typeof caip10.getChainById).toBe('function');
    expect(Array.isArray(caip10.ALL_CHAINS)).toBe(true);
  });

  it('re-exports EVM validators', () => {
    expect(typeof caip10.validateEvm).toBe('function');
    expect(typeof caip10.toEip55).toBe('function');
    expect(typeof caip10.isEvmAddress).toBe('function');
  });

  it('re-exports Solana validators', () => {
    expect(typeof caip10.validateSolana).toBe('function');
    expect(typeof caip10.isBase58).toBe('function');
  });

  it('re-exports Sui validators', () => {
    expect(typeof caip10.validateSui).toBe('function');
    expect(typeof caip10.normalize0x32Bytes).toBe('function');
    expect(typeof caip10.isSuiAddress).toBe('function');
  });
});
