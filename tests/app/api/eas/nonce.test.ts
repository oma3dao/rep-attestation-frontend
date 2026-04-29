/**
 * Tests for EAS nonce lookup API route
 * 
 * Tests the HTTP layer for GET /api/eas/nonce
 * Core business logic is tested in tests/lib/eas-routes.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the eas-routes module
vi.mock('@/lib/server/eas-routes', () => ({
  getNonce: vi.fn(),
  EasRouteError: class EasRouteError extends Error {
    statusCode: number;
    code?: string;
    constructor(message: string, statusCode: number, code?: string) {
      super(message);
      this.name = 'EasRouteError';
      this.statusCode = statusCode;
      this.code = code;
    }
  },
}));

describe('GET /api/eas/nonce', () => {
  const validAttester = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful requests', () => {
    it('returns nonce and chain info for valid attester', async () => {
      const { getNonce } = await import('@/lib/server/eas-routes');
      (getNonce as any).mockResolvedValue({
        nonce: '42',
        chain: 'OMAchain Testnet',
        chainId: 66238,
        easAddress: '0x8835AF90f1537777F52E482C8630cE4e947eCa32',
      });

      const { GET } = await import('@/app/api/eas/nonce/route');
      const req = new NextRequest(`http://localhost/api/eas/nonce?attester=${validAttester}`);
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.nonce).toBe('42');
      expect(json.chain).toBe('OMAchain Testnet');
      expect(json.chainId).toBe(66238);
      expect(json.easAddress).toBe('0x8835AF90f1537777F52E482C8630cE4e947eCa32');
      expect(json.elapsed).toBeDefined();
    });

    it('includes elapsed time in response', async () => {
      const { getNonce } = await import('@/lib/server/eas-routes');
      (getNonce as any).mockResolvedValue({
        nonce: '0',
        chain: 'OMAchain Testnet',
        chainId: 66238,
        easAddress: '0x8835AF90f1537777F52E482C8630cE4e947eCa32',
      });

      const { GET } = await import('@/app/api/eas/nonce/route');
      const req = new NextRequest(`http://localhost/api/eas/nonce?attester=${validAttester}`);
      const res = await GET(req);

      const json = await res.json();
      expect(json.elapsed).toMatch(/^\d+ms$/);
    });
  });

  describe('error handling', () => {
    it('returns 400 for missing attester parameter', async () => {
      const { getNonce, EasRouteError } = await import('@/lib/server/eas-routes');
      (getNonce as any).mockRejectedValue(
        new EasRouteError('Missing required parameter: attester', 400)
      );

      const { GET } = await import('@/app/api/eas/nonce/route');
      const req = new NextRequest('http://localhost/api/eas/nonce');
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Missing');
    });

    it('returns 400 for invalid attester address', async () => {
      const { getNonce, EasRouteError } = await import('@/lib/server/eas-routes');
      (getNonce as any).mockRejectedValue(
        new EasRouteError('Invalid attester address format', 400)
      );

      const { GET } = await import('@/app/api/eas/nonce/route');
      const req = new NextRequest('http://localhost/api/eas/nonce?attester=invalid');
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Invalid');
    });

    it('returns 500 for RPC errors', async () => {
      const { getNonce, EasRouteError } = await import('@/lib/server/eas-routes');
      (getNonce as any).mockRejectedValue(
        new EasRouteError('RPC connection failed', 500)
      );

      const { GET } = await import('@/app/api/eas/nonce/route');
      const req = new NextRequest(`http://localhost/api/eas/nonce?attester=${validAttester}`);
      const res = await GET(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toContain('RPC');
    });

    it('returns 500 for unexpected errors', async () => {
      const { getNonce } = await import('@/lib/server/eas-routes');
      (getNonce as any).mockRejectedValue(new Error('Unexpected error'));

      const { GET } = await import('@/app/api/eas/nonce/route');
      const req = new NextRequest(`http://localhost/api/eas/nonce?attester=${validAttester}`);
      const res = await GET(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Internal error');
    });

    it('includes error code when available', async () => {
      const { getNonce, EasRouteError } = await import('@/lib/server/eas-routes');
      (getNonce as any).mockRejectedValue(
        new EasRouteError('Test error', 400, 'TEST_CODE')
      );

      const { GET } = await import('@/app/api/eas/nonce/route');
      const req = new NextRequest(`http://localhost/api/eas/nonce?attester=${validAttester}`);
      const res = await GET(req);

      const json = await res.json();
      expect(json.code).toBe('TEST_CODE');
    });

    it('includes elapsed time in error responses', async () => {
      const { getNonce, EasRouteError } = await import('@/lib/server/eas-routes');
      (getNonce as any).mockRejectedValue(
        new EasRouteError('Test error', 400)
      );

      const { GET } = await import('@/app/api/eas/nonce/route');
      const req = new NextRequest(`http://localhost/api/eas/nonce?attester=${validAttester}`);
      const res = await GET(req);

      const json = await res.json();
      expect(json.elapsed).toMatch(/^\d+ms$/);
    });
  });

  describe('request parsing', () => {
    it('extracts attester from query string', async () => {
      const { getNonce } = await import('@/lib/server/eas-routes');
      (getNonce as any).mockResolvedValue({
        nonce: '0',
        chain: 'OMAchain Testnet',
        chainId: 66238,
        easAddress: '0x8835AF90f1537777F52E482C8630cE4e947eCa32',
      });

      const { GET } = await import('@/app/api/eas/nonce/route');
      const testAttester = '0xabcdef1234567890abcdef1234567890abcdef12';
      const req = new NextRequest(`http://localhost/api/eas/nonce?attester=${testAttester}`);
      await GET(req);

      expect(getNonce).toHaveBeenCalledWith(testAttester);
    });

    it('handles URL-encoded attester address', async () => {
      const { getNonce } = await import('@/lib/server/eas-routes');
      (getNonce as any).mockResolvedValue({
        nonce: '0',
        chain: 'OMAchain Testnet',
        chainId: 66238,
        easAddress: '0x8835AF90f1537777F52E482C8630cE4e947eCa32',
      });

      const { GET } = await import('@/app/api/eas/nonce/route');
      const testAttester = '0x1234567890123456789012345678901234567890';
      const req = new NextRequest(`http://localhost/api/eas/nonce?attester=${encodeURIComponent(testAttester)}`);
      await GET(req);

      expect(getNonce).toHaveBeenCalledWith(testAttester);
    });

    it('passes empty string when attester parameter is missing', async () => {
      const { getNonce, EasRouteError } = await import('@/lib/server/eas-routes');
      (getNonce as any).mockRejectedValue(
        new EasRouteError('Missing required parameter: attester', 400)
      );

      const { GET } = await import('@/app/api/eas/nonce/route');
      const req = new NextRequest('http://localhost/api/eas/nonce');
      await GET(req);

      expect(getNonce).toHaveBeenCalledWith('');
    });
  });
});
