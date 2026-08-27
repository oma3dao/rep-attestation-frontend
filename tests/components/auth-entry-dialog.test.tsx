import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockUseActiveAccount = vi.fn();
const mockUseActiveWallet = vi.fn();
const mockDisconnect = vi.fn();
const routerPush = vi.fn();

const mockRefreshSession = vi.fn();
const mockSetSession = vi.fn();
const mockBackendSession = vi.hoisted(() => ({
  session: null as {
    account: { displayName: string }
    wallet?: { did: string }
    primarySubject?: { canonicalDid: string } | null
  } | null,
}));

const mockCreateWalletChallenge = vi.fn();
const mockVerifyWalletSession = vi.fn();
const mockRegisterWalletSession = vi.fn();
const mockPatchAccountMe = vi.fn();
const mockVerifySubjectOwnership = vi.fn();
const mockCreateSubject = vi.fn();
const mockListSubjects = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}));

const mockConnectModal = vi.hoisted(() => ({
  connect: vi.fn(),
  isConnecting: false,
}))

vi.mock('thirdweb/react', () => ({
  useActiveAccount: () => mockUseActiveAccount(),
  useActiveWallet: () => mockUseActiveWallet(),
  useDisconnect: () => ({ disconnect: mockDisconnect }),
  useConnectModal: () => mockConnectModal,
}));

vi.mock('thirdweb/chains', () => ({
  defineChain: (x: unknown) => x,
}));

vi.mock('@/app/client', () => ({ client: {} }));
vi.mock('@/config/wallets', () => ({ allWallets: [], nativeWallets: [] }));
vi.mock('@/lib/wallet-cleanup', () => ({ clearWalletBrowserState: vi.fn() }));
vi.mock('@/lib/blockchain', () => ({ getActiveChain: () => ({ id: 1 }) }));

vi.mock('@/components/backend-session-provider', () => ({
  useBackendSession: () => ({
    refreshSession: mockRefreshSession,
    session: mockBackendSession.session,
    setSession: (value: typeof mockBackendSession.session) => {
      mockBackendSession.session = value;
      mockSetSession(value);
    },
  }),
}));

vi.mock('@/lib/omatrust-backend', () => {
  class BackendApiError extends Error {
    status: number;
    code?: string;
    details?: string;
    constructor(message: string, status: number, code?: string, details?: string) {
      super(message);
      this.name = 'BackendApiError';
      this.status = status;
      this.code = code;
      this.details = details;
    }
  }
  return {
    BackendApiError,
    buildWalletDid: (address: string, chainId: number) => `did:pkh:eip155:${chainId}:${address}`,
    createSubject: (...args: unknown[]) => mockCreateSubject(...args),
    createWalletChallenge: (...args: unknown[]) => mockCreateWalletChallenge(...args),
    deriveDidWebFromInput: (input: string) => {
      const raw = input.trim();
      if (!raw) return null;
      if (raw.startsWith('did:')) return raw;
      return `did:web:${raw}`;
    },
    deriveSubjectUrlHint: (input?: string | null) => input ?? '',
    listSubjects: (...args: unknown[]) => mockListSubjects(...args),
    patchAccountMe: (...args: unknown[]) => mockPatchAccountMe(...args),
    registerWalletSession: (...args: unknown[]) => mockRegisterWalletSession(...args),
    verifySubjectOwnership: (...args: unknown[]) => mockVerifySubjectOwnership(...args),
    verifyWalletSession: (...args: unknown[]) => mockVerifyWalletSession(...args),
  };
});

import { AuthEntryDialog } from '@/components/auth-entry-dialog';
import { BackendApiError } from '@/lib/omatrust-backend';
import type { AuthDialogRequest } from '@/components/backend-session-provider';

function makeRequest(overrides: Partial<AuthDialogRequest> = {}): AuthDialogRequest {
  return {
    open: true,
    mode: 'chooser',
    reason: 'navigation',
    ...overrides,
  };
}

