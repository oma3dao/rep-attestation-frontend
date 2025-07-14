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

  it('should throw error when no client ID is provided', async () => {
    delete process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
    
    await expect(import('@/app/client')).rejects.toThrow('No client ID provided');
  });

  it('should throw error when client ID is empty', async () => {
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID = '';
    
    await expect(import('@/app/client')).rejects.toThrow('No client ID provided');
  });
}); 