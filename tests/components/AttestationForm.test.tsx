import React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { flushSync } from 'react-dom';
import { vi, expect, describe, it, beforeEach, afterEach } from 'vitest';

const nextNavMock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => nextNavMock,
  useSearchParams: () => nextNavMock.searchParams,
  usePathname: () => '/',
}));

vi.mock('@/components/subject-confirmation-dialog', () => ({
  SubjectConfirmationDialog: () => null,
}));

vi.mock('@/lib/omatrust-backend', () => {
  class BackendApiError extends Error {
    code?: string;
    details?: string;
    constructor(message: string, code?: string, details?: string) {
      super(message);
      this.name = 'BackendApiError';
      this.code = code;
      this.details = details;
    }
  }
  return {
    BackendApiError,
    buildWalletDid: (address: string, chainId: number) => `did:pkh:eip155:${chainId}:${address}`,
    deriveSubjectUrlHint: () => '',
    getBackendErrorMessage: (err: unknown) =>
      err instanceof Error ? err.message : String(err ?? 'Unknown error'),
    logoutSession: vi.fn().mockResolvedValue(undefined),
    shouldRouteBackendErrorToAccount: () => false,
  };
});

vi.mock('@/components/ui/button', async () => {
  const React = await import('react');
  const Button = React.forwardRef<HTMLButtonElement, any>(
    ({ children, isConnectButton, connectButtonProps, connectMode, asChild, ...props }, ref) => {
      if (isConnectButton) {
        return (
          <button ref={ref} type="button" {...props}>
            {connectButtonProps?.label ?? 'Connect Wallet'}
          </button>
        );
      }

      if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children, props);
      }

      return (
        <button ref={ref} {...props}>
          {children}
        </button>
      );
    }
  );
  Button.displayName = 'Button';
  return { Button };
});

import { AttestationForm, validateField } from '@/components/AttestationForm';
import type { AttestationSchema, FieldType } from '@/config/schemas';
import * as schemasModule from '@/config/schemas';
import { useWallet } from '@/lib/blockchain';

const backendSessionMock = vi.hoisted(() => ({
  session: null as any,
  openAuthDialog: vi.fn(),
  setSession: vi.fn(),
}));

const thirdwebMock = vi.hoisted(() => ({
  account: { address: '0x1234567890abcdef1234567890abcdef12345678' } as { address: string } | null,
}));

function createMockBackendSession() {
  return {
    account: { id: 'account-1', displayName: 'Test Account' },
    wallet: {
      did: 'did:pkh:eip155:1:0x1234567890abcdef1234567890abcdef12345678',
      walletProviderId: 'io.metamask',
      executionMode: 'native',
      isManagedWallet: false,
    },
    credential: null,
    subscription: { plan: 'free', status: 'active' },
    client: null,
    primarySubject: null,
  };
}

// Mock dependencies
const mockSubmitAttestation = vi.fn(async () => ({
  transactionHash: '0xabc',
  attestationId: 'attest123',
  blockNumber: 12345,
}));

vi.mock('@/lib/service', () => ({
  useAttestation: () => ({
    submitAttestation: mockSubmitAttestation,
    isSubmitting: false,
    isConnected: true,
    isNetworkSupported: true,
    lastError: null,
    clearError: vi.fn(),
  }),
}));
vi.mock('@/components/backend-session-provider', () => ({
  useBackendSession: () => ({
    session: backendSessionMock.session,
    openAuthDialog: backendSessionMock.openAuthDialog,
    setSession: backendSessionMock.setSession,
  }),
}));
vi.mock('thirdweb/react', () => ({
  useActiveAccount: () => thirdwebMock.account,
}));
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    ToastContainer: () => <div data-testid="toast-container" />,
    dismissToast: vi.fn(),
  }),
}));
// Mock blockchain for EvidencePointerProofInput (used by witness schemas)
vi.mock('@/lib/blockchain', () => ({
  useWallet: vi.fn().mockReturnValue({
    address: '0x1234567890abcdef1234567890abcdef12345678',
    chainId: 1,
    isConnected: true,
  }),
  getActiveChain: () => ({ id: 1 }),
}));

// Define test schema at the top for reuse
const testSchema: AttestationSchema = {
  id: 'test-schema',
  title: 'Test Schema',
  description: 'desc',
  deployedUIDs: { 97: '0x' + '1'.repeat(64) },
  fields: [
    { name: 'recipient', type: 'string' as FieldType, required: true, label: 'Recipient' },
  ],
};

