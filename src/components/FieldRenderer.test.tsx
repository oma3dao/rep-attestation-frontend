// Unit test for FieldRenderer component
// Covers: rendering of different field types and edge cases

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FieldRenderer } from './FieldRenderer';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

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

  it('renders an enum select with options', () => {
    render(
      <FieldRenderer field={{ ...baseField, type: 'enum', options: ['A', 'B', 'C'] }} value="B" onChange={() => {}} />
    );
    const select = screen.getByLabelText(/Test Field/i);
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveValue('B');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4); // 1 placeholder + 3 options
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

  it('renders an array input and allows adding/removing items', async () => {
    const handleChange = vi.fn();
    render(
      <FieldRenderer field={{ ...baseField, type: 'array', options: ['X', 'Y', 'Z'] }} value={['X']} onChange={handleChange} />
    );
    const input = screen.getByPlaceholderText(/add item/i);
    await userEvent.type(input, 'Y');
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });
    expect(handleChange).toHaveBeenCalledWith(['X', 'Y']);
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

  it('removes item from empty array gracefully', () => {
    const handleChange = vi.fn();
    render(
      <FieldRenderer field={{ ...baseField, type: 'array' }} value={[]} onChange={handleChange} />
    );
    // Try to remove item at index 0 (should not throw)
    // No remove button should be rendered
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  });

  it('renders enum select with undefined options', () => {
    render(
      <FieldRenderer field={{ ...baseField, type: 'enum', options: undefined }} value="" onChange={() => {}} />
    );
    const select = screen.getByLabelText(/Test Field/i);
    expect(select.tagName).toBe('SELECT');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1); // Only placeholder
  });
}); 