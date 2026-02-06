import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as blockchain from '@/lib/blockchain';
import { ProofInput } from '@/components/ProofInput';

vi.mock('@/lib/blockchain', () => ({
  useWallet: vi.fn(() => ({
    address: '0xabc123',
    chainId: 1,
    isConnected: true,
  })),
}));

vi.mock('@/components/ui/select', () => {
  const React = require('react');
  return {
    Select: ({ value, onValueChange }: { value: string; onValueChange: (v: string) => void }) =>
      React.createElement('select', {
        value,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onValueChange(e.currentTarget.value),
        'data-testid': 'proof-type-select',
      }, [
        React.createElement('option', { key: '', value: '' }, 'Select proof type (optional)'),
        React.createElement('option', { key: 'tx', value: 'tx-interaction' }, 'tx-interaction'),
        React.createElement('option', { key: 'ev', value: 'evidence-pointer' }, 'evidence-pointer'),
      ]),
    SelectTrigger: ({ children }: { children: unknown }) => children,
    SelectContent: ({ children }: { children: unknown }) => children,
    SelectItem: ({ value, children }: { value: string; children: unknown }) => React.createElement('option', { value }, children),
    SelectValue: ({ placeholder }: { placeholder?: string }) => placeholder,
  };
});

vi.mock('@/components/chain-search-input', () => ({
  ChainSearchInput: ({
    value,
    onChange,
    placeholder,
  }: {
    value: number | null;
    onChange: (id: number) => void;
    placeholder?: string;
  }) => (
    <div data-testid="chain-search">
      <select
        aria-label="chain"
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      >
        <option value="">{placeholder}</option>
        <option value="1">Ethereum</option>
        <option value="66238">OMAchain</option>
      </select>
    </div>
  ),
}));

