import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ObjectFieldRenderer } from '@/components/ObjectFieldRenderer';
import type { FormField } from '@/config/schemas';

// Mock FieldRenderer so dynamic import in ObjectFieldRenderer resolves immediately
vi.mock('@/components/FieldRenderer', () => ({
  FieldRenderer: ({ field, value, onChange }: { field: FormField; value: unknown; onChange: (v: string) => void }) => (
    <input
      data-testid={`field-${field.name}`}
      aria-label={field.label}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange((e.target as HTMLInputElement).value)}
    />
  ),
}));

describe('ObjectFieldRenderer', () => {
  it('renders "No sub-fields defined" when field has no subFields', () => {
    const field: FormField = {
      name: 'empty',
      type: 'object',
      label: 'Empty Object',
      required: false,
      subFields: [],
    };
    render(
      <ObjectFieldRenderer
        field={field}
        value=""
        onChange={() => {}}
      />
    );
    expect(screen.getByText(/no sub-fields defined/i)).toBeInTheDocument();
  });

  it('renders "No sub-fields defined" when subFields is undefined', () => {
    const field: FormField = {
      name: 'empty',
      type: 'object',
      label: 'Empty Object',
      required: false,
    };
    render(
      <ObjectFieldRenderer
        field={field}
        value=""
        onChange={() => {}}
      />
    );
    expect(screen.getByText(/no sub-fields defined/i)).toBeInTheDocument();
  });

  it('renders sub-fields when field has subFields and FieldRenderer loads', async () => {
    const field: FormField = {
      name: 'nested',
      type: 'object',
      label: 'Nested',
      required: false,
      subFields: [
        { name: 'foo', type: 'string', label: 'Foo', required: false },
      ],
    };
    const onChange = vi.fn();
    render(
      <ObjectFieldRenderer
        field={field}
        value=""
        onChange={onChange}
      />
    );
    await waitFor(() => {
      expect(screen.getByLabelText(/foo/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('parses initial JSON value into object', async () => {
    const field: FormField = {
      name: 'nested',
      type: 'object',
      label: 'Nested',
      required: false,
      subFields: [
        { name: 'foo', type: 'string', label: 'Foo', required: false },
      ],
    };
    render(
      <ObjectFieldRenderer
        field={field}
        value='{"foo":"bar"}'
        onChange={() => {}}
      />
    );
    await waitFor(() => {
      expect(screen.getByLabelText(/foo/i)).toBeInTheDocument();
    }, { timeout: 3000 });
    const input = screen.getByLabelText(/foo/i);
    expect((input as HTMLInputElement).value).toBe('bar');
  });

  it('handles invalid JSON value by defaulting to empty object', async () => {
    const field: FormField = {
      name: 'nested',
      type: 'object',
      label: 'Nested',
      required: false,
      subFields: [
        { name: 'foo', type: 'string', label: 'Foo', required: false },
      ],
    };
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <ObjectFieldRenderer
        field={field}
        value='not valid json'
        onChange={() => {}}
      />
    );
    await waitFor(() => {
      expect(screen.getByLabelText(/foo/i)).toBeInTheDocument();
    }, { timeout: 3000 });
    consoleSpy.mockRestore();
  });

  it('renders when error is a record (passes sub-field errors to FieldRenderer)', async () => {
    const field: FormField = {
      name: 'nested',
      type: 'object',
      label: 'Nested',
      required: false,
      subFields: [
        { name: 'foo', type: 'string', label: 'Foo', required: true },
      ],
    };
    render(
      <ObjectFieldRenderer
        field={field}
        value=""
        onChange={() => {}}
        error={{ foo: 'Foo is required' }}
      />
    );
    await waitFor(() => {
      expect(screen.getByLabelText(/foo/i)).toBeInTheDocument();
    }, { timeout: 3000 });
    // ObjectFieldRenderer passes error[subField.name] to FieldRenderer; error text is rendered by FieldRenderer
    expect(screen.getByTestId('field-foo')).toBeInTheDocument();
  });

  it('displays general error when error is a string (nested mode)', async () => {
    const field: FormField = {
      name: 'nested',
      type: 'object',
      label: 'Nested',
      required: false,
      nested: true,
      subFields: [
        { name: 'foo', type: 'string', label: 'Foo', required: false },
      ],
    };
    render(
      <ObjectFieldRenderer
        field={field}
        value=""
        onChange={() => {}}
        error="Object is invalid"
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('field-error')).toBeInTheDocument();
      expect(screen.getByText('Object is invalid')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('displays general error when error is a string (flat mode)', async () => {
    const field: FormField = {
      name: 'flat',
      type: 'object',
      label: 'Flat',
      required: false,
      nested: false,
      subFields: [
        { name: 'foo', type: 'string', label: 'Foo', required: false },
      ],
    };
    render(
      <ObjectFieldRenderer
        field={field}
        value=""
        onChange={() => {}}
        error="Flat object error"
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('field-error')).toBeInTheDocument();
      expect(screen.getByText('Flat object error')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('calls onChange with updated JSON when sub-field value changes', async () => {
    const field: FormField = {
      name: 'nested',
      type: 'object',
      label: 'Nested',
      required: false,
      subFields: [
        { name: 'foo', type: 'string', label: 'Foo', required: false },
      ],
    };
    const onChange = vi.fn();
    const { rerender } = render(
      <ObjectFieldRenderer
        field={field}
        value='{"foo":""}'
        onChange={onChange}
      />
    );
    await waitFor(() => {
      expect(screen.getByLabelText(/foo/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    const input = screen.getByLabelText(/foo/i);
    // Use fireEvent.change which properly triggers React's onChange
    fireEvent.change(input, { target: { value: 'bar' } });

    await waitFor(() => {
      // onChange should be called with updated JSON containing the new value
      expect(onChange).toHaveBeenCalledWith(expect.stringContaining('bar'));
    }, { timeout: 3000 });
  });

  it('renders nested object with description', async () => {
    const field: FormField = {
      name: 'nested',
      type: 'object',
      label: 'Nested Object',
      description: 'This is a helpful description',
      required: true,
      nested: true,
      subFields: [
        { name: 'foo', type: 'string', label: 'Foo', required: false },
      ],
    };
    render(
      <ObjectFieldRenderer
        field={field}
        value=""
        onChange={() => {}}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Nested Object')).toBeInTheDocument();
      expect(screen.getByText('This is a helpful description')).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument(); // Required indicator
    }, { timeout: 3000 });
  });

  it('renders nested object without description', async () => {
    const field: FormField = {
      name: 'nested',
      type: 'object',
      label: 'Nested Object',
      required: false,
      nested: true,
      subFields: [
        { name: 'foo', type: 'string', label: 'Foo', required: false },
      ],
    };
    render(
      <ObjectFieldRenderer
        field={field}
        value=""
        onChange={() => {}}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Nested Object')).toBeInTheDocument();
      expect(screen.queryByText('This is a helpful description')).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
