import React from 'react';
import { render, screen } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';

describe('Dashboard Page', () => {
  it('renders without crashing', () => {
    render(<DashboardPage />);
  });

  it('renders Dashboard heading', () => {
    render(<DashboardPage />);
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('renders Create Attestation link/button', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/create attestation/i)).toBeInTheDocument();
  });

  it('renders stats section with Total Attestations', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/total attestations/i)).toBeInTheDocument();
  });

  it('renders Recent Attestations section', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/recent attestations/i)).toBeInTheDocument();
  });
});
