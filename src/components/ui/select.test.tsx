import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { Select, SelectTrigger, SelectContent, SelectItem } from './select';

describe('Select', () => {
  it('renders with options', () => {
    render(
      <Select value="a" onValueChange={() => {}}>
        <SelectTrigger>Trigger</SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
        </SelectContent>
      </Select>
    );
    fireEvent.click(screen.getByText('Trigger'));
    expect(screen.getByText('Option A')).not.toBeNull();
    expect(screen.getByText('Option B')).not.toBeNull();
  });

  it('calls onValueChange when option is selected', () => {
    const handleChange = vi.fn();
    render(
      <Select value="a" onValueChange={handleChange}>
        <SelectTrigger>Trigger</SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
        </SelectContent>
      </Select>
    );
    fireEvent.click(screen.getByText('Trigger'));
    fireEvent.click(screen.getByText('Option B'));
    expect(handleChange).toHaveBeenCalledWith('b');
  });
}); 