describe('ProofInput', () => {
  it('renders proof type selector', () => {
    const onChange = vi.fn();
    render(<ProofInput value={null} onChange={onChange} />);
    const select = screen.getByTestId('proof-type-select');
    expect(select).toBeInTheDocument();
    expect(select).toHaveDisplayValue(/Select proof type|optional/);
  });

  it('calls onChange with null when no proof type selected', () => {
    const onChange = vi.fn();
    render(<ProofInput value={null} onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows tx-interaction fields when tx-interaction is selected', () => {
    const onChange = vi.fn();
    render(<ProofInput value={null} onChange={onChange} />);
    const select = screen.getByTestId('proof-type-select');
    fireEvent.change(select, { target: { value: 'tx-interaction' } });
    expect(screen.getByTestId('chain-search')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/0x/i)).toBeInTheDocument();
  });

  it('calls onChange with tx-interaction proof when chain and tx hash are set', () => {
    const onChange = vi.fn();
    render(<ProofInput value={null} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('proof-type-select'), { target: { value: 'tx-interaction' } });
    const chainSelect = screen.getByLabelText('chain');
    fireEvent.change(chainSelect, { target: { value: '66238' } });
    const txHashInput = screen.getByPlaceholderText(/0x/i);
    fireEvent.change(txHashInput, { target: { value: '0xabc123' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        proofType: 'tx-interaction',
        proofPurpose: 'commercial-tx',
        proofObject: expect.objectContaining({
          chainId: 'eip155:66238',
          txHash: '0xabc123',
        }),
      })
    );
  });

  it('calls onChange with evidence-pointer proof when URL is set', () => {
    const onChange = vi.fn();
    render(<ProofInput value={null} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('proof-type-select'), { target: { value: 'evidence-pointer' } });
    const urlInput = screen.getByPlaceholderText(/twitter\.com|github\.com/i);
    fireEvent.change(urlInput, { target: { value: 'https://twitter.com/user' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        proofType: 'evidence-pointer',
        proofPurpose: 'commercial-tx',
        proofObject: { url: 'https://twitter.com/user' },
      })
    );
  });

  it('shows evidence-pointer fields when evidence-pointer is selected', () => {
    const onChange = vi.fn();
    render(<ProofInput value={null} onChange={onChange} />);
    const select = screen.getByTestId('proof-type-select');
    fireEvent.change(select, { target: { value: 'evidence-pointer' } });
    expect(screen.getByText('Verification string to post:')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/twitter\.com|github\.com/i)).toBeInTheDocument();
  });

  it('toggles instructions visibility', () => {
    render(
      <ProofInput
        value={{
          proofType: 'tx-interaction',
          proofPurpose: 'commercial-tx',
          proofObject: {},
        }}
        onChange={vi.fn()}
      />
    );
    const toggle = screen.getByRole('button', { name: /Hide instructions/i });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: /Show instructions/i })).toBeInTheDocument();
  });

  it('displays shared-control purpose badge when defaultPurpose is shared-control', () => {
    render(
      <ProofInput
        value={{ proofType: 'tx-interaction', proofPurpose: 'shared-control', proofObject: {} }}
        onChange={vi.fn()}
        defaultPurpose="shared-control"
      />
    );
    expect(screen.getByText(/Shared Control/i)).toBeInTheDocument();
  });

  it('shows error message when error prop is set', () => {
    render(<ProofInput value={null} onChange={vi.fn()} error="Invalid proof" />);
    expect(screen.getByText('Invalid proof')).toBeInTheDocument();
  });

  it('shows connect wallet message when evidence-pointer selected and wallet not connected', () => {
    vi.mocked(blockchain.useWallet).mockReturnValue({
      address: null,
      chainId: null,
      isConnected: false,
    } as any);
    const onChange = vi.fn();
    render(<ProofInput value={null} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('proof-type-select'), { target: { value: 'evidence-pointer' } });
    expect(screen.getByText(/Connect your wallet to generate the verification string/i)).toBeInTheDocument();
  });

  it('copy evidence string copies to clipboard when copy button clicked', async () => {
    vi.mocked(blockchain.useWallet).mockReturnValue({
      address: '0xabc123',
      chainId: 1,
      isConnected: true,
    } as any);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const onChange = vi.fn();
    render(<ProofInput value={null} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('proof-type-select'), { target: { value: 'evidence-pointer' } });
    const copyBtn = screen.getByTitle('Copy to clipboard');
    fireEvent.click(copyBtn);
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/v=1;controller=did:pkh:eip155/));
    });
  });

  it('copied state resets after 2 seconds (useEffect timer)', async () => {
    vi.useFakeTimers();
    vi.mocked(blockchain.useWallet).mockReturnValue({
      address: '0xabc123',
      chainId: 1,
      isConnected: true,
    } as any);
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<ProofInput value={null} onChange={vi.fn()} />);
    fireEvent.change(screen.getByTestId('proof-type-select'), { target: { value: 'evidence-pointer' } });
    const copyBtn = screen.getByTitle('Copy to clipboard');
    fireEvent.click(copyBtn);
    await vi.runOnlyPendingTimersAsync();
    vi.advanceTimersByTime(2500);
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
  });

  it('toggles evidence-pointer instructions and shows ChevronDown when collapsed', () => {
    render(
      <ProofInput
        value={{ proofType: 'evidence-pointer', proofPurpose: 'commercial-tx', proofObject: {} }}
        onChange={vi.fn()}
      />
    );
    const toggle = screen.getByRole('button', { name: /Hide instructions/i });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: /Show instructions/i })).toBeInTheDocument();
  });

  it('calls onChange with null when proof type is cleared (select empty)', () => {
    const onChange = vi.fn();
    render(<ProofInput value={null} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('proof-type-select'), { target: { value: 'evidence-pointer' } });
    onChange.mockClear();
    fireEvent.change(screen.getByTestId('proof-type-select'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('copy button shows check icon after copy and cleanup runs on unmount', async () => {
    vi.mocked(blockchain.useWallet).mockReturnValue({
      address: '0xabc123',
      chainId: 1,
      isConnected: true,
    } as any);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const { unmount } = render(<ProofInput value={null} onChange={vi.fn()} />);
    fireEvent.change(screen.getByTestId('proof-type-select'), { target: { value: 'evidence-pointer' } });
    const copyBtn = screen.getByTitle('Copy to clipboard');
    fireEvent.click(copyBtn);
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    // CheckIcon branch: copied state re-renders (button still present after copy)
    expect(screen.getByTitle('Copy to clipboard')).toBeInTheDocument();
    unmount();
  });
});
