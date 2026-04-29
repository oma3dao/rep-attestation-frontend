import { describe, it, expect } from 'vitest';
import { parseCaip10, buildCaip10 } from '@/lib/utils/caip10/parse';

describe('caip10/parse', () => {
  describe('parseCaip10', () => {
    it('parses valid eip155 CAIP-10', () => {
      const result = parseCaip10('eip155:1:0x1234567890123456789012345678901234567890');
      expect(result).not.toBeInstanceOf(Error);
      if (result instanceof Error) return;
      expect(result.namespace).toBe('eip155');
      expect(result.reference).toBe('1');
      expect(result.address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('parses valid CAIP-10 with chainId reference', () => {
      const result = parseCaip10('eip155:137:0xAbC1234567890123456789012345678901234567');
      expect(result).not.toBeInstanceOf(Error);
      if (result instanceof Error) return;
      expect(result.namespace).toBe('eip155');
      expect(result.reference).toBe('137');
      expect(result.address).toBe('0xAbC1234567890123456789012345678901234567');
    });

    it('trims whitespace', () => {
      const result = parseCaip10('  eip155:1:0x' + 'a'.repeat(40) + '  ');
      expect(result).not.toBeInstanceOf(Error);
      if (result instanceof Error) return;
      expect(result.namespace).toBe('eip155');
    });

    it('returns Error for empty string', () => {
      const result = parseCaip10('');
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toMatch(/required/i);
    });

    it('returns Error for invalid format (missing parts)', () => {
      const result = parseCaip10('eip155:1');
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toMatch(/Invalid CAIP-10|Expected/i);
    });

    it('returns Error for non-string input', () => {
      const result = parseCaip10(null as unknown as string);
      expect(result).toBeInstanceOf(Error);
    });
  });

  describe('buildCaip10', () => {
    it('builds CAIP-10 string from components', () => {
      expect(buildCaip10('eip155', '1', '0x' + 'a'.repeat(40))).toBe(
        'eip155:1:0x' + 'a'.repeat(40)
      );
    });
  });
});
