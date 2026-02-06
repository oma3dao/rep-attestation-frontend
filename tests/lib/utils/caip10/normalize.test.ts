import { describe, it, expect } from 'vitest';
import { normalizeCaip10 } from '@/lib/utils/caip10/normalize';

// Valid checksummed EVM address
const validEvmAddress = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';

describe('caip10/normalize', () => {
  describe('normalizeCaip10', () => {
    it('returns valid and normalized for valid eip155 CAIP-10', () => {
      const result = normalizeCaip10(`eip155:1:${validEvmAddress}`);
      expect(result.valid).toBe(true);
      expect(result.normalized).toBeDefined();
      expect(result.normalized).toMatch(/^eip155:1:0x/);
      expect(result.parsed).toBeDefined();
      expect(result.parsed?.namespace).toBe('eip155');
    });

    it('returns invalid when parse fails', () => {
      const result = normalizeCaip10('not-caip10');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns invalid for empty string', () => {
      const result = normalizeCaip10('');
      expect(result.valid).toBe(false);
    });

    it('returns invalid for unsupported namespace', () => {
      const result = normalizeCaip10('unknown:mainnet:abc123');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Unsupported namespace|eip155|solana|sui/i);
    });

    it('returns invalid when eip155 address is invalid', () => {
      const result = normalizeCaip10('eip155:1:0xinvalid');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns valid and normalized for valid solana CAIP-10', () => {
      const validSolana = 'solana:mainnet:HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH';
      const result = normalizeCaip10(validSolana);
      expect(result.valid).toBe(true);
      expect(result.normalized).toBeDefined();
      expect(result.normalized).toMatch(/^solana:mainnet:/i);
      expect(result.parsed?.namespace).toBe('solana');
    });

    it('returns invalid when solana address is invalid', () => {
      const result = normalizeCaip10('solana:mainnet:short');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns valid and normalized for valid sui CAIP-10', () => {
      const validSui = 'sui:mainnet:0x0000000000000000000000000000000000000000000000000000000000000001';
      const result = normalizeCaip10(validSui);
      expect(result.valid).toBe(true);
      expect(result.normalized).toBeDefined();
      expect(result.normalized).toMatch(/^sui:mainnet:0x/i);
      expect(result.parsed?.namespace).toBe('sui');
    });

    it('returns invalid when sui address is invalid', () => {
      const result = normalizeCaip10('sui:mainnet:nothex');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
