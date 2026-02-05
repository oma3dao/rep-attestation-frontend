import React from 'react';
import { vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { ThirdwebProvider } from 'thirdweb/react';

// Mock the client module to always provide a client ID
vi.mock('@/app/client', () => ({
  __esModule: true,
  default: 'test-client-id',
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}));

vi.mock('@/components/AttestationForm', () => ({
  AttestationForm: ({ schema }: { schema: any }) =>
    schema ? <div data-testid="attestation-form">Form</div> : null,
}));

import * as schemas from '@/config/schemas';
import { render, screen } from '@testing-library/react';
import AttestationPage from '@/app/attest/[type]/page';
import { notFound } from 'next/navigation';

describe('Attest [type] Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', async () => {
    await act(async () => {
      render(
        <ThirdwebProvider>
          <AttestationPage params={Promise.resolve({ type: 'certification' })} />
        </ThirdwebProvider>
      );
    });
  });

  it('shows Loading then form when schema exists', async () => {
    vi.spyOn(schemas, 'getSchema').mockReturnValue({
      id: 'certification',
      title: 'Certification',
      description: '',
      fields: [],
      deployedUIDs: {},
    } as any);
    await act(async () => {
      render(
        <ThirdwebProvider>
          <AttestationPage params={Promise.resolve({ type: 'certification' })} />
        </ThirdwebProvider>
      );
    });
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('attestation-form')).toBeInTheDocument();
    expect(screen.getByText('Form')).toBeInTheDocument();
  });

  it('calls notFound when getSchema returns null', async () => {
    vi.spyOn(schemas, 'getSchema').mockReturnValue(null as any);
    await act(async () => {
      render(
        <ThirdwebProvider>
          <AttestationPage params={Promise.resolve({ type: 'nonexistent-type' })} />
        </ThirdwebProvider>
      );
    });
    await waitFor(() => {
      expect(notFound).toHaveBeenCalled();
    });
  });

  it('calls notFound when params rejects', async () => {
    await act(async () => {
      render(
        <ThirdwebProvider>
          <AttestationPage params={Promise.reject(new Error('fail'))} />
        </ThirdwebProvider>
      );
    });
    await waitFor(() => {
      expect(notFound).toHaveBeenCalled();
    });
  });
});

