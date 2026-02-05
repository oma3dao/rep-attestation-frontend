import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Caip10Input } from '@/components/caip10-input';

const validEvmCaip10 = 'eip155:1:0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
const validEvmAddress = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
const validSolanaAddress = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH';
const validSuiAddress = '0x0000000000000000000000000000000000000000000000000000000000000001';

vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange }: { value: string; onValueChange: (v: string) => void }) => {
    if (value === 'mainnet') {
      return (
        <select value={value} onChange={(e) => onValueChange(e.target.value)} aria-label="Network">
          <option value="mainnet">Mainnet</option>
        </select>
      );
    }
    return (
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        aria-label="Namespace"
        data-testid="namespace-select"
      >
        <option value="eip155">eip155 (EVM chains)</option>
        <option value="solana">solana (Solana)</option>
        <option value="sui">sui (Sui)</option>
      </select>
    );
  },
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
  SelectValue: () => null,
}));

describe('Caip10Input', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders label and input with placeholder', () => {
    const onChange = vi.fn();
    render(<Caip10Input onChange={onChange} />);
    expect(screen.getByLabelText(/CAIP-10 Account/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/eip155:1:0x/i)).toBeInTheDocument();
  });

  it('shows info about chain support', () => {
    render(<Caip10Input onChange={vi.fn()} />);
    expect(screen.getByText(/CAIP-10 ID/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CAIP-10 Builder/i })).toBeInTheDocument();
  });

  it('calls onChange with normalized CAIP-10 on blur when input is valid', () => {
    const onChange = vi.fn();
    render(<Caip10Input onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: validEvmCaip10 } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalled();
    const calledWith = onChange.mock.calls[0][0];
    expect(calledWith).toMatch(/^eip155:1:0x[a-fA-F0-9]{40}$/);
  });

  it('calls onChange with null on blur when input is invalid', () => {
    const onChange = vi.fn();
    render(<Caip10Input onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'not-valid-caip10' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('calls onChange with null on blur when input is empty', () => {
    const onChange = vi.fn();
    render(<Caip10Input onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('syncs input with value prop', () => {
    const onChange = vi.fn();
    render(<Caip10Input value={validEvmCaip10} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue(validEvmCaip10);
  });

  it('syncs input when value prop changes externally', () => {
    const onChange = vi.fn();
    const { rerender } = render(<Caip10Input value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('');
    
    // Change value prop externally
    rerender(<Caip10Input value={validEvmCaip10} onChange={onChange} />);
    expect(input).toHaveValue(validEvmCaip10);
  });

  it('shows error message when error prop is set', () => {
    render(<Caip10Input onChange={vi.fn()} error="Invalid format" />);
    expect(screen.getByText('Invalid format')).toBeInTheDocument();
  });

  it('copy button writes normalized CAIP-10 to clipboard when valid', async () => {
    const onChange = vi.fn();
    render(<Caip10Input onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: validEvmCaip10 } });
    fireEvent.blur(input);
    const copyBtn = screen.getByRole('button', { name: /Copy normalized CAIP-10/i });
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringMatching(/^eip155:1:0x[a-fA-F0-9]{40}$/)
      );
    });
  });

  it('builder eip155: apply builds normalized CAIP-10 and calls onChange', async () => {
    const onChange = vi.fn();
    render(<Caip10Input onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /CAIP-10 Builder/i }));
    const chainInput = screen.getByPlaceholderText(/e\.g\., 66238/);
    fireEvent.change(chainInput, { target: { value: '1' } });
    const addressInput = screen.getByLabelText(/^Address$/i);
    fireEvent.change(addressInput, { target: { value: validEvmAddress } });
    fireEvent.click(screen.getByRole('button', { name: /Use this/i }));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.stringMatching(/^eip155:1:0x[a-fA-F0-9]{40}$/)
      );
    });
  });

  it('builder solana: apply builds normalized CAIP-10 and calls onChange', async () => {
    const onChange = vi.fn();
    render(<Caip10Input onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /CAIP-10 Builder/i }));
    const namespaceSelect = screen.getByTestId('namespace-select');
    fireEvent.change(namespaceSelect, { target: { value: 'solana' } });
    const accountInput = screen.getByLabelText(/^Account$/i);
    fireEvent.change(accountInput, { target: { value: validSolanaAddress } });
    fireEvent.click(screen.getByRole('button', { name: /Use this/i }));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.stringMatching(/^solana:mainnet:[A-Za-z0-9]+$/)
      );
    });
  });

  it('builder sui: apply builds normalized CAIP-10 and calls onChange', async () => {
    const onChange = vi.fn();
    render(<Caip10Input onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /CAIP-10 Builder/i }));
    const namespaceSelect = screen.getByTestId('namespace-select');
    fireEvent.change(namespaceSelect, { target: { value: 'sui' } });
    const accountInput = screen.getByLabelText(/^Account$/i);
    fireEvent.change(accountInput, { target: { value: validSuiAddress } });
    fireEvent.click(screen.getByRole('button', { name: /Use this/i }));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.stringMatching(/^sui:mainnet:0x[a-fA-F0-9]+$/)
      );
    });
  });

});

describe('Caip10Input debounce tests', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounce timer clears when input changes quickly', async () => {
    const onChange = vi.fn();
    render(<Caip10Input onChange={onChange} />);
    const input = screen.getByRole('textbox');
    
    // Type multiple times quickly to trigger debounce clear
    fireEvent.change(input, { target: { value: 'eip155' } });
    vi.advanceTimersByTime(500); // Advance some time but less than debounce
    fireEvent.change(input, { target: { value: 'eip155:1' } });
    vi.advanceTimersByTime(500);
    fireEvent.change(input, { target: { value: validEvmCaip10 } });
    
    // onChange should not be called until debounce completes
    expect(onChange).not.toHaveBeenCalled();
    
    // Fast-forward past debounce timeout (2 seconds)
    vi.advanceTimersByTime(2100);
    
    // The timer callback ran - verify debounce clear worked (timer was restarted)
    expect(onChange).toHaveBeenCalled();
  });

  it('debounce timer calls onChange with null for invalid input after delay', async () => {
    const onChange = vi.fn();
    render(<Caip10Input onChange={onChange} />);
    const input = screen.getByRole('textbox');
    
    // Enter invalid input
    fireEvent.change(input, { target: { value: 'invalid-caip10-format' } });
    
    // onChange should not be called until debounce completes
    expect(onChange).not.toHaveBeenCalled();
    
    // Fast-forward past debounce timeout
    vi.advanceTimersByTime(2100);
    
    // onChange should be called with null for invalid input
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('debounce timer calls onChange with null for empty input after delay', async () => {
    const onChange = vi.fn();
    render(<Caip10Input onChange={onChange} />);
    const input = screen.getByRole('textbox');
    
    // Enter then clear input
    fireEvent.change(input, { target: { value: 'test' } });
    vi.advanceTimersByTime(500);
    fireEvent.change(input, { target: { value: '' } });
    
    // Fast-forward past debounce timeout
    vi.advanceTimersByTime(2100);
    
    // onChange should be called with null for empty input
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
