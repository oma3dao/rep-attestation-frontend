// Unit test for FieldRenderer component
// Covers: rendering of different field types and edge cases

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FieldRenderer } from '@/components/FieldRenderer';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('@/components/SubjectIdInput', () => ({
  SubjectIdInput: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <div data-testid="subject-id-input">
      <input aria-label="Subject" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  ),
}));
vi.mock('@/components/TimestampInput', () => ({
  TimestampInput: () => <div data-testid="timestamp-input">Timestamp</div>,
}));
vi.mock('@/components/ProofInput', () => ({
  ProofInput: ({ value, onChange, defaultPurpose }: { value?: any; onChange: (v: any) => void; defaultPurpose?: string }) => (
    <div data-testid="proof-input">
      <span data-testid="proof-value">{JSON.stringify(value)}</span>
      <span data-testid="proof-purpose">{defaultPurpose}</span>
      <button data-testid="set-proof" onClick={() => onChange({ type: 'test-proof', purpose: 'commercial-tx' })}>Set Proof</button>
      <button data-testid="clear-proof" onClick={() => onChange(null)}>Clear Proof</button>
    </div>
  ),
}));
vi.mock('@/components/ObjectFieldRenderer', () => ({
  ObjectFieldRenderer: () => <div data-testid="object-field-renderer">Object</div>,
}));

