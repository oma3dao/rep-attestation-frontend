import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { expect, vi } from 'vitest';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectGroup,
} from '@/components/ui/select';

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

  it('renders SelectLabel when provided inside SelectGroup', () => {
    render(
      <Select value="a" onValueChange={() => {}}>
        <SelectTrigger>Trigger</SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Group 1</SelectLabel>
            <SelectItem value="a">Option A</SelectItem>
            <SelectItem value="b">Option B</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );
    fireEvent.click(screen.getByText('Trigger'));
    expect(screen.getByText('Group 1')).toBeInTheDocument();
  });

  it('renders SelectSeparator when provided', () => {
    render(
      <Select value="a" onValueChange={() => {}}>
        <SelectTrigger>Trigger</SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Group 1</SelectLabel>
            <SelectItem value="a">Option A</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Group 2</SelectLabel>
            <SelectItem value="b">Option B</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );
    fireEvent.click(screen.getByText('Trigger'));
    expect(screen.getByText('Group 1')).toBeInTheDocument();
    expect(screen.getByText('Group 2')).toBeInTheDocument();
  });
}); 