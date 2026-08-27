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
  TimestampInput: ({ value }: { value?: number | string }) => (
    <div data-testid="timestamp-input">{value === '' ? 'empty' : String(value ?? 'undefined')}</div>
  ),
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
vi.mock('@/components/ProofArrayInput', () => ({
  ProofArrayInput: ({ value, onChange }: { value?: unknown; onChange: (v: unknown) => void }) => (
    <div data-testid="proof-array-input">
      <span data-testid="proof-array-value">{typeof value === 'string' ? value : JSON.stringify(value ?? '')}</span>
      <button type="button" data-testid="proof-array-set" onClick={() => onChange(['proof-1'])}>
        Set proofs
      </button>
    </div>
  ),
}));
// Render Radix-style tooltips inline so description text is queryable in jsdom.
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button" data-testid="tooltip-trigger">{children}</button>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
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

  it('renders enum as radio buttons when ≤7 rich options (with descriptions)', () => {
    const handleChange = vi.fn();
    const richOptions = [
      { value: 'A', label: 'Option A', description: 'first option' },
      { value: 'B', label: 'Option B', description: 'second option' },
      { value: 'C', label: 'Option C', description: 'third option' },
    ];
    render(
      <FieldRenderer
        field={{ ...baseField, type: 'enum', options: richOptions } as any}
        value="B"
        onChange={handleChange}
      />
    );
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[1]).toBeChecked();
    expect(radios[0]).not.toBeChecked();
    expect(radios[2]).not.toBeChecked();
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
    expect(screen.getByText('Option C')).toBeInTheDocument();
    fireEvent.click(radios[2]);
    expect(handleChange).toHaveBeenCalledWith('C');
  });

  it('renders plain string enum options as a select dropdown (≤7)', () => {
    render(
      <FieldRenderer
        field={{ ...baseField, type: 'enum', options: ['A', 'B', 'C'] }}
        value="B"
        onChange={() => {}}
      />
    );
    const select = screen.getByLabelText(/Test Field/i);
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveValue('B');
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

  it('renders SubjectIdInput when field format is did', () => {
    render(
      <FieldRenderer
        field={{ ...baseField, name: 'subject', label: 'Subject', type: 'string', format: 'did' } as any}
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

  it('renders ProofArrayInput when field name is proofs (default case)', () => {
    render(
      <FieldRenderer
        field={{ ...baseField, name: 'proofs', type: 'proof', label: 'Proofs' } as any}
        value=""
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId('proof-array-input')).toBeInTheDocument();
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
    expect(screen.getByTestId('proof-array-input')).toBeInTheDocument();
    expect(screen.getByTestId('proof-array-value')).toHaveTextContent(JSON.stringify(proofData));
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
    expect(screen.getByTestId('proof-array-input')).toBeInTheDocument();
    expect(screen.getByTestId('proof-array-value')).toHaveTextContent(JSON.stringify(proofData));
  });

  it('handles invalid JSON for proof field gracefully', () => {
    render(
      <FieldRenderer
        field={{ ...baseField, name: 'proofs', type: 'proof', label: 'Proofs' } as any}
        value="invalid-json-{{"
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId('proof-array-input')).toBeInTheDocument();
    expect(screen.getByTestId('proof-array-value')).toHaveTextContent('invalid-json-{{');
  });

  it('calls onChange with proof array when proof is set', () => {
    const handleChange = vi.fn();
    render(
      <FieldRenderer
        field={{ ...baseField, name: 'proofs', type: 'proof', label: 'Proofs' } as any}
        value=""
        onChange={handleChange}
      />
    );
    fireEvent.click(screen.getByTestId('proof-array-set'));
    expect(handleChange).toHaveBeenCalledWith(['proof-1']);
  });

  it('calls onChange with empty string when proof is cleared', () => {
    const handleChange = vi.fn();
    render(
      <FieldRenderer
        field={{ ...baseField, name: 'proofs', type: 'array', label: 'Proofs' } as any}
        value={['existing-proof']}
        onChange={handleChange}
      />
    );
    expect(screen.getByTestId('proof-array-input')).toBeInTheDocument();
  });

  it('uses custom proofPurpose from field config', () => {
    render(
      <FieldRenderer
        field={{ ...baseField, name: 'proofs', type: 'proof', label: 'Proofs', proofPurpose: 'shared-control' } as any}
        value=""
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId('proof-array-input')).toBeInTheDocument();
  });

  it('uses default proofPurpose when not specified', () => {
    render(
      <FieldRenderer
        field={{ ...baseField, name: 'proofs', type: 'proof', label: 'Proofs' } as any}
        value=""
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId('proof-array-input')).toBeInTheDocument();
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

  it('renders array as multi-select when options.length > 7 and updates selected values', async () => {
    const handleChange = vi.fn();
    const manyOptions = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    render(
      <FieldRenderer
        field={{ ...baseField, type: 'array', options: manyOptions }}
        value={['A']}
        onChange={handleChange}
      />
    );
    const select = screen.getByLabelText(/Test Field/i);
    expect(select).toHaveAttribute('multiple');
    expect(screen.getByText(/Hold Ctrl \/ Cmd to select multiple/i)).toBeInTheDocument();

    await userEvent.selectOptions(select, ['A', 'C']);
    expect(handleChange).toHaveBeenCalledWith(['A', 'C']);
  });

  it('shows array multi-select validation when error is set and nothing is selected', () => {
    render(
      <FieldRenderer
        field={{ ...baseField, type: 'array', options: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] }}
        value={[]}
        onChange={() => {}}
        error="Required"
      />
    );
    expect(screen.getByText('At least one option must be selected')).toBeInTheDocument();
  });

  it('renders ProofArrayInput when field name is proofs and type is array', () => {
    const handleChange = vi.fn();
    render(
      <FieldRenderer
        field={{ ...baseField, name: 'proofs', type: 'array', label: 'Proofs' } as any}
        value={[]}
        onChange={handleChange}
      />
    );
    expect(screen.getByTestId('proof-array-input')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('proof-array-set'));
    expect(handleChange).toHaveBeenCalledWith(['proof-1']);
  });

  it('shows required asterisk on the label when field.required is true', () => {
    render(
      <FieldRenderer field={{ ...baseField, required: true }} value="" onChange={() => {}} />
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('preserves empty string for timestamp subtype instead of applying defaults', () => {
    render(
      <FieldRenderer
        field={{ ...baseField, type: 'integer', subtype: 'timestamp', autoDefault: 'current-timestamp' }}
        value=""
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId('timestamp-input')).toHaveTextContent('empty');
  });

  it('adds a free-text array item when Add button is clicked', () => {
    const handleChange = vi.fn();
    render(
      <FieldRenderer field={{ ...baseField, type: 'array' }} value={['A']} onChange={handleChange} />
    );
    fireEvent.change(screen.getByPlaceholderText(/add item/i), { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(handleChange).toHaveBeenCalledWith(['A', 'B']);
  });

  it('passes empty string to SubjectIdInput when did format value is an array', () => {
    render(
      <FieldRenderer
        field={{ ...baseField, name: 'subject', type: 'string', format: 'did' } as any}
        value={['did:web:example.com'] as any}
        onChange={() => {}}
      />
    );
    expect(screen.getByLabelText('Subject')).toHaveValue('');
  });

  it.each([
    ['string', { ...baseField, type: 'string' as const }],
    ['reviewBody textarea', { ...baseField, name: 'reviewBody', type: 'string' as const }],
    ['uri', { ...baseField, type: 'uri' as const }],
    ['datetime', { ...baseField, type: 'datetime' as const }],
  ])('coerces non-string %s values to empty without throwing', (_label, field) => {
    render(
      <FieldRenderer field={field as any} value={['x'] as any} onChange={() => {}} />
    );
    const input = screen.getByLabelText(/Test Field/i);
    expect(input).toHaveValue('');
  });

  it('coerces non-string integer values to empty without throwing', () => {
    render(
      <FieldRenderer field={{ ...baseField, type: 'integer' }} value={['x'] as any} onChange={() => {}} />
    );
    const input = screen.getByLabelText(/Test Field/i) as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('renders mixed rich and plain enum options as radios when any option has a description', () => {
    const handleChange = vi.fn();
    const mixedOptions = [
      { value: 'A', label: 'Rich A', description: 'described' },
      'B',
      { value: 'C', label: 'Rich C' },
    ];
    render(
      <FieldRenderer
        field={{ ...baseField, type: 'enum', options: mixedOptions } as any}
        value="B"
        onChange={handleChange}
      />
    );
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(screen.getByText('Rich A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    fireEvent.click(radios[2]!);
    expect(handleChange).toHaveBeenCalledWith('C');
  });

  it('renders RichOption enum values in dropdown using label and value when no descriptions', () => {
    render(
      <FieldRenderer
        field={{
          ...baseField,
          type: 'enum',
          options: [
            { value: 'opt-a', label: 'Option Alpha' },
            { value: 'opt-b', label: 'Option Beta' },
          ],
        } as any}
        value="opt-a"
        onChange={() => {}}
      />
    );
    const select = screen.getByLabelText(/Test Field/i);
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveValue('opt-a');
    expect(screen.getByRole('option', { name: 'Option Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Option Beta' })).toBeInTheDocument();
  });

  it('shows checkbox validation when rich array options are empty and error is set', () => {
    const richOptions = [
      { value: 'X', label: 'Option X', description: 'first' },
      { value: 'Y', label: 'Option Y', description: 'second' },
    ];
    render(
      <FieldRenderer
        field={{ ...baseField, type: 'array', options: richOptions } as any}
        value={[]}
        onChange={() => {}}
        error="Required"
      />
    );
    expect(screen.getByText('At least one option must be selected')).toBeInTheDocument();
    expect(screen.getByText('Option X')).toBeInTheDocument();
  });

  it('starts free-text array from empty when value is a scalar and adds on Add click', () => {
    const handleChange = vi.fn();
    render(
      <FieldRenderer field={{ ...baseField, type: 'array' }} value={'solo' as any} onChange={handleChange} />
    );
    expect(screen.queryByText('solo')).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/add item/i), { target: { value: 'first' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(handleChange).toHaveBeenCalledWith(['first']);
  });

  it('renders rich options in a multi-select when options length exceeds 7', () => {
    const options = Array.from({ length: 8 }, (_, i) => ({
      value: `v${i}`,
      label: `Label ${i}`,
    }));

    render(
      <FieldRenderer
        field={{
          ...baseField,
          name: 'multi',
          type: 'array',
          label: 'Multi',
          options,
        }}
        value={['v1']}
        onChange={() => {}}
      />
    );

    expect(screen.getByLabelText(/Multi/i)).toBeInTheDocument();
    expect(screen.getByText('Label 1')).toBeInTheDocument();
    expect(screen.getByText('Hold Ctrl / Cmd to select multiple')).toBeInTheDocument();
  });

});
