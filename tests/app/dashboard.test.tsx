import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Page from '@/app/dashboard/page';

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Shield: () => <div data-testid="shield-icon">Shield</div>,
  FileCheck: () => <div data-testid="file-check-icon">FileCheck</div>,
  LinkIcon: () => <div data-testid="link-icon">LinkIcon</div>,
  Star: () => <div data-testid="star-icon">Star</div>,
  Plus: () => <div data-testid="plus-icon">Plus</div>,
}));

describe('Dashboard Page', () => {
  it('renders without crashing', () => {
    render(<Page />);
  });

  it('renders dashboard with title and description', () => {
    render(<Page />);
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Manage your attestations and view your activity')).toBeInTheDocument();
  });

  it('renders create attestation button', () => {
    render(<Page />);
    
    const createButton = screen.getByText('Create Attestation');
    expect(createButton).toBeInTheDocument();
    expect(createButton.closest('a')).toHaveAttribute('href', '/attest');
  });

  it('renders stats grid with correct values', () => {
    render(<Page />);
    
    expect(screen.getByText('Total Attestations')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('+3 this month')).toBeInTheDocument();
    
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('+2 this month')).toBeInTheDocument();
    
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('+1 this week')).toBeInTheDocument();
    
    expect(screen.getByText('Reputation Score')).toBeInTheDocument();
    expect(screen.getByText('847')).toBeInTheDocument();
    expect(screen.getByText('+15 this month')).toBeInTheDocument();
  });

  it('renders recent attestations section', () => {
    render(<Page />);
    
    expect(screen.getByText('Recent Attestations')).toBeInTheDocument();
    expect(screen.getByText('Your latest attestation submissions')).toBeInTheDocument();
    
    // Check for attestation items
    expect(screen.getByText('DeFi Protocol v2.1')).toBeInTheDocument();
    expect(screen.getByText('Gaming App')).toBeInTheDocument();
    expect(screen.getByText('NFT Marketplace')).toBeInTheDocument();
    
    // Check for status badges
    expect(screen.getAllByText('confirmed')).toHaveLength(2);
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('renders quick actions section', () => {
    render(<Page />);
    
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('Common attestation types')).toBeInTheDocument();
    
    // Check for quick action buttons
    expect(screen.getByText('Certification')).toBeInTheDocument();
    expect(screen.getByText('User Review')).toBeInTheDocument();
    expect(screen.getByText('Endorsement')).toBeInTheDocument();
    expect(screen.getByText('Linked Identifier')).toBeInTheDocument();
    
    // Check that buttons are links
    expect(screen.getByText('Certification').closest('a')).toHaveAttribute('href', '/attest/certification');
    expect(screen.getByText('User Review').closest('a')).toHaveAttribute('href', '/attest/user-review');
    expect(screen.getByText('Endorsement').closest('a')).toHaveAttribute('href', '/attest/endorsement');
    expect(screen.getByText('Linked Identifier').closest('a')).toHaveAttribute('href', '/attest/linked-identifier');
  });

  it('renders activity summary section', () => {
    render(<Page />);
    
    expect(screen.getByText('Activity Summary')).toBeInTheDocument();
    
    expect(screen.getByText('This Week')).toBeInTheDocument();
    expect(screen.getByText('3 attestations')).toBeInTheDocument();
    
    expect(screen.getByText('This Month')).toBeInTheDocument();
    expect(screen.getByText('8 attestations')).toBeInTheDocument();
    
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('12 attestations')).toBeInTheDocument();
  });
}); 