import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BackendApiError,
  isBackendNetworkError,
  getBackendErrorMessage,
  shouldRouteBackendErrorToAccount,
  buildWalletDid,
  deriveDidWebFromInput,
  deriveSubjectUrlHint,
  getSessionMe,
  logoutSession,
  getControllerConfirmation,
  getRelayEasNonce,
  postRelayEasDelegatedAttest,
} from '@/lib/omatrust-backend';

vi.mock('@/lib/service-urls', () => ({
  getBackendOrigin: () => 'https://backend.test',
}));

describe('omatrust-backend pure helpers', () => {
  describe('BackendApiError', () => {
    it('captures status, code, and details', () => {
      const err = new BackendApiError('boom', 409, 'CONFLICT', 'already exists');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('BackendApiError');
      expect(err.message).toBe('boom');
      expect(err.status).toBe(409);
      expect(err.code).toBe('CONFLICT');
      expect(err.details).toBe('already exists');
    });
  });

  describe('isBackendNetworkError', () => {
    it('is true only for the BACKEND_UNREACHABLE code', () => {
      expect(isBackendNetworkError(new BackendApiError('x', 0, 'BACKEND_UNREACHABLE'))).toBe(true);
      expect(isBackendNetworkError(new BackendApiError('x', 500, 'INTERNAL'))).toBe(false);
      expect(isBackendNetworkError(new Error('x'))).toBe(false);
    });
  });

  describe('getBackendErrorMessage', () => {
    it('maps known backend error codes to friendly copy', () => {
      expect(getBackendErrorMessage(new BackendApiError('x', 402, 'SPONSORED_WRITE_LIMIT_EXCEEDED')))
        .toMatch(/used all sponsored writes/i);
      expect(getBackendErrorMessage(new BackendApiError('x', 402, 'SUBSCRIPTION_INACTIVE')))
        .toMatch(/subscription is not active/i);
      expect(getBackendErrorMessage(new BackendApiError('x', 400, 'SCHEMA_NOT_ELIGIBLE')))
        .toMatch(/not available for sponsored publishing/i);
      expect(getBackendErrorMessage(new BackendApiError('x', 400, 'ATTESTER_MISMATCH')))
        .toMatch(/does not match the signed-in account/i);
    });

    it('falls back to details then message for unknown codes', () => {
      expect(getBackendErrorMessage(new BackendApiError('the message', 500, 'WHATEVER', 'the details')))
        .toBe('the details');
      expect(getBackendErrorMessage(new BackendApiError('the message', 500, 'WHATEVER')))
        .toBe('the message');
    });

    it('handles plain errors and unknown values', () => {
      expect(getBackendErrorMessage(new Error('plain'))).toBe('plain');
      expect(getBackendErrorMessage('not-an-error')).toMatch(/something went wrong/i);
    });
  });

  describe('shouldRouteBackendErrorToAccount', () => {
    it('is true for billing/subscription codes only', () => {
      expect(shouldRouteBackendErrorToAccount(new BackendApiError('x', 402, 'SPONSORED_WRITE_LIMIT_EXCEEDED'))).toBe(true);
      expect(shouldRouteBackendErrorToAccount(new BackendApiError('x', 402, 'SUBSCRIPTION_INACTIVE'))).toBe(true);
      expect(shouldRouteBackendErrorToAccount(new BackendApiError('x', 400, 'ATTESTER_MISMATCH'))).toBe(false);
      expect(shouldRouteBackendErrorToAccount(new Error('x'))).toBe(false);
    });
  });

  describe('buildWalletDid', () => {
    it('builds a did:pkh from address and chainId', () => {
      expect(buildWalletDid('0xabc', 1)).toBe('did:pkh:eip155:1:0xabc');
      expect(buildWalletDid('0xdef', 66238)).toBe('did:pkh:eip155:66238:0xdef');
    });
  });

  describe('deriveDidWebFromInput', () => {
    it('returns null for empty input', () => {
      expect(deriveDidWebFromInput('')).toBeNull();
      expect(deriveDidWebFromInput('   ')).toBeNull();
    });

    it('passes through an existing did:web', () => {
      expect(deriveDidWebFromInput('did:web:example.com')).toBe('did:web:example.com');
    });

    it('derives did:web from a bare domain', () => {
      expect(deriveDidWebFromInput('Example.com')).toBe('did:web:example.com');
    });

    it('derives did:web from a full URL with path', () => {
      expect(deriveDidWebFromInput('https://Example.com/some/path')).toBe('did:web:example.com');
    });
  });

  describe('deriveSubjectUrlHint', () => {
    it('returns empty string for nullish/blank input', () => {
      expect(deriveSubjectUrlHint(null)).toBe('');
      expect(deriveSubjectUrlHint(undefined)).toBe('');
      expect(deriveSubjectUrlHint('   ')).toBe('');
    });

    it('strips the did:web: prefix', () => {
      expect(deriveSubjectUrlHint('did:web:example.com')).toBe('example.com');
    });

    it('returns the trimmed value for non-did:web input', () => {
      expect(deriveSubjectUrlHint('  example.com  ')).toBe('example.com');
    });
  });
});

