import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RootLayout from '@/app/layout';

// Mock the CSS import
vi.mock('@/app/globals.css', () => ({}));

// Mock the components to avoid complex dependencies
vi.mock('@/components/header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}));

vi.mock('@/components/providers', () => ({
  Providers: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="providers">{children}</div>
  ),
}));

vi.mock('@/components/pre-alpha-banner', () => ({
  PreAlphaBanner: () => <div data-testid="pre-alpha-banner">PreAlphaBanner</div>,
}));

vi.mock('next/script', () => ({
  default: ({ src, strategy }: { src: string; strategy: string }) => (
    <script data-testid="klaviyo-script" src={src} data-strategy={strategy} />
  ),
}));

vi.mock('next/font/google', () => ({
  Inter: () => ({
    className: 'inter-font',
    subsets: ['latin'],
  }),
}));

describe('RootLayout', () => {
  it('renders layout with all components', () => {
    const { container, getByTestId } = render(
      <RootLayout>
        <div>Test Content</div>
      </RootLayout>
    );

    // Check that the layout structure is correct
    expect(container.querySelector('main')).toBeInTheDocument();

    // Check that all components are rendered
    expect(getByTestId('providers')).toBeInTheDocument();
    expect(getByTestId('pre-alpha-banner')).toBeInTheDocument();
    expect(getByTestId('header')).toBeInTheDocument();

    // Check that children are rendered
    expect(container).toHaveTextContent('Test Content');

    // Note: Klaviyo script is rendered by Next.js Script component and may not be visible in test environment
  });

  it('applies correct CSS classes', () => {
    const { container } = render(
      <RootLayout>
        <div>Test Content</div>
      </RootLayout>
    );

    const main = container.querySelector('main');
    expect(main).toHaveClass('min-h-screen', 'bg-gray-50');
  });
}); 