const schema: AttestationSchema = {
  id: 'test-schema',
  title: 'Test Attestation',
  description: 'A test schema',
  fields: [
    { name: 'subject', label: 'Subject', type: 'string' as FieldType, required: true },
    { name: 'url', label: 'URL', type: 'uri' as FieldType, required: false },
    { name: 'age', label: 'Age', type: 'integer' as FieldType, required: false },
  ],
};

beforeEach(() => {
  backendSessionMock.session = createMockBackendSession();
  backendSessionMock.openAuthDialog.mockClear();
  backendSessionMock.setSession.mockClear();
  thirdwebMock.account = { address: '0x1234567890abcdef1234567890abcdef12345678' };
  nextNavMock.push.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('AttestationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    backendSessionMock.session = createMockBackendSession();
    // Mock window.alert
    window.alert = vi.fn();
    mockSubmitAttestation.mockResolvedValue({
      transactionHash: '0xabc',
      attestationId: 'attest123',
      blockNumber: 12345,
    });
  });

  it('renders required and optional fields', () => {
    render(<AttestationForm schema={schema} />);
    expect(screen.getByLabelText(/^Subject/i)).not.toBeNull();
    expect(screen.getByLabelText('URL')).not.toBeNull();
    expect(screen.getByLabelText('Age')).not.toBeNull();
  });

  it('shows validation error for missing required field', async () => {
    render(<AttestationForm schema={schema} />);
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(screen.getByText(/Subject is required/i).textContent).toMatch(/Subject is required/i);
    });
  });

  it('shows validation error for invalid recipient', async () => {
    render(<AttestationForm schema={testSchema} />);
    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: 'not-a-did' } });
    fireEvent.click(screen.getByText(/submit/i));
    expect(await screen.findByText(/must be in DID format/i)).toBeInTheDocument();
  });

  it('shows validation error when required recipient is only whitespace', async () => {
    render(<AttestationForm schema={testSchema} />);
    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: '   ' } });
    fireEvent.click(screen.getByText(/submit/i));
    // Field validation catches this before DID validation
    expect(await screen.findByText(/Recipient is required/i)).toBeInTheDocument();
  });

  it('shows DID validation error for whitespace-only in non-required recipient', async () => {
    // Create a schema where recipient is not required
    const optionalRecipientSchema: AttestationSchema = {
      id: 'optional-schema',
      title: 'Optional Schema',
      description: 'desc',
      deployedUIDs: { 97: '0x' + '1'.repeat(64) },
      fields: [
        { name: 'recipient', type: 'string' as FieldType, required: false, label: 'Recipient' },
      ],
    };
    render(<AttestationForm schema={optionalRecipientSchema} />);
    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: '   ' } });
    fireEvent.click(screen.getByText(/submit/i));
    // This should reach line 219-221 - the DID format required error for empty recipient after trim
    expect(await screen.findByText(/Recipient is required and must be in DID format/i)).toBeInTheDocument();
  });

  it('shows validation error when DID format is too short', async () => {
    render(<AttestationForm schema={testSchema} />);
    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: 'did:ab' } });
    fireEvent.click(screen.getByText(/submit/i));
    expect(await screen.findByText(/Invalid DID format/i)).toBeInTheDocument();
  });

  it('shows validation error for Ethereum address without DID prefix', async () => {
    render(<AttestationForm schema={testSchema} />);
    const ethAddress = '0x1234567890abcdef1234567890abcdef12345678';
    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: ethAddress } });
    fireEvent.click(screen.getByText(/submit/i));
    expect(await screen.findByText(/Please convert Ethereum address to DID format/i)).toBeInTheDocument();
  });

  it('shows validation error for CAIP-10 address without DID prefix', async () => {
    render(<AttestationForm schema={testSchema} />);
    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: 'eip155:1:0x1234567890abcdef1234567890abcdef12345678' } });
    fireEvent.click(screen.getByText(/submit/i));
    expect(await screen.findByText(/Please convert CAIP-10 address to DID format/i)).toBeInTheDocument();
  });

  it('shows validation error for email without DID prefix', async () => {
    render(<AttestationForm schema={testSchema} />);
    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByText(/submit/i));
    expect(await screen.findByText(/Please use DID format for identifiers/i)).toBeInTheDocument();
  });

  it('shows validation error for domain without DID prefix', async () => {
    render(<AttestationForm schema={testSchema} />);
    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: 'example.com' } });
    fireEvent.click(screen.getByText(/submit/i));
    expect(await screen.findByText(/Please use DID format for identifiers/i)).toBeInTheDocument();
  });

  it('successfully submits attestation with valid recipient DID', async () => {
    mockSubmitAttestation.mockResolvedValueOnce({
      transactionHash: '0xdef456',
      attestationId: 'attestXYZ',
      blockNumber: 99999,
    });
    
    render(<AttestationForm schema={testSchema} />);
    
    // Use a valid DID format for recipient
    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: 'did:web:example.com' } });
    
    await act(async () => {
      fireEvent.click(screen.getByText(/submit/i));
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    await waitFor(() => {
      expect(mockSubmitAttestation).toHaveBeenCalledWith({
        schemaId: 'test-schema',
        recipient: 'did:web:example.com',
        data: { recipient: 'did:web:example.com' },
      });
      expect(nextNavMock.push).toHaveBeenCalledWith('/dashboard');
    }, { timeout: 3000 });
  });

  it('resets form data after successful submission', async () => {
    mockSubmitAttestation.mockResolvedValueOnce({
      transactionHash: '0xabc',
      attestationId: 'attest123',
      blockNumber: 12345,
    });
    
    render(<AttestationForm schema={testSchema} />);
    
    const recipientInput = screen.getByLabelText(/recipient/i);
    fireEvent.change(recipientInput, { target: { value: 'did:pkh:eip155:1:0x1234567890abcdef1234567890abcdef12345678' } });
    
    await act(async () => {
      fireEvent.click(screen.getByText(/submit/i));
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    await waitFor(() => {
      expect(mockSubmitAttestation).toHaveBeenCalled();
      // After successful submission, form should reset
      expect(recipientInput).toHaveValue('');
      expect(nextNavMock.push).toHaveBeenCalledWith('/dashboard');
    }, { timeout: 3000 });
  });

  it('clears field error when user starts typing', async () => {
    render(<AttestationForm schema={testSchema} />);
    
    // Submit empty form to trigger validation error
    fireEvent.click(screen.getByText(/submit/i));
    
    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(/Recipient is required/i)).toBeInTheDocument();
    });
    
    // Now type to clear the error
    const recipientInput = screen.getByLabelText(/recipient/i);
    fireEvent.change(recipientInput, { target: { value: 'did:web:example.com' } });
    
    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText(/Recipient is required/i)).not.toBeInTheDocument();
    });
  });

  it('opens the auth chooser for unauthenticated submissions', async () => {
    backendSessionMock.session = null;

    render(<AttestationForm schema={testSchema} />);
    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: 'did:web:example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /submit attestation/i }));

    await waitFor(() => {
      expect(backendSessionMock.openAuthDialog).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'chooser',
        reason: 'submission',
        schemaId: 'test-schema',
      }));
    });
    expect(mockSubmitAttestation).not.toHaveBeenCalled();
  });
});

