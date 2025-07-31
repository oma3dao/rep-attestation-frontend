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
  });

  it('renders banner by default', () => {
    render(<PreAlphaBanner />);
    
    expect(screen.getByText(/Pre-Alpha Preview/i)).toBeInTheDocument();
    expect(screen.getByText(/Smart contracts are deployed to testnets only/i)).toBeInTheDocument();
    expect(screen.getByText(/Features are incomplete and may change/i)).toBeInTheDocument();
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
    
    expect(screen.queryByText(/Pre-Alpha Preview/i)).not.toBeInTheDocument();
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
    
    expect(screen.queryByText(/Pre-Alpha Preview/i)).not.toBeInTheDocument();
  });

  it('renders when not previously dismissed', () => {
    mockSessionStorage.getItem.mockReturnValue(null);
    
    render(<PreAlphaBanner />);
    
    expect(screen.getByText(/Pre-Alpha Preview/i)).toBeInTheDocument();
  });

  it('has correct styling classes', () => {
    render(<PreAlphaBanner />);
    
    const banner = screen.getByText(/Pre-Alpha Preview/i).closest('div')?.parentElement;
    expect(banner).toHaveClass('bg-yellow-100', 'text-black', 'px-4', 'py-3', 'shadow-sm', 'border-b');
  });

  it('dismiss button has correct styling', () => {
    render(<PreAlphaBanner />);
    
    const dismissButton = screen.getByRole('button', { name: /dismiss banner/i });
    expect(dismissButton).toHaveClass('ml-4', 'p-1', 'hover:bg-yellow-200', 'rounded-full', 'transition-colors');
  });

  it('handles multiple dismissals gracefully', () => {
    render(<PreAlphaBanner />);
    
    const dismissButton = screen.getByRole('button', { name: /dismiss banner/i });
    fireEvent.click(dismissButton);
    
    // Banner should be gone
    expect(screen.queryByText(/Pre-Alpha Preview/i)).not.toBeInTheDocument();
    
    // Clicking again should not cause errors
    expect(() => {
      fireEvent.click(dismissButton);
    }).not.toThrow();
  });

  it('checks sessionStorage on mount', () => {
    render(<PreAlphaBanner />);
    
    expect(mockSessionStorage.getItem).toHaveBeenCalledWith('preAlphaBannerDismissed');
  });
}); 