import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_CHAINS,
  DEFAULT_CHAIN,
  CHAIN_IDS,
  CHAIN_NAMES,
  getChainName,
  getChainById,
} from '@/config/chains';

describe('chains config', () => {
  it('exports SUPPORTED_CHAINS as an array with known chains', () => {
    expect(Array.isArray(SUPPORTED_CHAINS)).toBe(true);
    expect(SUPPORTED_CHAINS.length).toBeGreaterThan(0);
    // Check for known chain ids (OMAchain Testnet, BSC Testnet, BSC Mainnet, Sepolia, Mainnet)
    const chainIds = SUPPORTED_CHAINS.map(chain => chain.id);
    expect(chainIds).toEqual(expect.arrayContaining([66238, 97, 56, 11155111, 1]));
  });

  it('exports DEFAULT_CHAIN as one of the supported chains', () => {
    expect(SUPPORTED_CHAINS).toContain(DEFAULT_CHAIN);
    expect(DEFAULT_CHAIN.id).toBe(66238); // OMAchain Testnet
  });
});

describe('getChainName', () => {
  it('returns known name for supported chain id', () => {
    expect(getChainName(CHAIN_IDS.OMACHAIN_TESTNET)).toBe('OMAchain Testnet');
    expect(getChainName(CHAIN_IDS.BSC_TESTNET)).toBe('BSC Testnet');
    expect(getChainName(CHAIN_IDS.MAINNET)).toBe('Ethereum Mainnet');
  });

  it('returns "Unknown Chain (id)" for unknown chain id', () => {
    expect(getChainName(99999)).toBe('Unknown Chain (99999)');
  });
});

describe('getChainById', () => {
  it('returns chain config for supported chain id', () => {
    const chain = getChainById(66238);
    expect(chain).toBeDefined();
    expect(chain?.id).toBe(66238);
    expect(chain?.name).toBe('OMAchain Testnet');
  });

  it('returns undefined for unknown chain id', () => {
    expect(getChainById(99999)).toBeUndefined();
  });
});

describe('CHAIN_IDS and CHAIN_NAMES', () => {
  it('CHAIN_NAMES has entry for each CHAIN_IDS value', () => {
    for (const [key, id] of Object.entries(CHAIN_IDS)) {
      expect(CHAIN_NAMES[id as number]).toBeDefined();
      expect(typeof CHAIN_NAMES[id as number]).toBe('string');
    }
  });
}); 