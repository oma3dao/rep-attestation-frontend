import { describe, it, expect } from 'vitest';
import { SUPPORTED_CHAINS, DEFAULT_CHAIN } from '@/config/chains';

describe('chains config', () => {
  it('exports SUPPORTED_CHAINS as an array with known chains', () => {
    expect(Array.isArray(SUPPORTED_CHAINS)).toBe(true);
    expect(SUPPORTED_CHAINS.length).toBeGreaterThan(0);
    // Check for known chain ids (BSC Testnet, BSC Mainnet, Sepolia, Mainnet)
    const chainIds = SUPPORTED_CHAINS.map(chain => chain.id);
    expect(chainIds).toEqual(expect.arrayContaining([97, 56, 11155111, 1]));
  });

  it('exports DEFAULT_CHAIN as one of the supported chains', () => {
    expect(SUPPORTED_CHAINS).toContain(DEFAULT_CHAIN);
    expect(DEFAULT_CHAIN.id).toBe(97); // BSC Testnet
  });
}); 