import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChainSearchInput } from '@/components/chain-search-input';

describe('ChainSearchInput', () => {
  it('renders input with placeholder', () => {
    const onChange = vi.fn();
    render(<ChainSearchInput value={null} onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Search mainnets/i);
    expect(input).toBeInTheDocument();
  });

  it('shows dropdown on focus and displays chain results', () => {
    const onChange = vi.fn();
    render(<ChainSearchInput value={null} onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Search mainnets/i);
    fireEvent.focus(input);
    expect(screen.getByText(/\d+ chain(s)?/)).toBeInTheDocument();
  });

  it('filters results when typing', () => {
    const onChange = vi.fn();
    render(<ChainSearchInput value={null} onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Search mainnets/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Ethereum' } });
    const ethereumButton = screen.queryByRole('button', { name: /Ethereum \d+/ });
    expect(ethereumButton || screen.getByText(/Ethereum/)).toBeInTheDocument();
  });

  it('calls onChange with chainId and name when a chain is selected', () => {
    const onChange = vi.fn();
    render(<ChainSearchInput value={null} onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Search mainnets/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Ethereum' } });
    const buttons = screen.getAllByRole('button');
    const ethereumBtn = buttons.find(b => b.textContent?.includes('Ethereum') && b.textContent?.includes('1'));
    if (ethereumBtn) {
      fireEvent.click(ethereumBtn);
      expect(onChange).toHaveBeenCalledWith(1, expect.stringContaining('Ethereum'));
    } else {
      fireEvent.click(buttons[0]);
      expect(onChange).toHaveBeenCalledWith(expect.any(Number), expect.any(String));
    }
  });

  it('displays selected chain when value prop is set', () => {
    const onChange = vi.fn();
    render(<ChainSearchInput value={1} onChange={onChange} />);
    const input = screen.getByDisplayValue(/Ethereum.*1/);
    expect(input).toBeInTheDocument();
  });

  it('closes dropdown on Escape', () => {
    const onChange = vi.fn();
    render(<ChainSearchInput value={null} onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Search mainnets/i);
    fireEvent.focus(input);
    expect(screen.getByText(/\d+ chain(s)?/)).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText(/\d+ chain(s)?/)).not.toBeInTheDocument();
  });

  it('shows No chains found when filter returns empty', () => {
    const onChange = vi.fn();
    render(<ChainSearchInput value={null} onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Search mainnets/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'xyznonexistent999' } });
    expect(screen.getByText(/No chains found/i)).toBeInTheDocument();
  });

  it('navigates with ArrowDown and ArrowUp and selects with Enter', () => {
    const onChange = vi.fn();
    render(<ChainSearchInput value={null} onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Search mainnets/i);
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown', preventDefault: vi.fn() });
    fireEvent.keyDown(input, { key: 'ArrowUp', preventDefault: vi.fn() });
    fireEvent.keyDown(input, { key: 'ArrowDown', preventDefault: vi.fn() });
    fireEvent.keyDown(input, { key: 'Enter', preventDefault: vi.fn() });
    expect(onChange).toHaveBeenCalledWith(expect.any(Number), expect.any(String));
  });

  it('opens dropdown when Enter pressed while closed', () => {
    const onChange = vi.fn();
    render(<ChainSearchInput value={null} onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Search mainnets/i);
    fireEvent.keyDown(input, { key: 'Enter', preventDefault: vi.fn() });
    expect(screen.getByText(/\d+ chain(s)?/)).toBeInTheDocument();
  });

  it('opens dropdown when ArrowDown pressed while closed', () => {
    const onChange = vi.fn();
    render(<ChainSearchInput value={null} onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Search mainnets/i);
    fireEvent.keyDown(input, { key: 'ArrowDown', preventDefault: vi.fn() });
    expect(screen.getByText(/\d+ chain(s)?/)).toBeInTheDocument();
  });

  it('closes dropdown when clicking outside', () => {
    const onChange = vi.fn();
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <ChainSearchInput value={null} onChange={onChange} />
      </div>
    );
    const input = screen.getByPlaceholderText(/Search mainnets/i);
    fireEvent.focus(input);
    expect(screen.getByText(/\d+ chain(s)?/)).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText(/\d+ chain(s)?/)).not.toBeInTheDocument();
  });
});
