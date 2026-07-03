import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PreAlphaBanner } from '@/components/pre-alpha-banner';

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
});

describe('PreAlphaBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset sessionStorage mock
    mockSessionStorage.getItem.mockReturnValue(null);
    mockSessionStorage.setItem.mockImplementation(() => {});
    // Set mainnet so banner renders
    vi.stubEnv('NEXT_PUBLIC_ACTIVE_CHAIN', 'omachain-mainnet');
  });

  it('renders banner on mainnet', () => {
    render(<PreAlphaBanner />);
    
    expect(screen.getByText(/Public Beta/i)).toBeInTheDocument();
    expect(screen.getByText(/Running on mainnet/i)).toBeInTheDocument();
  });

  it('does not render on testnet', () => {
    vi.stubEnv('NEXT_PUBLIC_ACTIVE_CHAIN', 'omachain-testnet');
    render(<PreAlphaBanner />);
    
    expect(screen.queryByText(/Public Beta/i)).not.toBeInTheDocument();
  });

  it('shows dismiss button with correct aria-label', () => {
    render(<PreAlphaBanner />);
    
    const dismissButton = screen.getByRole('button', { name: /dismiss banner/i });
    expect(dismissButton).toBeInTheDocument();
  });

  it('dismisses banner when close button is clicked', () => {
    render(<PreAlphaBanner />);
    
    const dismissButton = screen.getByRole('button', { name: /dismiss banner/i });
    fireEvent.click(dismissButton);
    
    expect(screen.queryByText(/Public Beta/i)).not.toBeInTheDocument();
  });

  it('saves dismissal state to sessionStorage when dismissed', () => {
    render(<PreAlphaBanner />);
    
    const dismissButton = screen.getByRole('button', { name: /dismiss banner/i });
    fireEvent.click(dismissButton);
    
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith('preAlphaBannerDismissed', 'true');
  });

  it('does not render when previously dismissed', () => {
    mockSessionStorage.getItem.mockReturnValue('true');
    
    render(<PreAlphaBanner />);
    
    expect(screen.queryByText(/Public Beta/i)).not.toBeInTheDocument();
  });

  it('renders when not previously dismissed', () => {
    mockSessionStorage.getItem.mockReturnValue(null);
    
    render(<PreAlphaBanner />);
    
    expect(screen.getByText(/Public Beta/i)).toBeInTheDocument();
  });

  it('has correct styling classes', () => {
    render(<PreAlphaBanner />);

    const banner = screen.getByText(/Public Beta/i).closest('div')?.parentElement;
    expect(banner).toHaveClass(
      'border-b',
      'border-primary/30',
      'bg-primary/10',
      'text-foreground',
      'px-4',
      'py-3',
      'shadow-sm',
    );
  });

  it('dismiss button has correct styling', () => {
    render(<PreAlphaBanner />);

    const dismissButton = screen.getByRole('button', { name: /dismiss banner/i });
    expect(dismissButton).toHaveClass(
      'ml-4',
      'p-1',
      'rounded-full',
      'transition-colors',
      'hover:bg-primary/15',
    );
  });

  it('handles multiple dismissals gracefully', () => {
    render(<PreAlphaBanner />);
    
    const dismissButton = screen.getByRole('button', { name: /dismiss banner/i });
    fireEvent.click(dismissButton);
    
    // Banner should be gone
    expect(screen.queryByText(/Public Beta/i)).not.toBeInTheDocument();
    
    // Clicking again should not cause errors
    expect(() => {
      fireEvent.click(dismissButton);
    }).not.toThrow();
  });

  it('includes a link to file issues on GitHub', () => {
    render(<PreAlphaBanner />);
    
    const link = screen.getByRole('link', { name: /file it on GitHub/i });
    expect(link).toHaveAttribute('href', 'https://github.com/oma3dao/rep-attestation-frontend/issues/new/choose');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('checks sessionStorage on mount', () => {
    render(<PreAlphaBanner />);
    
    expect(mockSessionStorage.getItem).toHaveBeenCalledWith('preAlphaBannerDismissed');
  });
});
