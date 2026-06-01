import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const routerPush = vi.fn();
const openAuthDialog = vi.fn();
const mockUseBackendSession = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock('@/components/backend-session-provider', () => ({
  useBackendSession: () => mockUseBackendSession(),
}));

import { WorkflowCards } from '@/components/home/WorkflowCards';
import { WorkflowCard } from '@/components/home/WorkflowCard';

describe('WorkflowCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBackendSession.mockReturnValue({ session: null, openAuthDialog });
  });

  it('renders all four workflow cards', () => {
    render(<WorkflowCards />);
    expect(screen.getByText('Review an app or service')).toBeInTheDocument();
    expect(screen.getByText('Manage your trust')).toBeInTheDocument();
    expect(screen.getByText('Auditors & certifiers')).toBeInTheDocument();
    expect(screen.getByText('Build with OMATrust')).toBeInTheDocument();
  });

  it('renders an external link for external workflows', () => {
    render(
      <WorkflowCard
        workflow={{
          id: 'developer',
          title: 'Build with OMATrust',
          description: 'docs',
          ctaLabel: 'View API Docs',
          href: 'https://docs.omatrust.org',
          external: true,
        }}
      />
    );
    const link = screen.getByRole('link', { name: /View API Docs/i });
    expect(link).toHaveAttribute('href', 'https://docs.omatrust.org');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('navigates directly for non-auth workflows', () => {
    render(
      <WorkflowCard
        workflow={{
          id: 'review',
          title: 'Review an app or service',
          description: 'desc',
          ctaLabel: 'Start review',
          href: '/publish/user-review',
        }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Start review/i }));
    expect(routerPush).toHaveBeenCalledWith('/publish/user-review');
    expect(openAuthDialog).not.toHaveBeenCalled();
  });

  it('opens the auth dialog for auth-required workflows when signed out', () => {
    mockUseBackendSession.mockReturnValue({ session: null, openAuthDialog });
    render(
      <WorkflowCard
        workflow={{
          id: 'service',
          title: 'Manage your trust',
          description: 'desc',
          ctaLabel: 'Open service workspace',
          href: '/dashboard?context=service-management',
          requiresAuth: true,
        }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Open service workspace/i }));
    expect(openAuthDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'chooser',
        reason: 'navigation',
        redirectTo: '/dashboard?context=service-management',
      })
    );
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('navigates directly for auth-required workflows when signed in', () => {
    mockUseBackendSession.mockReturnValue({ session: { account: { id: 'a1' } }, openAuthDialog });
    render(
      <WorkflowCard
        workflow={{
          id: 'service',
          title: 'Manage your trust',
          description: 'desc',
          ctaLabel: 'Open service workspace',
          href: '/dashboard?context=service-management',
          requiresAuth: true,
        }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Open service workspace/i }));
    expect(routerPush).toHaveBeenCalledWith('/dashboard?context=service-management');
    expect(openAuthDialog).not.toHaveBeenCalled();
  });
});