describe('FieldRenderer', () => {
  const baseField = {
    name: 'test',
    label: 'Test Field',
    type: 'string' as const,
    required: false,
  };

  it('renders a string input', () => {
    render(
      <FieldRenderer field={{ ...baseField, type: 'string' }} value="hello" onChange={() => {}} />
    );
    expect(screen.getByLabelText(/Test Field/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Test Field/i)).toHaveValue('hello');
  });

  it('renders a textarea for reviewBody', () => {
    render(
      <FieldRenderer field={{ ...baseField, name: 'reviewBody', type: 'string' }} value="review text" onChange={() => {}} />
    );
    expect(screen.getByLabelText(/Test Field/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Test Field/i).tagName).toBe('TEXTAREA');
  });

  it('renders a textarea for description', () => {
    render(
      <FieldRenderer field={{ ...baseField, name: 'description', type: 'string' }} value="desc" onChange={() => {}} />
    );
    expect(screen.getByLabelText(/Test Field/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Test Field/i).tagName).toBe('TEXTAREA');
  });

  it('renders an integer input with min/max', () => {
    render(
      <FieldRenderer field={{ ...baseField, type: 'integer', min: 1, max: 10 }} value="5" onChange={() => {}} />
    );
    const input = screen.getByLabelText(/Test Field/i);
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('min', '1');
    expect(input).toHaveAttribute('max', '10');
    expect(input).toHaveValue(5);
  });

  it('renders a datetime input', () => {
    render(
      <FieldRenderer field={{ ...baseField, type: 'datetime' }} value="2023-01-01T12:00" onChange={() => {}} />
    );
    const input = screen.getByLabelText(/Test Field/i);
    expect(input).toHaveAttribute('type', 'datetime-local');
    expect(input).toHaveValue('2023-01-01T12:00');
  });

  it('renders a url input', () => {
    render(
      <FieldRenderer field={{ ...baseField, type: 'uri' }} value="https://example.com" onChange={() => {}} />
    );
    const input = screen.getByLabelText(/Test Field/i);
    expect(input).toHaveAttribute('type', 'url');
    expect(input).toHaveValue('https://example.com');
  });

  it('renders enum as radio buttons when ≤7 options', () => {
    const handleChange = vi.fn();
    render(
      <FieldRenderer field={{ ...baseField, type: 'enum', options: ['A', 'B', 'C'] }} value="B" onChange={handleChange} />
    );
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    // B should be checked
    expect(radios[1]).toBeChecked();
    expect(radios[0]).not.toBeChecked();
    expect(radios[2]).not.toBeChecked();
    // Labels rendered
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    // Clicking a radio triggers onChange
    fireEvent.click(radios[2]);
    expect(handleChange).toHaveBeenCalledWith('C');
  });

  it('renders enum as select dropdown when >7 options', () => {
    const manyOptions = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    render(
      <FieldRenderer field={{ ...baseField, type: 'enum', options: manyOptions }} value="C" onChange={() => {}} />
    );
    const select = screen.getByLabelText(/Test Field/i);
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveValue('C');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(9); // 1 placeholder + 8 options
    expect(options[0]).toHaveTextContent(/select test field/i);
  });

  it('renders an enum select with no options', () => {
    render(
      <FieldRenderer field={{ ...baseField, type: 'enum' }} value="" onChange={() => {}} />
    );
    const select = screen.getByLabelText(/Test Field/i);
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveValue('');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1); // Only placeholder
  });

  it('renders array as checkboxes when options provided (≤7)', () => {
    const handleChange = vi.fn();
    render(
      <FieldRenderer field={{ ...baseField, type: 'array', options: ['X', 'Y', 'Z'] }} value={['X']} onChange={handleChange} />
    );
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
    // X should be checked
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
    expect(checkboxes[2]).not.toBeChecked();
    // Toggle Y on
    fireEvent.click(checkboxes[1]);
    expect(handleChange).toHaveBeenCalledWith(['X', 'Y']);
  });

  it('renders array as checkboxes and allows unchecking', () => {
    const handleChange = vi.fn();
    render(
      <FieldRenderer field={{ ...baseField, type: 'array', options: ['X', 'Y', 'Z'] }} value={['X', 'Z']} onChange={handleChange} />
    );
    const checkboxes = screen.getAllByRole('checkbox');
    // Uncheck X
    fireEvent.click(checkboxes[0]);
    expect(handleChange).toHaveBeenCalledWith(['Z']);
  });

  it('renders array free-text input when no options provided', async () => {
    const handleChange = vi.fn();
    render(
      <FieldRenderer field={{ ...baseField, type: 'array' }} value={['A']} onChange={handleChange} />
    );
    const input = screen.getByPlaceholderText(/add item/i);
    await userEvent.type(input, 'B');
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith(['A', 'B']);
    });
    // Remove item
    const removeBtn = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(removeBtn);
    expect(handleChange).toHaveBeenCalled();
  });

  it('renders array input with empty value', () => {
    render(
      <FieldRenderer field={{ ...baseField, type: 'array' }} value={[]} onChange={() => {}} />
    );
    expect(screen.getByPlaceholderText(/add item/i)).toBeInTheDocument();
    // No items rendered
    expect(screen.queryByText('Remove')).not.toBeInTheDocument();
  });

  it('renders default input for unknown type', () => {
    render(
      <FieldRenderer field={{ ...baseField, type: 'unknown' } as any} value="foo" onChange={() => {}} />
    );
    const input = screen.getByLabelText(/Test Field/i);
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('foo');
  });

  it('renders error message for each type', () => {
    render(
      <FieldRenderer field={{ ...baseField, type: 'string' }} value="" onChange={() => {}} error="Error!" />
    );
    expect(screen.getByTestId('field-error')).toHaveTextContent('Error!');
  });

  it('renders description/help text', () => {
    render(
      <FieldRenderer field={{ ...baseField, description: 'Helpful info' }} value="" onChange={() => {}} />
    );
    expect(screen.getByText(/Helpful info/i)).toBeInTheDocument();
  });

  it('handles empty value', () => {
    render(
      <FieldRenderer field={{ ...baseField, type: 'string' }} value="" onChange={() => {}} />
    );
    expect(screen.getByLabelText(/Test Field/i)).toHaveValue('');
  });

  it('removes all items from array', () => {
    const handleChange = vi.fn();
    render(
      <FieldRenderer field={{ ...baseField, type: 'array' }} value={['A', 'B']} onChange={handleChange} />
    );
    const removeBtns = screen.getAllByRole('button', { name: /remove/i });
    fireEvent.click(removeBtns[0]);
    fireEvent.click(removeBtns[1]);
    expect(handleChange).toHaveBeenCalled();
  });

  it('does not add item to array on Enter if input is empty', async () => {
    const handleChange = vi.fn();
    render(
      <FieldRenderer field={{ ...baseField, type: 'array' }} value={['A']} onChange={handleChange} />
    );
    const input = screen.getByPlaceholderText(/add item/i);
    await userEvent.type(input, '{enter}');
    expect(handleChange).not.toHaveBeenCalledWith(['A', '']);
  });

  it('renders SubjectIdInput when field name is subject', () => {
    render(
      <FieldRenderer
        field={{ ...baseField, name: 'subject', label: 'Subject', type: 'string' }}
        value=""
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId('subject-id-input')).toBeInTheDocument();
  });

  it('renders TimestampInput when integer field has subtype timestamp', () => {
    render(
      <FieldRenderer
        field={{ ...baseField, type: 'integer', subtype: 'timestamp', label: 'Time' }}
        value=""
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId('timestamp-input')).toBeInTheDocument();
  });

  it('renders ProofInput when field name is proofs (default case)', () => {
    render(
      <FieldRenderer
        field={{ ...baseField, name: 'proofs', type: 'proof', label: 'Proofs' } as any}
        value=""
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId('proof-input')).toBeInTheDocument();
  });

  it('uses field.default when value is undefined and type is string', () => {
    render(
      <FieldRenderer
        field={{ ...baseField, type: 'string', default: 'hello' }}
        value={undefined as any}
        onChange={() => {}}
      />
    );
    expect(screen.getByLabelText(/Test Field/i)).toHaveValue('hello');
  });

  it('renders ObjectFieldRenderer when field type is object', () => {
    render(
      <FieldRenderer
        field={{ ...baseField, type: 'object', subFields: [] } as any}
        value=""
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId('object-field-renderer')).toBeInTheDocument();
  });

  it('parses proof from JSON string value (array)', () => {
    const proofData = [{ type: 'test-proof', purpose: 'commercial-tx' }];
    render(
      <FieldRenderer
        field={{ ...baseField, name: 'proofs', type: 'proof', label: 'Proofs' } as any}
        value={JSON.stringify(proofData)}
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId('proof-input')).toBeInTheDocument();
    expect(screen.getByTestId('proof-value')).toHaveTextContent(JSON.stringify(proofData[0]));
  });

  it('parses proof from JSON string value (single object)', () => {
    const proofData = { type: 'single-proof', purpose: 'commercial-tx' };
    render(
      <FieldRenderer
        field={{ ...baseField, name: 'proofs', type: 'proof', label: 'Proofs' } as any}
        value={JSON.stringify(proofData)}
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId('proof-input')).toBeInTheDocument();
    expect(screen.getByTestId('proof-value')).toHaveTextContent(JSON.stringify(proofData));
  });

  it('handles invalid JSON for proof field gracefully', () => {
    render(
      <FieldRenderer
        field={{ ...baseField, name: 'proofs', type: 'proof', label: 'Proofs' } as any}
        value="invalid-json-{{"
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId('proof-input')).toBeInTheDocument();
    expect(screen.getByTestId('proof-value')).toHaveTextContent('null');
  });

  it('calls onChange with JSON array when proof is set', () => {
    const handleChange = vi.fn();
    render(
      <FieldRenderer
        field={{ ...baseField, name: 'proofs', type: 'proof', label: 'Proofs' } as any}
        value=""
        onChange={handleChange}
      />
    );
    fireEvent.click(screen.getByTestId('set-proof'));
    expect(handleChange).toHaveBeenCalledWith(JSON.stringify([{ type: 'test-proof', purpose: 'commercial-tx' }]));
  });

  it('calls onChange with empty string when proof is cleared', () => {
    const handleChange = vi.fn();
    render(
      <FieldRenderer
        field={{ ...baseField, name: 'proofs', type: 'proof', label: 'Proofs' } as any}
        value={JSON.stringify([{ type: 'test-proof' }])}
        onChange={handleChange}
      />
    );
    fireEvent.click(screen.getByTestId('clear-proof'));
    expect(handleChange).toHaveBeenCalledWith('');
  });

  it('uses custom proofPurpose from field config', () => {
    render(
      <FieldRenderer
        field={{ ...baseField, name: 'proofs', type: 'proof', label: 'Proofs', proofPurpose: 'shared-control' } as any}
        value=""
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId('proof-purpose')).toHaveTextContent('shared-control');
  });

  it('uses default proofPurpose when not specified', () => {
    render(
      <FieldRenderer
        field={{ ...baseField, name: 'proofs', type: 'proof', label: 'Proofs' } as any}
        value=""
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId('proof-purpose')).toHaveTextContent('commercial-tx');
  });

  it('uses autoDefault current-timestamp when value is undefined', () => {
    const beforeTime = Math.floor(Date.now() / 1000);
    render(
      <FieldRenderer
        field={{ ...baseField, type: 'integer', autoDefault: 'current-timestamp' } as any}
        value={undefined as any}
        onChange={() => {}}
      />
    );
    const afterTime = Math.floor(Date.now() / 1000);
    const input = screen.getByLabelText(/Test Field/i);
    const inputValue = parseInt(input.getAttribute('value') || '0');
    expect(inputValue).toBeGreaterThanOrEqual(beforeTime);
    expect(inputValue).toBeLessThanOrEqual(afterTime);
  });

  it('uses autoDefault current-datetime when value is undefined', () => {
    render(
      <FieldRenderer
        field={{ ...baseField, type: 'string', autoDefault: 'current-datetime' } as any}
        value={undefined as any}
        onChange={() => {}}
      />
    );
    const input = screen.getByLabelText(/Test Field/i);
    const inputValue = input.getAttribute('value') || '';
    // Should be an ISO 8601 datetime string
    expect(inputValue).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('uses autoDefault current-date when value is undefined', () => {
    render(
      <FieldRenderer
        field={{ ...baseField, type: 'string', autoDefault: 'current-date' } as any}
        value={undefined as any}
        onChange={() => {}}
      />
    );
    const input = screen.getByLabelText(/Test Field/i);
    const inputValue = input.getAttribute('value') || '';
    // Should be an ISO 8601 date string (YYYY-MM-DD)
    expect(inputValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
}); 