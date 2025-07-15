import { render, screen, fireEvent } from '@testing-library/react';
import React, { createRef } from 'react';
import { vi } from 'vitest';
import { Input } from '@/components/ui/input';

describe('Input component', () => {
  it('renders with default props', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders with type prop', () => {
    render(<Input type="email" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
  });

  it('renders with value and onChange', () => {
    const handleChange = vi.fn();
    render(<Input value="test" onChange={handleChange} />);
    const input = screen.getByDisplayValue('test');
    fireEvent.change(input, { target: { value: 'new' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('handles disabled state', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('applies custom className', () => {
    render(<Input className="custom-class" />);
    expect(screen.getByRole('textbox').className).toMatch(/custom-class/);
  });

  it('forwards ref to input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('forwards arbitrary props', () => {
    render(<Input data-testid="arbitrary" aria-label="labelled" />);
    const input = screen.getByTestId('arbitrary');
    expect(input).toHaveAttribute('aria-label', 'labelled');
  });
}); 