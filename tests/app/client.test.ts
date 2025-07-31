import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
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