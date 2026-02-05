import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DidWebInput } from '@/components/did-web-input';

describe('DidWebInput', () => {
  it('renders label and did:web prefix', () => {
    const onChange = vi.fn();
    render(<DidWebInput onChange={onChange} />);
    expect(screen.getByText('Domain')).toBeInTheDocument();
    expect(screen.getByText('did:web:')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('example.com')).toBeInTheDocument();
  });

  it('parses value and populates domain when value is did:web:', () => {
    const onChange = vi.fn();
    render(<DidWebInput value="did:web:example.com" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('example.com');
  });

  it('calls onChange with did:web:... on blur when domain is valid', () => {
    const onChange = vi.fn();
    render(<DidWebInput onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('did:web:example.com');
  });

  it('calls onChange with null on blur when domain is empty', () => {
    const onChange = vi.fn();
    render(<DidWebInput onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('shows error and calls onChange(null) on blur when domain format is invalid', () => {
    const onChange = vi.fn();
    render(<DidWebInput onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '!!invalid!!' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByText('Invalid domain format')).toBeInTheDocument();
  });

  it('shows external error when error prop is set', () => {
    render(<DidWebInput onChange={vi.fn()} error="External error" />);
    expect(screen.getByText('External error')).toBeInTheDocument();
  });
});
