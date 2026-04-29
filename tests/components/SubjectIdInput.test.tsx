import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubjectIdInput } from '@/components/SubjectIdInput';

vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange }: { value: string; onValueChange: (v: string) => void }) => (
    <select
      value={value}
      onChange={(e) => onValueChange(e.currentTarget.value)}
      data-testid="subject-method-select"
    >
      <option value="">Select identifier type</option>
      <option value="did:web">did:web</option>
      <option value="did:pkh">did:pkh</option>
      <option value="did:handle">did:handle</option>
      <option value="did:key">did:key</option>
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => placeholder,
}));

vi.mock('@/components/did-web-input', () => ({
  DidWebInput: ({ value, onChange }: { value?: string; onChange: (v: string | null) => void }) => (
    <div data-testid="did-web-input">
      <input
        aria-label="did:web"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </div>
  ),
}));
vi.mock('@/components/caip10-input', () => ({
  Caip10Input: ({ value, onChange }: { value?: string; onChange: (v: string | null) => void }) => (
    <div data-testid="caip10-input">
      <input
        aria-label="caip10"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </div>
  ),
}));
vi.mock('@/components/did-handle-input', () => ({
  DidHandleInput: ({ value, onChange }: { value?: string; onChange: (v: string | null) => void }) => (
    <div data-testid="did-handle-input">
      <input
        aria-label="did:handle"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </div>
  ),
}));
vi.mock('@/components/did-key-input', () => ({
  DidKeyInput: ({ value, onChange }: { value?: string; onChange: (v: string | null) => void }) => (
    <div data-testid="did-key-input">
      <input
        aria-label="did:key"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </div>
  ),
}));

describe('SubjectIdInput', () => {
  it('renders method selector and info banner', () => {
    const onChange = vi.fn();
    render(<SubjectIdInput onChange={onChange} />);
    expect(screen.getByTestId('subject-method-select')).toBeInTheDocument();
    expect(screen.getByText(/What is a Subject ID/i)).toBeInTheDocument();
  });

  it('shows did:web input when did:web is selected', () => {
    const onChange = vi.fn();
    render(<SubjectIdInput onChange={onChange} />);
    const select = screen.getByTestId('subject-method-select');
    fireEvent.change(select, { target: { value: 'did:web' } });
    expect(screen.getByTestId('did-web-input')).toBeInTheDocument();
  });

  it('shows Caip10Input when did:pkh is selected', () => {
    const onChange = vi.fn();
    render(<SubjectIdInput onChange={onChange} />);
    const select = screen.getByTestId('subject-method-select');
    fireEvent.change(select, { target: { value: 'did:pkh' } });
    expect(screen.getByTestId('caip10-input')).toBeInTheDocument();
  });

  it('calls onChange with did:pkh when caip10 value is entered', () => {
    const onChange = vi.fn();
    render(<SubjectIdInput onChange={onChange} />);
    fireEvent.change(screen.getByTestId('subject-method-select'), { target: { value: 'did:pkh' } });
    const input = screen.getByLabelText('caip10');
    fireEvent.change(input, { target: { value: 'eip155:1:0xabc' } });
    expect(onChange).toHaveBeenCalledWith('did:pkh:eip155:1:0xabc');
  });

  it('displays value and derives method from value', () => {
    const onChange = vi.fn();
    render(<SubjectIdInput value="did:web:example.com" onChange={onChange} />);
    expect(screen.getByTestId('did-web-input')).toBeInTheDocument();
    const input = screen.getByLabelText('did:web');
    expect(input).toHaveValue('did:web:example.com');
  });

  it('clears value when switching method', () => {
    const onChange = vi.fn();
    render(<SubjectIdInput value="did:web:example.com" onChange={onChange} />);
    fireEvent.change(screen.getByTestId('subject-method-select'), { target: { value: 'did:pkh' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('shows did:handle input when did:handle is selected', () => {
    const onChange = vi.fn();
    render(<SubjectIdInput onChange={onChange} />);
    fireEvent.change(screen.getByTestId('subject-method-select'), { target: { value: 'did:handle' } });
    expect(screen.getByTestId('did-handle-input')).toBeInTheDocument();
  });

  it('shows did:key input when did:key is selected', () => {
    const onChange = vi.fn();
    render(<SubjectIdInput onChange={onChange} />);
    fireEvent.change(screen.getByTestId('subject-method-select'), { target: { value: 'did:key' } });
    expect(screen.getByTestId('did-key-input')).toBeInTheDocument();
  });

  it('updates method when value prop changes to different did type', () => {
    const onChange = vi.fn();
    const { rerender } = render(<SubjectIdInput value="did:web:example.com" onChange={onChange} />);
    expect(screen.getByTestId('did-web-input')).toBeInTheDocument();
    rerender(<SubjectIdInput value="did:handle:github:octocat" onChange={onChange} />);
    expect(screen.getByTestId('did-handle-input')).toBeInTheDocument();
  });

  it('calls onChange when did:web value changes', () => {
    const onChange = vi.fn();
    render(<SubjectIdInput onChange={onChange} />);
    fireEvent.change(screen.getByTestId('subject-method-select'), { target: { value: 'did:web' } });
    const input = screen.getByLabelText('did:web');
    fireEvent.change(input, { target: { value: 'did:web:newdomain.com' } });
    expect(onChange).toHaveBeenCalledWith('did:web:newdomain.com');
  });

  it('extracts caip10 value from did:pkh format', () => {
    const onChange = vi.fn();
    render(<SubjectIdInput value="did:pkh:eip155:1:0xabc" onChange={onChange} />);
    expect(screen.getByTestId('caip10-input')).toBeInTheDocument();
    const input = screen.getByLabelText('caip10');
    expect(input).toHaveValue('eip155:1:0xabc');
  });

  it('shows empty caip10 value for non-did:pkh values', () => {
    const onChange = vi.fn();
    render(<SubjectIdInput value="did:web:example.com" onChange={onChange} />);
    // Switch to did:pkh - the caip10Value should be empty since current value is did:web
    fireEvent.change(screen.getByTestId('subject-method-select'), { target: { value: 'did:pkh' } });
    // onChange should be called with null when switching methods
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
