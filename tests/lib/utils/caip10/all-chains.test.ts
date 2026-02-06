import { describe, it, expect } from 'vitest';
import { searchChains, getChainById, ALL_CHAINS } from '@/lib/utils/caip10/all-chains';

describe('lib/utils/caip10/all-chains', () => {
  describe('ALL_CHAINS', () => {
    it('is a non-empty array of mainnet chain infos', () => {
      expect(Array.isArray(ALL_CHAINS)).toBe(true);
      expect(ALL_CHAINS.length).toBeGreaterThan(0);
      const first = ALL_CHAINS[0];
      expect(first).toHaveProperty('chainId');
      expect(first).toHaveProperty('name');
      expect(first.testnet).toBe(false);
    });
  });

  describe('searchChains', () => {
    it('returns all chains when query is empty or whitespace', () => {
      expect(searchChains('').length).toBe(ALL_CHAINS.length);
      expect(searchChains('   ').length).toBe(ALL_CHAINS.length);
    });

    it('filters by chain name (case insensitive)', () => {
      const results = searchChains('ethereum');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(c => c.name.toLowerCase().includes('ethereum'))).toBe(true);
    });

    it('filters by chainId string', () => {
      const results = searchChains('1');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(c => c.chainId === 1)).toBe(true);
    });

    it('returns empty array when no match', () => {
      const results = searchChains('xyznonexistent999');
      expect(results).toEqual([]);
    });
  });

  describe('getChainById', () => {
    it('returns chain info for known chainId', () => {
      const chainId = ALL_CHAINS[0].chainId;
      const chain = getChainById(chainId);
      expect(chain).toBeDefined();
      expect(chain?.chainId).toBe(chainId);
      expect(chain?.name).toBeDefined();
    });

    it('returns undefined for unknown chainId', () => {
      expect(getChainById(999999)).toBeUndefined();
    });
  });
});
