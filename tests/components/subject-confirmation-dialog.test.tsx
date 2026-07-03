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

vi.mock('@/components/caip10-input', () => ({
  Caip10Input: ({ value, onChange }: { value: string; onChange: (v: string | null) => void }) => (
    <input data-testid="caip10-input" value={value} onChange={(e) => onChange(e.target.value || null)} />
  ),
}));

import { SubjectConfirmationDialog } from '@/components/subject-confirmation-dialog';
import { BackendApiError } from '@/lib/omatrust-backend';

const WALLET_DID = 'did:pkh:eip155:1:0xabc';

function setup(overrides: Partial<React.ComponentProps<typeof SubjectConfirmationDialog>> = {}) {
  const onOpenChange = vi.fn();
  const onSubjectCreated = vi.fn();
  render(
    <SubjectConfirmationDialog
      open
      onOpenChange={onOpenChange}
      walletDid={WALLET_DID}
      existingSubjectDids={[]}
      onSubjectCreated={onSubjectCreated}
      {...overrides}
    />
  );
  return { onOpenChange, onSubjectCreated };
}

describe('SubjectConfirmationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dialog title and a disabled Verify button initially', () => {
    setup();
    expect(screen.getByText('Verify Subject Ownership')).toBeInTheDocument();
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
});
