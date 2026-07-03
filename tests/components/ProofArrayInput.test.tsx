import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Test double for ProofInput: surfaces the incoming value/error and exposes
// buttons to emit a proof or clear it, so we can exercise the array logic.
vi.mock('@/components/ProofInput', () => ({
  ProofInput: ({
    value,
    onChange,
    error,
  }: {
    value: unknown;
    onChange: (p: unknown) => void;
    error?: string;
  }) => (
    <div data-testid="proof-input">
      <span data-testid="proof-value">{value ? JSON.stringify(value) : 'empty'}</span>
      {error ? <span data-testid="proof-error">{error}</span> : null}
      <button type="button" onClick={() => onChange({ type: 'set', value: 'new' })}>
        set-proof
      </button>
      <button type="button" onClick={() => onChange(null)}>clear-proof</button>
    </div>
  ),
}));

import { ProofArrayInput } from '@/components/ProofArrayInput';

describe('ProofArrayInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a single empty proof slot by default', () => {
    render(<ProofArrayInput value="" onChange={vi.fn()} />);
    expect(screen.getAllByTestId('proof-input')).toHaveLength(1);
    expect(screen.getByTestId('proof-value')).toHaveTextContent('empty');
    // No per-proof header/Remove button when there is only one.
    expect(screen.queryByText('Proof 1')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add another proof/i })).toBeInTheDocument();
  });

  it('parses a JSON-stringified array into multiple proof inputs', () => {
    const value = JSON.stringify([
      { type: 't1', value: 'v1' },
      { type: 't2', value: 'v2' },
    ]);
    render(<ProofArrayInput value={value} onChange={vi.fn()} />);
    expect(screen.getAllByTestId('proof-input')).toHaveLength(2);
    expect(screen.getByText('Proof 1')).toBeInTheDocument();
    expect(screen.getByText('Proof 2')).toBeInTheDocument();
    expect(screen.getAllByText('Remove')).toHaveLength(2);
  });

  it('parses an array of JSON strings', () => {
    const value = [
      JSON.stringify({ type: 't1', value: 'v1' }),
      JSON.stringify({ type: 't2', value: 'v2' }),
    ];
    render(<ProofArrayInput value={value} onChange={vi.fn()} />);
    expect(screen.getAllByTestId('proof-input')).toHaveLength(2);
  });

  it('falls back to a single empty slot for invalid JSON', () => {
    render(<ProofArrayInput value="{not json" onChange={vi.fn()} />);
    expect(screen.getAllByTestId('proof-input')).toHaveLength(1);
    expect(screen.getByTestId('proof-value')).toHaveTextContent('empty');
  });

  it('adds another proof slot when "Add another proof" is clicked', () => {
    render(<ProofArrayInput value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Add another proof/i }));
    expect(screen.getAllByTestId('proof-input')).toHaveLength(2);
  });

  it('emits a JSON-stringified array when a proof is set', () => {
    const onChange = vi.fn();
    render(<ProofArrayInput value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'set-proof' }));
    expect(onChange).toHaveBeenCalledWith(JSON.stringify([{ type: 'set', value: 'new' }]));
  });

  it('emits an empty string when the only proof is cleared', () => {
    const onChange = vi.fn();
    render(
      <ProofArrayInput value={JSON.stringify([{ type: 't1', value: 'v1' }])} onChange={onChange} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'clear-proof' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('removes a proof and emits the remaining ones', () => {
    const onChange = vi.fn();
    render(
      <ProofArrayInput
        value={JSON.stringify([
          { type: 't1', value: 'v1' },
          { type: 't2', value: 'v2' },
        ])}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getAllByText('Remove')[0]);
    expect(screen.getAllByTestId('proof-input')).toHaveLength(1);
    const emitted = onChange.mock.calls.at(-1)![0] as string;
    expect(emitted).toContain('v2');
    expect(emitted).not.toContain('v1');
  });

  it('clears (does not remove) the last remaining proof when removed', () => {
    const onChange = vi.fn();
    // Two proofs so Remove buttons render; remove one to get to a single slot,
    // then the component keeps at least one slot.
    render(
      <ProofArrayInput
        value={JSON.stringify([
          { type: 't1', value: 'v1' },
          { type: 't2', value: 'v2' },
        ])}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getAllByText('Remove')[0]);
    expect(screen.getAllByTestId('proof-input')).toHaveLength(1);
  });

  it('passes the error only to the first proof input', () => {
    render(
      <ProofArrayInput
        value={JSON.stringify([
          { type: 't1', value: 'v1' },
          { type: 't2', value: 'v2' },
        ])}
        onChange={vi.fn()}
        error="bad proof"
      />
    );
    expect(screen.getAllByTestId('proof-error')).toHaveLength(1);
    expect(screen.getByTestId('proof-error')).toHaveTextContent('bad proof');
  });
});