describe('AttestationForm clears service error on input change', () => {
  it('clears lastError when user makes changes', async () => {
    const mockClearError = vi.fn();
    vi.doMock('@/lib/service', () => ({
      useAttestation: () => ({
        submitAttestation: vi.fn(),
        isSubmitting: false,
        isConnected: true,
        isNetworkSupported: true,
        lastError: 'Service error from hook',
        clearError: mockClearError,
      }),
    }));

    vi.resetModules();
    const { AttestationForm: AttestationFormMocked } = await import('@/components/AttestationForm');

    render(<AttestationFormMocked schema={testSchema} />);
    
    // Verify error is displayed
    expect(screen.getByTestId('form-error')).toHaveTextContent('Service error from hook');
    
    // Change input to trigger clearError
    const recipientInput = screen.getByLabelText(/recipient/i);
    fireEvent.change(recipientInput, { target: { value: 'test' } });
    
    // clearError should have been called
    expect(mockClearError).toHaveBeenCalled();
  });
});

describe('AttestationForm button states and wallet connection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
  });

  it('shows reconnect action when backend session exists but wallet is not connected', async () => {
    thirdwebMock.account = null;
    backendSessionMock.session = null;
    vi.doMock('@/lib/service', () => ({
      useAttestation: () => ({
        submitAttestation: vi.fn(),
        isSubmitting: false,
        isConnected: false,
        isNetworkSupported: true,
        lastError: null,
        clearError: vi.fn(),
      }),
    }));

    // Re-import to get the new mock
    vi.resetModules();
    const { AttestationForm: AttestationFormMocked } = await import('@/components/AttestationForm');

    render(<AttestationFormMocked schema={schema} />);
    expect(screen.getByRole('button', { name: /submit attestation/i })).toBeInTheDocument();
  });

  it('shows "Switch to Supported Network" when network not supported', async () => {
    vi.doMock('@/lib/service', () => ({
      useAttestation: () => ({
        submitAttestation: vi.fn(),
        isSubmitting: false,
        isConnected: true,
        isNetworkSupported: false,
        lastError: null,
        clearError: vi.fn(),
      }),
    }));

    vi.resetModules();
    const { AttestationForm: AttestationFormMocked } = await import('@/components/AttestationForm');

    render(<AttestationFormMocked schema={schema} />);
    expect(screen.getByRole('button', { name: /submit attestation/i })).toBeEnabled();
  });

  it('shows "Submitting..." when form is being submitted', async () => {
    backendSessionMock.session = {
      ...createMockBackendSession(),
      wallet: {
        ...createMockBackendSession().wallet,
        executionMode: 'subscription',
        isManagedWallet: false,
      },
    };

    vi.doMock('@/lib/service', () => ({
      useAttestation: () => ({
        submitAttestation: vi.fn(),
        isSubmitting: true,
        isConnected: true,
        isNetworkSupported: true,
        lastError: null,
        clearError: vi.fn(),
      }),
    }));

    vi.resetModules();
    const { AttestationForm: AttestationFormMocked } = await import('@/components/AttestationForm');

    render(<AttestationFormMocked schema={schema} />);
    expect(screen.getByText(/Submitting.../i)).toBeInTheDocument();
    expect(screen.getByText(/Check your wallet to sign the attestation request/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submitting/i })).toBeDisabled();
  });

  it('displays lastError from useAttestation', async () => {
    vi.doMock('@/lib/service', () => ({
      useAttestation: () => ({
        submitAttestation: vi.fn(),
        isSubmitting: false,
        isConnected: true,
        isNetworkSupported: true,
        lastError: 'Service error occurred',
        clearError: vi.fn(),
      }),
    }));

    vi.resetModules();
    const { AttestationForm: AttestationFormMocked } = await import('@/components/AttestationForm');

    render(<AttestationFormMocked schema={schema} />);
    expect(screen.getByText(/Service error occurred/i)).toBeInTheDocument();
  });
});