function makeSubmissionSignInRequest(overrides: Partial<AuthDialogRequest> = {}): AuthDialogRequest {
  return makeRequest({
    mode: 'signin',
    reason: 'submission',
    subjectScoped: true,
    subjectHint: 'example.com',
    ...overrides,
  });
}

async function reachSetupSubjectStep() {
  const signMessage = vi.fn().mockResolvedValue('0xsignature');
  mockUseActiveAccount.mockReturnValue({ address: '0xabc', signMessage });
  mockUseActiveWallet.mockReturnValue({ id: 'io.metamask' });
  mockCreateWalletChallenge.mockResolvedValue({
    challengeId: 'c1',
    siweMessage: 'sign this',
    nonce: 'n1',
    expiresAt: 'later',
  });
  mockVerifyWalletSession.mockResolvedValue({});
  mockRefreshSession.mockResolvedValue({
    account: { displayName: 'Test User' },
    wallet: { did: 'did:pkh:eip155:1:0xabc' },
    primarySubject: null,
  });

  render(<AuthEntryDialog request={makeSubmissionSignInRequest()} onOpenChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

  await waitFor(() => {
    expect(screen.getByText('Add your Service ID.')).toBeInTheDocument();
  });
}

describe('AuthEntryDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectModal.isConnecting = false;
    mockBackendSession.session = null;
    mockUseActiveAccount.mockReturnValue(undefined);
    mockUseActiveWallet.mockReturnValue(undefined);
  });

  it('renders the chooser with both account options', () => {
    render(<AuthEntryDialog request={makeRequest()} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Existing account')).toBeInTheDocument();
    expect(screen.getByText('New account')).toBeInTheDocument();
  });

  it('renders the sign-in step for mode "signin"', () => {
    render(<AuthEntryDialog request={makeRequest({ mode: 'signin' })} onOpenChange={vi.fn()} />);
    expect(screen.getAllByText('Sign In').length).toBeGreaterThan(0);
    expect(screen.queryByText('New account')).not.toBeInTheDocument();
  });

  it('renders the create-account step for mode "signup"', () => {
    render(<AuthEntryDialog request={makeRequest({ mode: 'signup' })} onOpenChange={vi.fn()} />);
    expect(screen.getByLabelText('Display name')).toBeInTheDocument();
  });

  it('renders a hint message when present', () => {
    render(
      <AuthEntryDialog
        request={makeRequest({ hintMessage: 'Please sign in to continue' })}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByText('Please sign in to continue')).toBeInTheDocument();
  });

  it('navigates from the chooser to the create-account step', () => {
    render(<AuthEntryDialog request={makeRequest()} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getByLabelText('Display name')).toBeInTheDocument();
  });

  it('keeps Create Account disabled until a display name is entered', () => {
    render(<AuthEntryDialog request={makeRequest({ mode: 'signup' })} onOpenChange={vi.fn()} />);
    const createButton = screen.getByRole('button', { name: 'Create Account' });
    expect(createButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Jane' } });
    expect(createButton).toBeEnabled();
  });

  it('runs the sign-in challenge/verify flow and navigates on success', async () => {
    const signMessage = vi.fn().mockResolvedValue('0xsignature');
    mockUseActiveAccount.mockReturnValue({ address: '0xabc', signMessage });
    mockUseActiveWallet.mockReturnValue({ id: 'io.metamask' });
    mockCreateWalletChallenge.mockResolvedValue({
      challengeId: 'c1',
      siweMessage: 'sign this',
      nonce: 'n1',
      expiresAt: 'later',
    });
    mockVerifyWalletSession.mockResolvedValue({});
    mockRefreshSession.mockResolvedValue({ account: { id: 'a1', displayName: 'Jane' } });

    const onOpenChange = vi.fn();
    render(<AuthEntryDialog request={makeRequest({ mode: 'signin' })} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockCreateWalletChallenge).toHaveBeenCalled();
    });
    expect(signMessage).toHaveBeenCalledWith({ message: 'sign this' });
    await waitFor(() => {
      expect(mockVerifyWalletSession).toHaveBeenCalledWith(
        expect.objectContaining({ challengeId: 'c1', walletDid: 'did:pkh:eip155:1:0xabc' })
      );
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(routerPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows a friendly error when the challenge request fails', async () => {
    mockUseActiveAccount.mockReturnValue({ address: '0xabc', signMessage: vi.fn() });
    mockUseActiveWallet.mockReturnValue({ id: 'io.metamask' });
    mockCreateWalletChallenge.mockRejectedValue(new BackendApiError('nope', 401, 'INVALID_CHALLENGE'));

    render(<AuthEntryDialog request={makeRequest({ mode: 'signin' })} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText(/expired or became invalid/i)).toBeInTheDocument();
    });
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('registers a new account, patches the display name, and navigates', async () => {
    const signMessage = vi.fn().mockResolvedValue('0xsignature');
    mockUseActiveAccount.mockReturnValue({ address: '0xabc', signMessage });
    mockUseActiveWallet.mockReturnValue({ id: 'io.metamask' });
    mockCreateWalletChallenge.mockResolvedValue({
      challengeId: 'c1',
      siweMessage: 'sign this',
      nonce: 'n1',
      expiresAt: 'later',
    });
    mockRegisterWalletSession.mockResolvedValue({});
    mockPatchAccountMe.mockResolvedValue({ account: { id: 'a1', displayName: 'Jane' } });
    mockRefreshSession.mockResolvedValue({ account: { id: 'a1', displayName: 'Jane' } });

    const onOpenChange = vi.fn();
    render(<AuthEntryDialog request={makeRequest({ mode: 'signup' })} onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Jane' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(mockRegisterWalletSession).toHaveBeenCalledWith(
        expect.objectContaining({
          challengeId: 'c1',
          walletDid: 'did:pkh:eip155:1:0xabc',
          executionMode: 'subscription',
        })
      );
    });
    expect(mockPatchAccountMe).toHaveBeenCalledWith({ displayName: 'Jane' });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(routerPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('redirects to signup when sign-in finds no account', async () => {
    const hrefSetter = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href() {
          return 'http://localhost/';
        },
        set href(value: string) {
          hrefSetter(value);
        },
        host: 'localhost',
        origin: 'http://localhost',
      },
    });

    mockUseActiveAccount.mockReturnValue({
      address: '0xabc',
      signMessage: vi.fn().mockResolvedValue('0xsignature'),
    });
    mockUseActiveWallet.mockReturnValue({ id: 'io.metamask' });
    mockCreateWalletChallenge.mockResolvedValue({
      challengeId: 'c1',
      siweMessage: 'sign this',
      nonce: 'n1',
      expiresAt: 'later',
    });
    mockVerifyWalletSession.mockRejectedValue(
      new BackendApiError('missing', 404, 'ACCOUNT_NOT_FOUND')
    );

    render(<AuthEntryDialog request={makeRequest({ mode: 'signin' })} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(hrefSetter).toHaveBeenCalledWith('/?action=signup&hint=no-account');
    });
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('redirects to sign-in when signup finds an existing account', async () => {
    const hrefSetter = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href() {
          return 'http://localhost/';
        },
        set href(value: string) {
          hrefSetter(value);
        },
        host: 'localhost',
        origin: 'http://localhost',
      },
    });

    mockUseActiveAccount.mockReturnValue({
      address: '0xabc',
      signMessage: vi.fn().mockResolvedValue('0xsignature'),
    });
    mockUseActiveWallet.mockReturnValue({ id: 'io.metamask' });
    mockCreateWalletChallenge.mockResolvedValue({
      challengeId: 'c1',
      siweMessage: 'sign this',
      nonce: 'n1',
      expiresAt: 'later',
    });
    mockRegisterWalletSession.mockRejectedValue(
      new BackendApiError('exists', 409, 'ACCOUNT_ALREADY_EXISTS')
    );

    render(<AuthEntryDialog request={makeRequest({ mode: 'signup' })} onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Jane' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(hrefSetter).toHaveBeenCalledWith('/?action=signin&hint=account-exists');
    });
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('lands on setupSubject after submission sign-in without a primary subject', async () => {
    await reachSetupSubjectStep();

    expect(screen.getByText('Verify and Add Service ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Organization URL')).toHaveValue('example.com');
  });

  it('verifies and attaches a service ID, then shows the authenticated step', async () => {
    await reachSetupSubjectStep();

    mockVerifySubjectOwnership.mockResolvedValue({ ok: true, method: 'dns' });
    mockCreateSubject.mockResolvedValue({
      subject: {
        id: 's1',
        canonicalDid: 'did:web:example.com',
        displayName: 'Example',
      },
    });
    mockRefreshSession.mockResolvedValue({
      account: { displayName: 'Test User' },
      wallet: { did: 'did:pkh:eip155:1:0xabc' },
      primarySubject: { canonicalDid: 'did:web:example.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Verify and Add Service ID' }));

    await waitFor(() => {
      expect(mockVerifySubjectOwnership).toHaveBeenCalledWith({
        subjectDid: 'did:web:example.com',
        connectedWalletDid: 'did:pkh:eip155:1:0xabc',
      });
    });
    expect(mockCreateSubject).toHaveBeenCalledWith({
      did: 'did:web:example.com',
      displayName: 'Test User',
    });
    await waitFor(() => {
      expect(screen.getByText("You're signed in.")).toBeInTheDocument();
      expect(screen.getByText(/Close this dialog and click Submit Attestation/i)).toBeInTheDocument();
    });
  });

  it('shows a verification message when ownership verification fails', async () => {
    await reachSetupSubjectStep();

    mockVerifySubjectOwnership.mockResolvedValue({
      ok: false,
      error: 'No matching DNS TXT record found.',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Verify and Add Service ID' }));

    await waitFor(() => {
      expect(screen.getByText('No matching DNS TXT record found.')).toBeInTheDocument();
    });
    expect(mockCreateSubject).not.toHaveBeenCalled();
  });

  it('falls back to listSubjects when the subject already exists', async () => {
    await reachSetupSubjectStep();

    mockVerifySubjectOwnership.mockResolvedValue({ ok: true, method: 'dns' });
    mockCreateSubject.mockRejectedValue(
      new BackendApiError('exists', 409, 'SUBJECT_ALREADY_EXISTS')
    );
    mockListSubjects.mockResolvedValue({
      subjects: [{ id: 's1', canonicalDid: 'did:web:example.com', displayName: 'Example' }],
    });
    mockRefreshSession.mockResolvedValue({
      account: { displayName: 'Test User' },
      wallet: { did: 'did:pkh:eip155:1:0xabc' },
      primarySubject: { canonicalDid: 'did:web:example.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Verify and Add Service ID' }));

    await waitFor(() => {
      expect(mockListSubjects).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText("You're signed in.")).toBeInTheDocument();
    });
  });

  it('does not call challenge when the wallet picker is canceled', async () => {
    mockUseActiveAccount.mockReturnValue(undefined);
    mockUseActiveWallet.mockReturnValue(undefined);
    mockConnectModal.connect.mockRejectedValue(new Error('User canceled'));

    render(<AuthEntryDialog request={makeRequest({ mode: 'signin' })} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockConnectModal.connect).toHaveBeenCalled();
    });
    expect(mockCreateWalletChallenge).not.toHaveBeenCalled();
    expect(mockUseActiveAccount()).toBeUndefined();
  });

  it('shows a friendly declined message and disconnects when signMessage rejects', async () => {
    mockUseActiveAccount.mockReturnValue({
      address: '0xabc',
      signMessage: vi.fn().mockRejectedValue(new Error('User rejected the request')),
    });
    mockUseActiveWallet.mockReturnValue({ id: 'io.metamask' });
    mockCreateWalletChallenge.mockResolvedValue({
      challengeId: 'c1',
      siweMessage: 'sign this',
      nonce: 'n1',
      expiresAt: 'later',
    });

    render(<AuthEntryDialog request={makeRequest({ mode: 'signin' })} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText(/declined the signature request/i)).toBeInTheDocument();
    });
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('shows cookie/cross-origin message when verify succeeds but session hydrate returns null', async () => {
    const signMessage = vi.fn().mockResolvedValue('0xsignature');
    mockUseActiveAccount.mockReturnValue({ address: '0xabc', signMessage });
    mockUseActiveWallet.mockReturnValue({ id: 'io.metamask' });
    mockCreateWalletChallenge.mockResolvedValue({
      challengeId: 'c1',
      siweMessage: 'sign this',
      nonce: 'n1',
      expiresAt: 'later',
    });
    mockVerifyWalletSession.mockResolvedValue({});
    mockRefreshSession.mockResolvedValue(null);

    render(<AuthEntryDialog request={makeRequest({ mode: 'signin' })} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText(/cookie or cross-origin issue/i)).toBeInTheDocument();
    });
  });

  it('lands on authenticated step when submission sign-in has a real primary subject', async () => {
    const signMessage = vi.fn().mockResolvedValue('0xsignature');
    mockUseActiveAccount.mockReturnValue({ address: '0xabc', signMessage });
    mockUseActiveWallet.mockReturnValue({ id: 'io.metamask' });
    mockCreateWalletChallenge.mockResolvedValue({
      challengeId: 'c1',
      siweMessage: 'sign this',
      nonce: 'n1',
      expiresAt: 'later',
    });
    mockVerifyWalletSession.mockResolvedValue({});
    mockRefreshSession.mockResolvedValue({
      account: { displayName: 'Test User' },
      wallet: { did: 'did:pkh:eip155:1:0xabc' },
      primarySubject: { canonicalDid: 'did:web:example.com' },
    });

    render(<AuthEntryDialog request={makeSubmissionSignInRequest()} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText("You're signed in.")).toBeInTheDocument();
    });
    expect(screen.queryByText('Add your Service ID.')).not.toBeInTheDocument();
  });

  it('disables verify on setupSubject when organization URL is cleared', async () => {
    await reachSetupSubjectStep();

    fireEvent.change(screen.getByLabelText('Organization URL'), { target: { value: '' } });

    expect(screen.getByRole('button', { name: 'Verify and Add Service ID' })).toBeDisabled();
    expect(screen.queryByText(/Service ID:/i)).not.toBeInTheDocument();
    expect(mockVerifySubjectOwnership).not.toHaveBeenCalled();
  });

  it('shows error when setupSubject service ID matches the wallet DID', async () => {
    await reachSetupSubjectStep();

    fireEvent.change(screen.getByLabelText('Organization URL'), {
      target: { value: 'did:pkh:eip155:1:0xabc' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and Add Service ID' }));

    await waitFor(() => {
      expect(screen.getByText(/different from your User ID/i)).toBeInTheDocument();
    });
    expect(mockVerifySubjectOwnership).not.toHaveBeenCalled();
  });

  it('maps CHALLENGE_EXPIRED to a friendly retry message', async () => {
    mockUseActiveAccount.mockReturnValue({
      address: '0xabc',
      signMessage: vi.fn().mockResolvedValue('0xsig'),
    });
    mockUseActiveWallet.mockReturnValue({ id: 'io.metamask' });
    mockCreateWalletChallenge.mockRejectedValue(
      new BackendApiError('expired', 401, 'CHALLENGE_EXPIRED')
    );

    render(<AuthEntryDialog request={makeRequest({ mode: 'signin' })} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText(/sign-in request expired/i)).toBeInTheDocument();
    });
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('maps BACKEND_UNREACHABLE to a friendly message', async () => {
    mockUseActiveAccount.mockReturnValue(undefined);
    mockUseActiveWallet.mockReturnValue(undefined);
    mockConnectModal.connect.mockResolvedValue({
      getAccount: () => ({
        address: '0xabc',
        signMessage: vi.fn().mockResolvedValue('0xsig'),
      }),
      id: 'io.metamask',
    });
    mockCreateWalletChallenge.mockRejectedValue(
      new BackendApiError('down', 503, 'BACKEND_UNREACHABLE')
    );

    render(<AuthEntryDialog request={makeRequest({ mode: 'signin' })} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText(/backend is not reachable/i)).toBeInTheDocument();
    });
  });

  it('shows createSubject ownership error when verify succeeds but attach fails with SUBJECT_OWNED_BY_ANOTHER_ACCOUNT', async () => {
    await reachSetupSubjectStep();

    mockVerifySubjectOwnership.mockResolvedValue({ ok: true, method: 'dns' });
    mockCreateSubject.mockRejectedValue(
      new BackendApiError('owned elsewhere', 409, 'SUBJECT_OWNED_BY_ANOTHER_ACCOUNT')
    );

    fireEvent.click(screen.getByRole('button', { name: 'Verify and Add Service ID' }));

    await waitFor(() => {
      expect(screen.getByText('owned elsewhere')).toBeInTheDocument();
    });
    expect(mockCreateSubject).toHaveBeenCalled();
  });

  it('shows verification service problem message when verifySubjectOwnership returns status >= 500', async () => {
    await reachSetupSubjectStep();

    mockVerifySubjectOwnership.mockRejectedValue(
      new BackendApiError('server error', 503, 'INTERNAL_ERROR')
    );

    fireEvent.click(screen.getByRole('button', { name: 'Verify and Add Service ID' }));

    await waitFor(() => {
      expect(
        screen.getByText(/problem with the verification service/i)
      ).toBeInTheDocument();
    });
    expect(mockCreateSubject).not.toHaveBeenCalled();
  });

  it('shows did.json hosting guidance when setupSubject verification method is toggled', async () => {
    await reachSetupSubjectStep();

    fireEvent.click(screen.getByRole('button', { name: 'did.json' }));

    expect(
      screen.getByText(/https:\/\/example\.com\/\.well-known\/did\.json/i)
    ).toBeInTheDocument();
  });

  it('includes did.json in the verification message when ownership verifies via did-document', async () => {
    await reachSetupSubjectStep();

    mockVerifySubjectOwnership.mockResolvedValue({ ok: true, method: 'did-document' });
    mockCreateSubject.mockImplementation(() => new Promise(() => {}));

    fireEvent.click(screen.getByRole('button', { name: 'Verify and Add Service ID' }));

    await waitFor(() => {
      expect(screen.getByText(/Ownership verified via did\.json/i)).toBeInTheDocument();
    });
  });

  it('maps EXECUTION_MODE_REQUIRED to a friendly message during signup', async () => {
    mockUseActiveAccount.mockReturnValue({
      address: '0xabc',
      signMessage: vi.fn().mockResolvedValue('0xsig'),
    });
    mockUseActiveWallet.mockReturnValue({ id: 'io.metamask' });
    mockCreateWalletChallenge.mockResolvedValue({
      challengeId: 'c1',
      siweMessage: 'sign this',
      nonce: 'n1',
      expiresAt: 'later',
    });
    mockRegisterWalletSession.mockRejectedValue(
      new BackendApiError('mode required', 400, 'EXECUTION_MODE_REQUIRED')
    );

    render(<AuthEntryDialog request={makeRequest({ mode: 'signup' })} onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Jane' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(
        screen.getByText(/Choose how your account should publish before we finish setup/i)
      ).toBeInTheDocument();
    });
  });

  it('maps EXECUTION_MODE_ALREADY_SET to a friendly message during sign-in', async () => {
    mockUseActiveAccount.mockReturnValue({
      address: '0xabc',
      signMessage: vi.fn().mockResolvedValue('0xsig'),
    });
    mockUseActiveWallet.mockReturnValue({ id: 'io.metamask' });
    mockCreateWalletChallenge.mockResolvedValue({
      challengeId: 'c1',
      siweMessage: 'sign this',
      nonce: 'n1',
      expiresAt: 'later',
    });
    mockVerifyWalletSession.mockRejectedValue(
      new BackendApiError('mode set', 409, 'EXECUTION_MODE_ALREADY_SET')
    );

    render(<AuthEntryDialog request={makeRequest({ mode: 'signin' })} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(
        screen.getByText(/already has a publishing mode configured/i)
      ).toBeInTheDocument();
    });
  });

  it('returns from Create Account back to the chooser in chooser mode', () => {
    render(<AuthEntryDialog request={makeRequest()} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getByLabelText('Display name')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByText('Existing account')).toBeInTheDocument();
    expect(screen.getByText('New account')).toBeInTheDocument();
  });

  it('shows attach failure when SUBJECT_ALREADY_EXISTS but listSubjects lacks the DID', async () => {
    await reachSetupSubjectStep();

    mockVerifySubjectOwnership.mockResolvedValue({ ok: true, method: 'dns' });
    mockCreateSubject.mockRejectedValue(
      new BackendApiError('exists', 409, 'SUBJECT_ALREADY_EXISTS')
    );
    mockListSubjects.mockResolvedValue({ subjects: [] });

    fireEvent.click(screen.getByRole('button', { name: 'Verify and Add Service ID' }));

    await waitFor(() => {
      expect(screen.getByText(/could not be attached to your account/i)).toBeInTheDocument();
    });
  });
  it('calls onOpenChange(false) when Close is clicked on the authenticated step', async () => {
    const signMessage = vi.fn().mockResolvedValue('0xsignature');
    mockUseActiveAccount.mockReturnValue({ address: '0xabc', signMessage });
    mockUseActiveWallet.mockReturnValue({ id: 'io.metamask' });
    mockCreateWalletChallenge.mockResolvedValue({
      challengeId: 'c1',
      siweMessage: 'sign this',
      nonce: 'n1',
      expiresAt: 'later',
    });
    mockVerifyWalletSession.mockResolvedValue({});
    mockRefreshSession.mockResolvedValue({
      account: { displayName: 'Test User' },
      wallet: { did: 'did:pkh:eip155:1:0xabc' },
      primarySubject: { canonicalDid: 'did:web:example.com' },
    });

    const onOpenChange = vi.fn();
    render(<AuthEntryDialog request={makeSubmissionSignInRequest()} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText("You're signed in.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });


  it('navigates to redirectTo after sign-in when provided', async () => {
    const signMessage = vi.fn().mockResolvedValue('0xsignature');
    mockUseActiveAccount.mockReturnValue({ address: '0xabc', signMessage });
    mockUseActiveWallet.mockReturnValue({ id: 'io.metamask' });
    mockCreateWalletChallenge.mockResolvedValue({
      challengeId: 'c1',
      siweMessage: 'sign this',
      nonce: 'n1',
      expiresAt: 'later',
    });
    mockVerifyWalletSession.mockResolvedValue({});
    mockRefreshSession.mockResolvedValue({ account: { id: 'a1', displayName: 'Jane' } });

    const onOpenChange = vi.fn();
    render(
      <AuthEntryDialog
        request={makeRequest({ mode: 'signin', redirectTo: '/publish/key-binding' })}
        onOpenChange={onOpenChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(routerPush).toHaveBeenCalledWith('/publish/key-binding');
    });
  });


  it('shows Check your wallet to continue while SIWE signature is pending', async () => {
    let resolveSign: ((value: string) => void) | undefined;
    const signMessage = vi.fn().mockImplementation(
      () => new Promise<string>((resolve) => {
        resolveSign = resolve;
      })
    );
    mockUseActiveAccount.mockReturnValue({ address: '0xabc', signMessage });
    mockUseActiveWallet.mockReturnValue({ id: 'io.metamask' });
    mockCreateWalletChallenge.mockResolvedValue({
      challengeId: 'c1',
      siweMessage: 'sign this',
      nonce: 'n1',
      expiresAt: 'later',
    });

    render(<AuthEntryDialog request={makeRequest({ mode: 'signin' })} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Check your wallet to continue')).toBeInTheDocument();

    resolveSign?.('0xsignature');
    await waitFor(() => {
      expect(mockVerifyWalletSession).toHaveBeenCalled();
    });
  });


})
