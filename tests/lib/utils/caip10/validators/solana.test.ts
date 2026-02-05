import { describe, it, expect } from 'vitest';
import { validateSolana, isBase58 } from '@/lib/utils/caip10/validators/solana';

// Valid Solana base58 address (32 bytes decoded)
const validAddress = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH';

describe('caip10/validators/solana', () => {
  describe('validateSolana', () => {
    it('returns valid and normalized address for valid Solana CAIP-10', () => {
      const result = validateSolana('mainnet', validAddress);
      expect(result.valid).toBe(true);
      expect(result.normalizedAddress).toBe(validAddress);
    });

    it('accepts devnet and testnet references', () => {
      expect(validateSolana('devnet', validAddress).valid).toBe(true);
      expect(validateSolana('testnet', validAddress).valid).toBe(true);
    });

    it('returns error for invalid reference', () => {
      const result = validateSolana('invalid', validAddress);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/mainnet|devnet|testnet/);
    });

    it('returns error when address contains invalid base58 characters', () => {
      const result = validateSolana('mainnet', '0OIl' + validAddress.slice(4));
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/base58/);
    });

    it('returns error when decoded length is not 32 bytes', () => {
      const shortBase58 = '1'; // decodes to 2 bytes (not 32)
      const result = validateSolana('mainnet', shortBase58);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Solana address must decode to 32 bytes');
    });

    it('returns error when base58 decodes to 1 byte (not 32)', () => {
      const result = validateSolana('mainnet', '2');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Solana address must decode to 32 bytes');
    });
  });

  describe('isBase58', () => {
    it('returns true for valid base58 string', () => {
      expect(isBase58(validAddress)).toBe(true);
      expect(isBase58('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz')).toBe(true);
    });

    it('returns false for string containing 0, O, I, or l', () => {
      expect(isBase58('0abc')).toBe(false);
      expect(isBase58('Oabc')).toBe(false);
      expect(isBase58('Iabc')).toBe(false);
      expect(isBase58('labc')).toBe(false);
    });
  });
});
