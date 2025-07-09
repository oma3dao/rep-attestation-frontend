import { render, screen } from '@testing-library/react';
import React, { createRef } from 'react';
import { vi } from 'vitest';
import { Button } from './button';

describe('Button component', () => {
  it('renders with default props', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('renders all variants', () => {
    const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'];
    variants.forEach(variant => {
      render(<Button variant={variant as any}>{variant}</Button>);
      expect(screen.getByRole('button', { name: variant })).toBeInTheDocument();
    });
  });

  it('renders all sizes', () => {
    const sizes = ['default', 'sm', 'lg', 'icon'];
    sizes.forEach(size => {
      render(<Button size={size as any}>{size}</Button>);
      expect(screen.getByRole('button', { name: size })).toBeInTheDocument();
    });
  });

  it('renders as child element when asChild is true', () => {
    render(
      <Button asChild>
        <a href="#">Link Button</a>
      </Button>
    );
    expect(screen.getByRole('link')).toHaveTextContent('Link Button');
  });

  it('forwards ref to button element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref Button</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('handles disabled state', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    screen.getByRole('button').click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick} disabled>Disabled</Button>);
    screen.getByRole('button').click();
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders asChild with a span', () => {
    render(
      <Button asChild>
        <span data-testid="aschild-span">Span Button</span>
      </Button>
    );
    expect(screen.getByTestId('aschild-span')).toHaveTextContent('Span Button');
  });

  it('renders with variant and size combo', () => {
    render(<Button variant="destructive" size="lg">Combo</Button>);
    expect(screen.getByRole('button', { name: 'Combo' })).toBeInTheDocument();
  });

  it('merges custom className with variant/size', () => {
    render(<Button className="custom-class" variant="secondary" size="sm">Class Merge</Button>);
    const btn = screen.getByRole('button', { name: 'Class Merge' });
    expect(btn.className).toMatch(/custom-class/);
    expect(btn.className).toMatch(/bg-secondary/);
    expect(btn.className).toMatch(/h-9/);
  });

  it('forwards arbitrary props', () => {
    render(<Button data-testid="arbitrary" aria-label="labelled">Arbitrary</Button>);
    const btn = screen.getByTestId('arbitrary');
    expect(btn).toHaveAttribute('aria-label', 'labelled');
  });
}); 