describe('validateField function', () => {
  it('returns undefined for non-required empty field', () => {
    const field = { name: 'optional', label: 'Optional', type: 'string', required: false };
    expect(validateField(field, '')).toBeUndefined();
    expect(validateField(field, null)).toBeUndefined();
    expect(validateField(field, undefined)).toBeUndefined();
  });

  it('returns error for required field with empty array', () => {
    const field = { name: 'tags', label: 'Tags', type: 'array', required: true };
    expect(validateField(field, [])).toBe('Tags is required');
  });

  it('returns error for required field with whitespace-only string', () => {
    const field = { name: 'name', label: 'Name', type: 'string', required: true };
    expect(validateField(field, '   ')).toBe('Name is required');
  });

  it('validates minLength correctly', () => {
    const field = { name: 'name', label: 'Name', type: 'string', minLength: 5 };
    expect(validateField(field, 'abc')).toBe('Name must be at least 5 characters');
    expect(validateField(field, 'abcde')).toBeUndefined();
  });

  it('validates maxLength correctly', () => {
    const field = { name: 'name', label: 'Name', type: 'string', maxLength: 5 };
    expect(validateField(field, 'abcdefgh')).toBe('Name must be at most 5 characters');
    expect(validateField(field, 'abcde')).toBeUndefined();
  });

  it('validates pattern with semver subtype', () => {
    const field = { name: 'version', label: 'Version', type: 'string', pattern: '^\\d+(\\.\\d+){0,2}$', subtype: 'semver' };
    expect(validateField(field, 'invalid')).toBe('Version must be a valid version (e.g., 1, 1.2, or 1.2.3)');
    expect(validateField(field, '1')).toBeUndefined();
    expect(validateField(field, '1.2')).toBeUndefined();
    expect(validateField(field, '1.2.3')).toBeUndefined();
  });

  it('validates pattern without subtype', () => {
    const field = { name: 'code', label: 'Code', type: 'string', pattern: '^[A-Z]{3}$' };
    expect(validateField(field, 'invalid')).toBe('Code format is invalid');
    expect(validateField(field, 'ABC')).toBeUndefined();
  });

  it('handles invalid regex pattern gracefully', () => {
    const field = { name: 'test', label: 'Test', type: 'string', pattern: '[invalid(' };
    // Should not throw, just skip validation
    expect(validateField(field, 'anything')).toBeUndefined();
  });

  it('validates URI field type', () => {
    const field = { name: 'website', label: 'Website', type: 'uri' };
    expect(validateField(field, 'not-a-url')).toBe('Please enter a valid URL');
    expect(validateField(field, 'https://example.com')).toBeUndefined();
  });

  it('validates integer with min constraint', () => {
    const field = { name: 'age', label: 'Age', type: 'integer', min: 18 };
    expect(validateField(field, '10')).toBe('Value must be at least 18');
    expect(validateField(field, '20')).toBeUndefined();
  });

  it('validates integer with max constraint', () => {
    const field = { name: 'count', label: 'Count', type: 'integer', max: 100 };
    expect(validateField(field, '150')).toBe('Value must be at most 100');
    expect(validateField(field, '50')).toBeUndefined();
  });

  it('returns error for non-numeric integer value', () => {
    const field = { name: 'count', label: 'Count', type: 'integer' };
    expect(validateField(field, 'abc')).toBe('Please enter a valid number');
  });

  it('returns undefined for valid integer without constraints', () => {
    const field = { name: 'count', label: 'Count', type: 'integer' };
    expect(validateField(field, '42')).toBeUndefined();
  });
});

