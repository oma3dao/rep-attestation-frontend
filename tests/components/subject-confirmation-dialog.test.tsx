import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockVerifySubjectOwnership = vi.fn();
const mockCreateSubject = vi.fn();

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
    verifySubjectOwnership: (...args: unknown[]) => mockVerifySubjectOwnership(...args),
    createSubject: (...args: unknown[]) => mockCreateSubject(...args),
  };
});

vi.mock('@/components/did-web-input', () => ({
  DidWebInput: ({ value, onChange }: { value: string; onChange: (v: string | null) => void }) => (
    <input
      data-testid="did-web-input"
      value={value}
      onChange={(e) => onChange(e.target.value || null)}
    />
  ),
}));

vi.mock('@/components/did-pkh-input', () => ({
  DidPkhInput: ({ value, onChange }: { value: string; onChange: (v: string | null) => void }) => (
    <input
      data-testid="did-pkh-input"
      value={value}
      onChange={(e) => onChange(e.target.value || null)}
    />
  ),
}));

vi.mock('@/components/caip10-input', () => ({
  Caip10Input: ({ value, onChange }: { value: string; onChange: (v: string | null) => void }) => (
    <input data-testid="caip10-input" value={value} onChange={(e) => onChange(e.target.value || null)} />
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
  }: {
    value: string;
    onValueChange: (v: string) => void;
  }) => (
    <select
      aria-label="ID format"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      data-testid="did-method-select"
    >
      <option value="did:web">did:web</option>
      <option value="did:pkh">did:pkh</option>
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
  SelectValue: () => null,
}));

import { SubjectConfirmationDialog } from '@/components/subject-confirmation-dialog';
import { BackendApiError } from '@/lib/omatrust-backend';

const WALLET_DID = 'did:pkh:eip155:1:0xabc';

function setup(overrides: Partial<React.ComponentProps<typeof SubjectConfirmationDialog>> = {}) {
  const onOpenChange = vi.fn();
  const onSubjectCreated = vi.fn();
  const view = render(
    <SubjectConfirmationDialog
      open
      onOpenChange={onOpenChange}
      walletDid={WALLET_DID}
      existingSubjectDids={[]}
      onSubjectCreated={onSubjectCreated}
      {...overrides}
    />
  );
  return { onOpenChange, onSubjectCreated, ...view };
}

