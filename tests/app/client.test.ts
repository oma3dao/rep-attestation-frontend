import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('client', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    // Reset to a clean env state
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('should create client with valid client ID', async () => {
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID = 'test-client-id';
    
    const { client } = await import('@/app/client');
    
    expect(client).toBeDefined();
    expect(typeof client).toBe('object');
  });

  it('should create client with placeholder when no client ID is provided (build time)', async () => {
    delete process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
    
    // Should not throw during import (server-side/build time)
    const { client } = await import('@/app/client');
    expect(client).toBeDefined();
    expect(typeof client).toBe('object');
  });

  it('should create client with placeholder when client ID is empty (build time)', async () => {
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID = '';
    
    // Should not throw during import (server-side/build time)  
    const { client } = await import('@/app/client');
    expect(client).toBeDefined();
    expect(typeof client).toBe('object');
  });
});

// Separate describe block for environment-specific tests to avoid module caching issues
describe('client environment handling', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('should throw in production when no client ID and window is defined', async () => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
    process.env.NODE_ENV = 'production';
    
    await expect(import('@/app/client')).rejects.toThrow(/no client id provided/i);
  });

  it('should warn when no client ID in development (not test)', async () => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
    process.env.NODE_ENV = 'development';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    const { client } = await import('@/app/client');
    
    expect(client).toBeDefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('NEXT_PUBLIC_THIRDWEB_CLIENT_ID'));
  });
}); 