import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DidHandleInput } from '@/components/did-handle-input';
import { socialPlatforms } from '@/config/social-platforms';

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div data-testid="popover">{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div data-testid="popover-content">{children}</div>,
}));

vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: { children: React.ReactNode }) => <div data-testid="command">{children}</div>,
  CommandInput: () => <input data-testid="command-input" placeholder="Search platforms..." />,
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandEmpty: () => <div>No platform found.</div>,
  CommandGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandItem: ({ value, onSelect, children }: { value: string; onSelect: () => void; children: React.ReactNode }) => (
    <button type="button" data-testid={`platform-${value}`} onClick={onSelect}>
      {children}
    </button>
  ),
}));

describe('DidHandleInput', () => {
  it('renders platform selector and handle input', () => {
    const onChange = vi.fn();
    render(<DidHandleInput onChange={onChange} />);
    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByLabelText(/Username|Handle/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('username')).toBeInTheDocument();
  });

  it('parses value and populates platform and handle when value is did:handle:', () => {
    const onChange = vi.fn();
    render(<DidHandleInput value="did:handle:github:octocat" onChange={onChange} />);
    expect(screen.getByRole('combobox')).toHaveTextContent('GitHub');
    const handleInput = screen.getByPlaceholderText('username');
    expect(handleInput).toHaveValue('octocat');
  });

  it('calls onChange with did:handle:... on blur when platform and handle are valid', () => {
    const onChange = vi.fn();
    render(<DidHandleInput onChange={onChange} />);
    const githubItem = socialPlatforms.find(p => p.id === 'github');
    const platformButton = screen.getByRole('combobox');
    fireEvent.click(platformButton);
    const option = screen.getByTestId(`platform-${githubItem?.label}`);
    fireEvent.click(option);
    const handleInput = screen.getByPlaceholderText('username');
    fireEvent.change(handleInput, { target: { value: 'octocat' } });
    fireEvent.blur(handleInput);
    expect(onChange).toHaveBeenCalledWith('did:handle:github:octocat');
  });

  it('calls onChange with did:handle when platform selected after handle is entered', () => {
    const onChange = vi.fn();
    render(<DidHandleInput onChange={onChange} />);
    const handleInput = screen.getByPlaceholderText('username');
    fireEvent.change(handleInput, { target: { value: 'octocat' } });
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByTestId('platform-GitHub'));
    expect(onChange).toHaveBeenCalledWith('did:handle:github:octocat');
  });

  it('calls onChange with null on blur when handle is empty', () => {
    const onChange = vi.fn();
    render(<DidHandleInput onChange={onChange} />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByTestId('platform-GitHub'));
    const handleInput = screen.getByPlaceholderText('username');
    fireEvent.blur(handleInput);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('shows error on blur when handle has invalid characters', () => {
    const onChange = vi.fn();
    render(<DidHandleInput onChange={onChange} />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByTestId('platform-GitHub'));
    const handleInput = screen.getByPlaceholderText('username');
    fireEvent.change(handleInput, { target: { value: 'user@#$' } });
    fireEvent.blur(handleInput);
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByText(/Invalid handle format/i)).toBeInTheDocument();
  });
});
