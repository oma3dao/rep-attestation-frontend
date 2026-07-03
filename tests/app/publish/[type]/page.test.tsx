import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}));

vi.mock('@/components/AttestationForm', () => ({
  AttestationForm: ({ schema }: { schema: any }) =>
    schema ? <div data-testid="attestation-form">{schema.title}</div> : null,
}));

import * as schemas from '@/config/schemas';
import PublishSchemaPage from '@/app/publish/[type]/page';
import { notFound } from 'next/navigation';

describe('Publish [type] Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading state before the schema resolves', async () => {
    vi.spyOn(schemas, 'getSchema').mockReturnValue({
      id: 'certification',
      title: 'Certification',
      description: '',
      fields: [],
    } as any);

    let container: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <PublishSchemaPage params={new Promise(() => {})} />
      ));
    });
    expect(container!.textContent).toContain('Loading...');
  });

  it('renders the AttestationForm when the schema exists', async () => {
    vi.spyOn(schemas, 'getSchema').mockReturnValue({
      id: 'certification',
      title: 'Certification',
      description: '',
      fields: [],
    } as any);

    await act(async () => {
      render(<PublishSchemaPage params={Promise.resolve({ type: 'certification' })} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('attestation-form')).toBeInTheDocument();
    });
    expect(screen.getByText('Certification')).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it('passes the resolved type to getSchema', async () => {
    const getSchemaSpy = vi.spyOn(schemas, 'getSchema').mockReturnValue({
      id: 'user-review',
      title: 'User Review',
      description: '',
      fields: [],
    } as any);

    await act(async () => {
      render(<PublishSchemaPage params={Promise.resolve({ type: 'user-review' })} />);
    });

    await waitFor(() => {
      expect(getSchemaSpy).toHaveBeenCalledWith('user-review');
    });
  });

  it('calls notFound when getSchema returns null', async () => {
    vi.spyOn(schemas, 'getSchema').mockReturnValue(null as any);

    await act(async () => {
      render(<PublishSchemaPage params={Promise.resolve({ type: 'does-not-exist' })} />);
    });

    await waitFor(() => {
      expect(notFound).toHaveBeenCalled();
    });
  });

  it('calls notFound when params rejects', async () => {
    await act(async () => {
      render(<PublishSchemaPage params={Promise.reject(new Error('boom'))} />);
    });

    await waitFor(() => {
      expect(notFound).toHaveBeenCalled();
    });
  });
});
