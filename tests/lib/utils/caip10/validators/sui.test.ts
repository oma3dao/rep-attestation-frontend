import { describe, it, expect } from 'vitest';
import {
  validateSui,
  normalize0x32Bytes,
  isSuiAddress,
} from '@/lib/utils/caip10/validators/sui';

const validAddress = '0x0000000000000000000000000000000000000000000000000000000000000001';

describe('caip10/validators/sui', () => {
  describe('validateSui', () => {
    it('returns valid and normalized address for valid Sui CAIP-10', () => {
      const result = validateSui('mainnet', validAddress);
      expect(result.valid).toBe(true);
      expect(result.normalizedAddress).toBe(validAddress);
    });

    it('accepts mainnet, testnet, and devnet references', () => {
      expect(validateSui('mainnet', validAddress).valid).toBe(true);
      expect(validateSui('testnet', validAddress).valid).toBe(true);
      expect(validateSui('devnet', validAddress).valid).toBe(true);
    });

    it('returns error for invalid reference', () => {
      const result = validateSui('invalid', validAddress);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/mainnet|testnet|devnet/);
    });

    it('returns error when address does not start with 0x', () => {
      const result = validateSui('mainnet', validAddress.slice(2));
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/0x/);
    });

    it('returns error for non-hex characters', () => {
      const result = validateSui('mainnet', '0x' + 'g'.repeat(63));
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/hexadecimal/);
    });
  });

  describe('normalize0x32Bytes', () => {
    it('left-pads short address to 64 hex chars', () => {
      const result = normalize0x32Bytes('0x1');
      expect(result).toBe(validAddress);
    });

    it('returns Error when address does not start with 0x', () => {
      const result = normalize0x32Bytes('1');
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toMatch(/0x/);
    });

    it('returns Error when hex part exceeds 64 characters', () => {
      const result = normalize0x32Bytes('0x' + 'a'.repeat(65));
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toMatch(/exceeds/);
    });
  });

  describe('isSuiAddress', () => {
    it('returns true for valid 0x-prefixed hex (1–64 chars)', () => {
      expect(isSuiAddress('0x1')).toBe(true);
      expect(isSuiAddress(validAddress)).toBe(true);
    });

    it('returns false when missing 0x prefix', () => {
      expect(isSuiAddress(validAddress.slice(2))).toBe(false);
    });

    it('returns false for non-hex characters', () => {
      expect(isSuiAddress('0xgg')).toBe(false);
    });
  });
});