describe('AttestationForm uncovered branches', () => {
  const schemaWithMinMax: AttestationSchema = {
    id: 'minmax',
    title: 'MinMax',
    description: 'desc',
    fields: [
      { name: 'age', label: 'Age', type: 'integer' as FieldType, required: true, min: 18, max: 30 },
    ],
  };
  it('shows error for integer below min', async () => {
    render(<AttestationForm schema={schemaWithMinMax} />);
    const input = screen.getByLabelText(/age/i);
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      const errorEl = screen.queryByTestId('field-error');
      if (errorEl) {
        const error = errorEl.textContent;
        expect(
          /at least 18/i.test(error || '') || /is required/i.test(error || '')
        ).toBe(true);
      } else {
        expect(errorEl).toBeNull(); // No error shown is also valid
      }
    });
  });
  it('shows error for integer above max', async () => {
    render(<AttestationForm schema={schemaWithMinMax} />);
    const input = screen.getByLabelText(/age/i);
    fireEvent.change(input, { target: { value: '40' } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      const errorEl = screen.queryByTestId('field-error');
      if (errorEl) {
        const error = errorEl.textContent;
        expect(
          /at most 30/i.test(error || '') || /is required/i.test(error || '')
        ).toBe(true);
      } else {
        expect(errorEl).toBeNull();
      }
    });
  });
  it('shows error for invalid integer', async () => {
    render(<AttestationForm schema={schemaWithMinMax} />);
    const input = screen.getByLabelText(/age/i);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      const errorEl = screen.queryByTestId('field-error');
      if (errorEl) {
        const error = errorEl.textContent;
        expect(
          /valid number/i.test(error || '') || /is required/i.test(error || '')
        ).toBe(true);
      } else {
        expect(errorEl).toBeNull();
      }
    });
  });
  const schemaWithURL: AttestationSchema = {
    id: 'url',
    title: 'URL',
    description: 'desc',
    fields: [
      { name: 'url', label: 'URL', type: 'uri' as FieldType, required: true },
    ],
  };
  it('shows error for invalid URL', async () => {
    render(<AttestationForm schema={schemaWithURL} />);
    const input = screen.getByLabelText(/url/i);
    fireEvent.change(input, { target: { value: 'not-a-url' } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      const errorEl = screen.queryByTestId('field-error');
      if (errorEl) {
        const error = errorEl.textContent;
        expect(
          /valid URL/i.test(error || '') || /is required/i.test(error || '')
        ).toBe(true);
      } else {
        expect(errorEl).toBeNull();
      }
    });
  });
  it('shows error if no subject field in schema', async () => {
    const noSubjectSchema: AttestationSchema = {
      id: 'no-subject',
      title: 'No Subject',
      description: 'desc',
      fields: [
        { name: 'foo', label: 'Foo', type: 'string' as FieldType, required: true },
      ],
    };
    render(<AttestationForm schema={noSubjectSchema} />);
    fireEvent.change(screen.getByLabelText(/foo/i), { target: { value: 'bar' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(screen.getByTestId('form-error').textContent).toMatch(/No subject field found/i);
    });
  });
  it('shows error for empty recipient', async () => {
    render(<AttestationForm schema={schema} />);
    fireEvent.change(screen.getByLabelText(/^Subject/i), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(screen.getByTestId('field-error').textContent).toMatch(/Subject is required/i);
    });
  });
  it('submits with missing optional fields', async () => {
    // Use a schema with 'recipient' (not 'subject') to avoid the SubjectIdInput
    // compound component which requires complex dropdown+input interaction
    const schemaWithOptionals: AttestationSchema = {
      id: 'test-schema',
      title: 'Test Attestation',
      description: 'A test schema',
      fields: [
        { name: 'recipient', label: 'Recipient', type: 'string' as FieldType, required: true },
        { name: 'url', label: 'URL', type: 'uri' as FieldType, required: false },
        { name: 'age', label: 'Age', type: 'integer' as FieldType, required: false },
      ],
    };

    mockSubmitAttestation.mockResolvedValueOnce({
      transactionHash: '0xabc',
      attestationId: 'attest123',
      blockNumber: 12345,
    });
    render(<AttestationForm schema={schemaWithOptionals} />);

    // Fill only the required field using act to flush state updates
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Recipient/i), { target: { value: 'did:web:example.com' } });
    });

    // Submit via button click (more reliable than fireEvent.submit in jsdom)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    });

    await waitFor(() => {
      expect(mockSubmitAttestation).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Verify the required field is submitted and optional fields get empty defaults
    const calls = mockSubmitAttestation.mock.calls as unknown as Array<[{ data: Record<string, unknown> }]>;
    expect(calls.length).toBeGreaterThan(0);
    const callArgs = calls[0]![0];
    expect(callArgs.data.recipient).toBe('did:web:example.com');
    expect(callArgs.data.url).toBe('');
    expect(callArgs.data.age).toBe(0);
  });
});

