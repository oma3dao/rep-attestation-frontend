import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DidKeyInput } from '@/components/did-key-input';

// Valid multibase key (base58btc, starts with z, 40+ chars)
const validKey = 'z6Mkf5rGMoatrSj1f4MVnadHZtnDRj2tN8S9XG5WWQ8s2fEd';

describe('DidKeyInput', () => {
  it('renders label and did:key prefix', () => {
    const onChange = vi.fn();
    render(<DidKeyInput onChange={onChange} />);
    expect(screen.getByLabelText(/Public Key/i)).toBeInTheDocument();
    expect(screen.getByText('did:key:')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('z6Mk...')).toBeInTheDocument();
  });

  it('parses value and populates key when value is did:key:', () => {
    const onChange = vi.fn();
    render(<DidKeyInput value={`did:key:${validKey}`} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue(validKey);
  });

  it('calls onChange with did:key:... on blur when key is valid', () => {
    const onChange = vi.fn();
    render(<DidKeyInput onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: validKey } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(`did:key:${validKey}`);
  });

  it('calls onChange with null on blur when key is empty', () => {
    const onChange = vi.fn();
    render(<DidKeyInput onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('shows error and calls onChange(null) when key does not start with z', () => {
    const onChange = vi.fn();
    render(<DidKeyInput onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'x6Mkf5rGMoatrSj1f4MVnadHZtnDRj2tN8S9XG5WWQ8s2fEd' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByText(/start with 'z'/i)).toBeInTheDocument();
  });

  it('shows error when key is too short', () => {
    const onChange = vi.fn();
    render(<DidKeyInput onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'z6Mk' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByText(/too short/i)).toBeInTheDocument();
  });

  it('shows external error when error prop is set', () => {
    render(<DidKeyInput onChange={vi.fn()} error="External error" />);
    expect(screen.getByText('External error')).toBeInTheDocument();
  });
});