describe('omatrust-backend fetch wrapper', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function okResponse(body: unknown) {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('sends credentials and JSON headers, and returns the parsed body', async () => {
    const me = { account: { id: 'a1', displayName: 'Jane' }, wallet: null };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okResponse(me));

    const result = await getSessionMe();

    expect(result).toEqual(me);
    const [url, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://backend.test/api/private/session/me');
    expect(options.credentials).toBe('include');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('issues a POST for logout', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okResponse({ success: true }));

    const result = await logoutSession();

    expect(result).toEqual({ success: true });
    const [url, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://backend.test/api/private/session/logout');
    expect(options.method).toBe('POST');
  });

  it('throws a BackendApiError with code/details on a non-ok response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Limit exceeded', code: 'SPONSORED_WRITE_LIMIT_EXCEEDED', details: 'used 100/100' }), {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(getSessionMe()).rejects.toMatchObject({
      name: 'BackendApiError',
      status: 402,
      code: 'SPONSORED_WRITE_LIMIT_EXCEEDED',
      details: 'used 100/100',
      message: 'Limit exceeded',
    });
  });

  it('throws a BackendApiError with a default message when the error body is not JSON', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('not json', { status: 500 })
    );

    await expect(getSessionMe()).rejects.toMatchObject({
      name: 'BackendApiError',
      status: 500,
      message: 'Backend request failed with 500',
    });
  });

  it('wraps fetch failures as BACKEND_UNREACHABLE', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(getSessionMe()).rejects.toMatchObject({
      name: 'BackendApiError',
      status: 0,
      code: 'BACKEND_UNREACHABLE',
    });
  });

  it('builds the controller-confirm query string from params', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okResponse({ warnings: [] }));

    await getControllerConfirmation({ subjectDid: 'did:web:example.com', walletDid: 'did:pkh:eip155:1:0xabc' });

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('/api/public/controller-confirm?');
    expect(url).toContain('subjectDid=did%3Aweb%3Aexample.com');
    expect(url).toContain('walletDid=did%3Apkh%3Aeip155%3A1%3A0xabc');
  });

  it('omits walletDid from the query when not provided', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okResponse({ warnings: [] }));

    await getControllerConfirmation({ subjectDid: 'did:web:example.com' });

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('subjectDid=did%3Aweb%3Aexample.com');
    expect(url).not.toContain('walletDid=');
  });

  it('encodes the attester in the relay nonce query', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okResponse({ nonce: '1' }));

    await getRelayEasNonce('0xABC');

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://backend.test/api/private/relay/eas/nonce?attester=0xABC');
  });

  it('serializes bigint values in the delegated-attest body', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okResponse({ success: true }));

    await postRelayEasDelegatedAttest({
      attester: '0xabc',
      prepared: { nonce: 5n },
      signature: '0xsig',
    });

    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.prepared.nonce).toBe('5');
  });
});
