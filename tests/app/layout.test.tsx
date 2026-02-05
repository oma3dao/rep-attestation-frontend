import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('next/font/google', () => ({
  Inter: () => ({ className: 'inter-class' }),
}));

vi.mock('next/script', () => ({
  default: ({ src }: { src?: string }) => <script data-testid="script" data-src={src} />,
}));

vi.mock('@/components/header', () => ({
  Header: () => <header data-testid="header">Header</header>,
}));

vi.mock('@/components/providers', () => ({
  Providers: ({ children }: { children: React.ReactNode }) => <div data-testid="providers">{children}</div>,
}));

vi.mock('@/components/pre-alpha-banner', () => ({
  PreAlphaBanner: () => <div data-testid="pre-alpha-banner">PreAlphaBanner</div>,
}));

import RootLayout from '@/app/layout';

describe('RootLayout', () => {
  it('renders without crashing', () => {
    render(
      <RootLayout>
        <div>Child content</div>
      </RootLayout>
    );
  });

  it('renders children inside main', () => {
    render(
      <RootLayout>
        <div data-testid="child">Child content</div>
      </RootLayout>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByTestId('child').textContent).toBe('Child content');
  });

  it('renders Header and PreAlphaBanner', () => {
    render(
      <RootLayout>
        <span>Content</span>
      </RootLayout>
    );
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('pre-alpha-banner')).toBeInTheDocument();
  });

  it('renders main with min-h-screen class', () => {
    render(
      <RootLayout>
        <span>Content</span>
      </RootLayout>
    );
    const main = document.querySelector('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveClass('min-h-screen');
  });
});
