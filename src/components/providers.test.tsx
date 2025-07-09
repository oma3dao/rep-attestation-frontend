import React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { Providers } from './providers';

vi.mock('thirdweb/react', () => ({
  ThirdwebProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="thirdweb-provider">{children}</div>,
}));
vi.mock('@tanstack/react-query', () => ({
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="query-client-provider">{children}</div>,
  QueryClient: class {},
}));

describe('Providers', () => {
  it('renders children and wraps with providers', () => {
    render(
      <Providers>
        <div data-testid="child">Child</div>
      </Providers>
    );
    expect(screen.getByTestId('thirdweb-provider')).not.toBeNull();
    expect(screen.getByTestId('query-client-provider')).not.toBeNull();
    expect(screen.getByTestId('child')).not.toBeNull();
  });
}); 