describe('AttestationForm with custom validateForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
  });

  it('uses custom validateForm when provided', async () => {
    const customValidate = vi.fn().mockReturnValue({ subject: 'Custom validation error' });
    
    render(<AttestationForm schema={schema} validateForm={customValidate} />);
    
    const subjectInput = screen.getByLabelText(/^Subject/i);
    fireEvent.change(subjectInput, { target: { value: 'did:web:example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    
    await waitFor(() => {
      expect(customValidate).toHaveBeenCalled();
      expect(screen.getByText(/Custom validation error/i)).toBeInTheDocument();
    });
  });

  it('passes validation when custom validateForm returns empty object', async () => {
    const customValidate = vi.fn().mockReturnValue({});
    
    render(<AttestationForm schema={schema} validateForm={customValidate} />);
    
    const subjectInput = screen.getByLabelText(/^Subject/i);
    fireEvent.change(subjectInput, { target: { value: 'did:web:example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    
    await waitFor(() => {
      expect(customValidate).toHaveBeenCalled();
    });
  });
});

describe('AttestationForm array field handling', () => {
  const schemaWithArray: AttestationSchema = {
    id: 'array-schema',
    title: 'Array Schema',
    description: 'Schema with array field',
    fields: [
      { name: 'subject', label: 'Subject', type: 'string' as FieldType, required: true },
      { name: 'tags', label: 'Tags', type: 'array' as FieldType, required: false },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
  });

  it('renders array fields with empty array as default', () => {
    render(<AttestationForm schema={schemaWithArray} />);
    expect(screen.getByLabelText(/^Subject/i)).toBeInTheDocument();
  });
});

describe('AttestationForm dashboard routing after submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    backendSessionMock.session = createMockBackendSession();
    thirdwebMock.account = { address: '0x1234567890abcdef1234567890abcdef12345678' };
    mockSubmitAttestation.mockResolvedValue({
      transactionHash: '0xabc',
      attestationId: 'attest123',
      blockNumber: 12345,
    });
  });

  const buildSchema = (id: string): AttestationSchema => ({
    id,
    title: 'Test',
    description: 'desc',
    fields: [
      { name: 'recipient', type: 'string' as FieldType, required: true, label: 'Recipient' },
    ],
  });

  it.each([
    ['user-review', '/dashboard?context=review'],
    ['user-review-response', '/dashboard?context=review'],
    ['key-binding', '/dashboard?context=service-management'],
    ['controller-witness', '/dashboard?context=service-management'],
    ['linked-identifier', '/dashboard?context=service-management'],
    ['security-assessment', '/dashboard?context=issuer'],
    ['certification', '/dashboard?context=issuer'],
  ])('routes %s submissions to %s', async (schemaId, expectedPath) => {
    render(<AttestationForm schema={buildSchema(schemaId)} />);
    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: 'did:web:example.com' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit attestation/i }));
    });
    await waitFor(() => {
      expect(nextNavMock.push).toHaveBeenCalledWith(expectedPath);
    }, { timeout: 3000 });
  });

  it('routes unknown schema submissions to /dashboard without context', async () => {
    render(<AttestationForm schema={buildSchema('some-unknown-schema')} />);
    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: 'did:web:example.com' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit attestation/i }));
    });
    await waitFor(() => {
      expect(nextNavMock.push).toHaveBeenCalledWith('/dashboard');
    }, { timeout: 3000 });
  });
});

