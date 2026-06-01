import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('service-urls', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  async function importFresh() {
    return await import('@/lib/service-urls');
  }

  describe('buildServiceUrl', () => {
    it('returns an http(s) URL unchanged except for trailing slashes', async () => {
      const { buildServiceUrl } = await importFresh();
      expect(buildServiceUrl('https://example.com/')).toBe('https://example.com');
      expect(buildServiceUrl('http://example.com///')).toBe('http://example.com');
    });

    it('uses http:// for localhost and port-based local domains', async () => {
      const { buildServiceUrl } = await importFresh();
      expect(buildServiceUrl('localhost:3001')).toBe('http://localhost:3001');
      expect(buildServiceUrl('127.0.0.1:8080')).toBe('http://127.0.0.1:8080');
    });

    it('applies no prefix for omachain-mainnet', async () => {
      process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'omachain-mainnet';
      const { buildServiceUrl } = await importFresh();
      expect(buildServiceUrl('backend.omatrust.org')).toBe('https://backend.omatrust.org');
    });

    it('applies the preview. prefix for omachain-testnet', async () => {
      process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'omachain-testnet';
      const { buildServiceUrl } = await importFresh();
      expect(buildServiceUrl('backend.omatrust.org')).toBe('https://preview.backend.omatrust.org');
    });

    it('applies the dev. prefix for omachain-devnet', async () => {
      process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'omachain-devnet';
      const { buildServiceUrl } = await importFresh();
      expect(buildServiceUrl('backend.omatrust.org')).toBe('https://dev.backend.omatrust.org');
    });

    it('defaults to the preview. prefix for unknown chains', async () => {
      process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'some-other-chain';
      const { buildServiceUrl } = await importFresh();
      expect(buildServiceUrl('backend.omatrust.org')).toBe('https://preview.backend.omatrust.org');
    });

    it('defaults to omachain-testnet (preview.) when no active chain is set', async () => {
      delete process.env.NEXT_PUBLIC_ACTIVE_CHAIN;
      const { buildServiceUrl } = await importFresh();
      expect(buildServiceUrl('backend.omatrust.org')).toBe('https://preview.backend.omatrust.org');
    });
  });

  describe('getBackendOrigin', () => {
    it('builds the backend origin from the active chain + default domain', async () => {
      process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'omachain-mainnet';
      delete process.env.NEXT_PUBLIC_OMATRUST_BACKEND_DOMAIN;
      const { getBackendOrigin } = await importFresh();
      expect(getBackendOrigin()).toBe('https://backend.omatrust.org');
    });

    it('honors a custom backend domain override', async () => {
      process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'omachain-testnet';
      process.env.NEXT_PUBLIC_OMATRUST_BACKEND_DOMAIN = 'api.example.com';
      const { getBackendOrigin } = await importFresh();
      expect(getBackendOrigin()).toBe('https://preview.api.example.com');
    });

    it('treats a localhost backend domain as a local override', async () => {
      process.env.NEXT_PUBLIC_OMATRUST_BACKEND_DOMAIN = 'localhost:3001';
      const { getBackendOrigin } = await importFresh();
      expect(getBackendOrigin()).toBe('http://localhost:3001');
    });
  });
});