describe('SubjectConfirmationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dialog title and a disabled Verify button initially', () => {
    setup();
    expect(screen.getByText('Verify Service ID Ownership')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });

  it('enables Verify once a subject identifier is entered', () => {
    setup();
    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: 'did:web:example.com' } });
    expect(screen.getByRole('button', { name: 'Verify' })).toBeEnabled();
  });

  it('blocks verifying a subject already attached to the account', () => {
    setup({ existingSubjectDids: ['did:web:example.com'] });
    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: 'did:web:example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(screen.getByText(/already attached to your account/i)).toBeInTheDocument();
    expect(mockVerifySubjectOwnership).not.toHaveBeenCalled();
  });

  it('shows a failure message when ownership verification does not succeed', async () => {
    mockVerifySubjectOwnership.mockResolvedValue({ ok: false, error: 'No TXT record found' });
    setup();
    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: 'did:web:example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => {
      expect(screen.getByText('No TXT record found')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });

  it('verifies ownership then submits the new subject', async () => {
    mockVerifySubjectOwnership.mockResolvedValue({ ok: true, method: 'dns' });
    mockCreateSubject.mockResolvedValue({ subject: { id: 's1', canonicalDid: 'did:web:example.com' } });
    const { onOpenChange, onSubjectCreated } = setup();

    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: 'did:web:example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(screen.getByText(/Ownership verified via DNS TXT/i)).toBeInTheDocument();
    });

    const submit = screen.getByRole('button', { name: 'Submit' });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() => {
      expect(mockCreateSubject).toHaveBeenCalledWith({ did: 'did:web:example.com' });
    });
    expect(onSubjectCreated).toHaveBeenCalledWith({ id: 's1', canonicalDid: 'did:web:example.com' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('surfaces a 500-level verification service error', async () => {
    mockVerifySubjectOwnership.mockRejectedValue(new BackendApiError('boom', 503));
    setup();
    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: 'did:web:example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => {
      expect(screen.getByText(/problem with the verification service/i)).toBeInTheDocument();
    });
  });

  it('requires sign-in before verifying when walletDid is null', () => {
    setup({ walletDid: null });
    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: 'did:web:example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(screen.getByText(/Sign in before verifying a service ID/i)).toBeInTheDocument();
    expect(mockVerifySubjectOwnership).not.toHaveBeenCalled();
  });

  it('rejects a subject DID that matches the wallet DID', () => {
    setup();
    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: WALLET_DID } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(screen.getByText(/matches your User ID/i)).toBeInTheDocument();
    expect(mockVerifySubjectOwnership).not.toHaveBeenCalled();
  });

  it('shows fallback verification message when verify returns ok:false with only details', async () => {
    mockVerifySubjectOwnership.mockResolvedValue({ ok: false, details: 'TXT record missing' });
    setup();
    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: 'did:web:example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => {
      expect(screen.getByText('TXT record missing')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });

  it('shows ownership verified message when verify succeeds', async () => {
    mockVerifySubjectOwnership.mockResolvedValue({ ok: true, method: 'wallet' });
    setup();
    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: 'did:web:example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => {
      expect(screen.getByText(/Ownership verified via wallet/i)).toBeInTheDocument();
    });
  });

  it('keeps Submit disabled until ownership is verified', () => {
    setup();
    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: 'did:web:example.com' } });
    expect(screen.getByRole('button', { name: 'Verify' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
    expect(mockCreateSubject).not.toHaveBeenCalled();
  });

  it('keeps dialog open when createSubject throws BackendApiError', async () => {
    mockVerifySubjectOwnership.mockResolvedValue({ ok: true, method: 'dns' });
    mockCreateSubject.mockRejectedValue(new BackendApiError('Subject limit reached', 400, 'LIMIT', 'Upgrade plan'));
    setup();
    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: 'did:web:example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => {
      expect(screen.getByText(/Ownership verified via DNS TXT/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => {
      expect(screen.getByText('Upgrade plan')).toBeInTheDocument();
    });
    expect(screen.getByText('Verify Service ID Ownership')).toBeInTheDocument();
  });

  it('shows did:pkh contract ownership instructions when switched to did:pkh', () => {
    setup();
    fireEvent.change(screen.getByTestId('did-method-select'), { target: { value: 'did:pkh' } });
    expect(screen.getByText(/How verification works/i)).toBeInTheDocument();
    expect(screen.getAllByText('owner()').length).toBeGreaterThan(0);
    expect(screen.getByTestId('did-pkh-input')).toBeInTheDocument();
  });

  it('verifies and submits a did:pkh subject successfully', async () => {
    const pkhDid = 'did:pkh:eip155:1:0x9999999999999999999999999999999999999999';
    mockVerifySubjectOwnership.mockResolvedValue({ ok: true, method: 'contract' });
    mockCreateSubject.mockResolvedValue({ subject: { id: 's2', canonicalDid: pkhDid } });
    const { onOpenChange, onSubjectCreated } = setup();

    fireEvent.change(screen.getByTestId('did-method-select'), { target: { value: 'did:pkh' } });
    fireEvent.change(screen.getByTestId('did-pkh-input'), { target: { value: pkhDid } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(screen.getByText(/Ownership verified via contract ownership/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(mockCreateSubject).toHaveBeenCalledWith({ did: pkhDid });
    });
    expect(onSubjectCreated).toHaveBeenCalledWith({ id: 's2', canonicalDid: pkhDid });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('toggles did.json instructions on did:web', () => {
    setup();
    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: 'did:web:example.com' } });
    expect(screen.getByText(/_controllers\.example\.com/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'did.json' }));

    expect(screen.getByText(/\.well-known\/did\.json/i)).toBeInTheDocument();
    expect(screen.queryByText(/_controllers\.example\.com/i)).not.toBeInTheDocument();
  });

  it('prefills initialSubjectDid and initialMessage', () => {
    setup({
      initialSubjectDid: 'did:web:prefilled.example.com',
      initialMessage: 'Please verify ownership first.',
    });
    expect(screen.getByTestId('did-web-input')).toHaveValue('did:web:prefilled.example.com');
    expect(screen.getByText('Please verify ownership first.')).toBeInTheDocument();
  });

  it('shows BackendApiError details for non-500 verify failures', async () => {
    mockVerifySubjectOwnership.mockRejectedValue(
      new BackendApiError('Bad request', 400, 'INVALID_DID', 'Malformed service ID')
    );
    setup();
    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: 'did:web:example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(screen.getByText('Malformed service ID')).toBeInTheDocument();
    });
  });

  it('shows a generic message for non-BackendApiError verify failures', async () => {
    mockVerifySubjectOwnership.mockRejectedValue(new Error('Network timeout'));
    setup();
    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: 'did:web:example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(screen.getByText('Network timeout')).toBeInTheDocument();
    });
  });

  it('resets the form when the dialog closes and reopens', () => {
    const { rerender } = setup();
    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: 'did:web:stale.example.com' } });

    rerender(
      <SubjectConfirmationDialog
        open={false}
        onOpenChange={vi.fn()}
        walletDid={WALLET_DID}
        existingSubjectDids={[]}
        onSubjectCreated={vi.fn()}
      />
    );

    rerender(
      <SubjectConfirmationDialog
        open
        onOpenChange={vi.fn()}
        walletDid={WALLET_DID}
        existingSubjectDids={[]}
        onSubjectCreated={vi.fn()}
      />
    );

    expect(screen.getByTestId('did-web-input')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
  });

  it('surfaces plain Error messages from createSubject on submit', async () => {
    mockVerifySubjectOwnership.mockResolvedValue({ ok: true, method: 'dns' });
    mockCreateSubject.mockRejectedValue(new Error('Database unavailable'));
    setup();

    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: 'did:web:example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByText('Database unavailable')).toBeInTheDocument();
    });
  });

  it.each([
    ['minting-wallet', /Ownership verified via minting wallet/i],
    ['transfer', /Ownership verified via transfer proof/i],
    [null, /Ownership verified via verification/i],
  ] as const)('shows the %s verification label', async (method, matcher) => {
    mockVerifySubjectOwnership.mockResolvedValue({ ok: true, method });
    setup();

    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: 'did:web:example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(screen.getByText(matcher)).toBeInTheDocument();
    });
  });

  it('shows did.json ownership label when verification method is did-document', async () => {
    mockVerifySubjectOwnership.mockResolvedValue({ ok: true, method: 'did-document' });
    setup();

    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: 'did:web:example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(screen.getByText(/Ownership verified via did\.json/i)).toBeInTheDocument();
    });
  });

  it('shows a generic ownership message when verify returns ok:false without error or details', async () => {
    mockVerifySubjectOwnership.mockResolvedValue({ ok: false });
    setup();

    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: 'did:web:example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(
        screen.getByText(/Ownership verification did not succeed yet/i)
      ).toBeInTheDocument();
    });
  });

  it('prefills did:pkh initialSubjectDid into the pkh input', () => {
    setup({
      initialSubjectDid: 'did:pkh:eip155:1:0x9999999999999999999999999999999999999999',
    });
    expect(screen.getByTestId('did-pkh-input')).toHaveValue(
      'did:pkh:eip155:1:0x9999999999999999999999999999999999999999'
    );
    expect(screen.getByTestId('did-method-select')).toHaveValue('did:pkh');
  });

  it('keeps default did:web method for unrecognized initialSubjectDid values', () => {
    setup({ initialSubjectDid: 'did:garbage:not-valid' });
    expect(screen.getByTestId('did-web-input')).toHaveValue('did:garbage:not-valid');
    expect(screen.getByTestId('did-method-select')).toHaveValue('did:web');
  });

  it('uses BackendApiError message when details are absent and generic errors for non-Error failures', async () => {
    mockVerifySubjectOwnership.mockRejectedValue(new BackendApiError('Verify rejected', 400, 'BAD_DID'));
    setup();
    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: 'did:web:example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(screen.getByText('Verify rejected')).toBeInTheDocument();
    });

    mockVerifySubjectOwnership.mockRejectedValue('verify exploded');
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to verify service ID ownership.')).toBeInTheDocument();
    });

    mockVerifySubjectOwnership.mockResolvedValue({ ok: true, method: 'dns' });
    mockCreateSubject.mockRejectedValue('create exploded');
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to add service ID.')).toBeInTheDocument();
    });
  });

  it('shows wallet placeholders when walletDid is null', () => {
    setup({ walletDid: null });
    expect(screen.getByText(/did:pkh:eip155:<chain-id>:0x\.\.\./i)).toBeInTheDocument();
    expect(screen.getByText(/_controllers\.example\.com/i)).toBeInTheDocument();
  });

  it('shows example.com domain placeholder when the subject domain is empty', () => {
    setup();
    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: '' } });
    expect(screen.getByText(/_controllers\.example\.com/i)).toBeInTheDocument();
  });

  it('shows Verifying… while ownership check is pending and toggles did.json then DNS TXT', async () => {
    mockVerifySubjectOwnership.mockImplementation(() => new Promise(() => {}));
    setup();

    fireEvent.change(screen.getByTestId('did-web-input'), { target: { value: 'did:web:example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('button', { name: 'Verifying…' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'did.json' }));
    expect(screen.getByText(/\.well-known\/did\.json/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'DNS TXT' }));
    expect(screen.getByText(/_controllers\.example\.com/i)).toBeInTheDocument();
  });
});