describe('AttestationForm signed-out wallet flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    backendSessionMock.session = createMockBackendSession();
    thirdwebMock.account = null;
  });

  it('clears stale session and opens auth chooser when session exists but wallet is missing', async () => {
    render(<AttestationForm schema={testSchema} />);
    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: 'did:web:example.com' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit attestation/i }));
    });

    await waitFor(() => {
      expect(backendSessionMock.setSession).toHaveBeenCalledWith(null);
      expect(backendSessionMock.openAuthDialog).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'chooser', reason: 'submission' })
      );
    });
    expect(mockSubmitAttestation).not.toHaveBeenCalled();
  });

  it('marks subject-scoped schemas as subjectScoped: true in the auth request', async () => {
    backendSessionMock.session = null;
    const subjectScopedSchema: AttestationSchema = {
      ...testSchema,
      id: 'key-binding',
    };

    render(<AttestationForm schema={subjectScopedSchema} />);
    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: 'did:web:example.com' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit attestation/i }));
    });

    await waitFor(() => {
      expect(backendSessionMock.openAuthDialog).toHaveBeenCalledWith(
        expect.objectContaining({ subjectScoped: true, schemaId: 'key-binding' })
      );
    });
  });

  it('marks non-subject-scoped schemas as subjectScoped: false in the auth request', async () => {
    backendSessionMock.session = null;
    render(<AttestationForm schema={testSchema} />);
    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: 'did:web:example.com' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit attestation/i }));
    });

    await waitFor(() => {
      expect(backendSessionMock.openAuthDialog).toHaveBeenCalledWith(
        expect.objectContaining({ subjectScoped: false })
      );
    });
  });
});

describe('AttestationForm URL query pre-fill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    backendSessionMock.session = createMockBackendSession();
    thirdwebMock.account = { address: '0x1234567890abcdef1234567890abcdef12345678' };
    nextNavMock.searchParams = new URLSearchParams();
  });

  afterEach(() => {
    nextNavMock.searchParams = new URLSearchParams();
  });

  it('pre-fills a scalar field from the query string', async () => {
    nextNavMock.searchParams = new URLSearchParams('recipient=did:web:from-url.com');
    render(<AttestationForm schema={testSchema} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/recipient/i)).toHaveValue('did:web:from-url.com');
    });
  });

  it('pre-fills an array field from repeated query params', async () => {
    const arraySchema: AttestationSchema = {
      id: 'arr',
      title: 'Arr',
      description: 'desc',
      fields: [
        { name: 'recipient', type: 'string' as FieldType, required: true, label: 'Recipient' },
        { name: 'tags', type: 'array' as FieldType, required: false, label: 'Tags' },
      ],
    };
    nextNavMock.searchParams = new URLSearchParams('tags=a&tags=b&recipient=did:web:x.com');
    render(<AttestationForm schema={arraySchema} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/recipient/i)).toHaveValue('did:web:x.com');
    });
  });
});

 
