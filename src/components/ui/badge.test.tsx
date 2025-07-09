import { render, screen } from '@testing-library/react';
import React from 'react';
import { Badge } from './badge';

describe('Badge component', () => {
  it('renders with default props', () => {
    render(<Badge>Default Badge</Badge>);
    expect(screen.getByText('Default Badge')).toBeInTheDocument();
  });

  it('renders all variants', () => {
    const variants = ['default', 'secondary', 'destructive', 'outline'];
    variants.forEach(variant => {
      render(<Badge variant={variant as any}>{variant}</Badge>);
      expect(screen.getByText(variant)).toBeInTheDocument();
    });
  });

  it('applies custom className', () => {
    render(<Badge className="custom-class">With Class</Badge>);
    expect(screen.getByText('With Class').className).toMatch(/custom-class/);
  });

  it('forwards props to div', () => {
    render(<Badge data-testid="badge-test">Badge</Badge>);
    expect(screen.getByTestId('badge-test')).toBeInTheDocument();
  });
}); 