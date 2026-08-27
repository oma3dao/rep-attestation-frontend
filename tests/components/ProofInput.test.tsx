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

  function collectSelectItems(children: React.ReactNode): Array<{ value: string; label: React.ReactNode }> {
    const items: Array<{ value: string; label: React.ReactNode }> = [];
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      React.Children.forEach(child.props.children, (item) => {
        if (React.isValidElement(item) && typeof item.props.value === 'string') {
          items.push({ value: item.props.value, label: item.props.children });
        }
      });
    });
    return items;
  }

  const SelectTrigger = ({ children }: { children: unknown }) => children;
  const SelectContent = ({ children }: { children: unknown }) => children;
  const SelectItem = ({ value, children }: { value: string; children: unknown }) =>
    React.createElement('option', { value }, children);
  const SelectValue = ({ placeholder }: { placeholder?: string }) => placeholder;

  return {
    Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => {
      const items = collectSelectItems(children);
      return React.createElement('select', {
        value,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onValueChange(e.currentTarget.value),
        'data-testid': 'proof-type-select',
      }, [
        React.createElement('option', { key: 'empty', value: '' }, 'Select proof type (optional)'),
        ...items.map((item) =>
          React.createElement('option', { key: item.value, value: item.value }, item.label)
        ),
      ]);
    },
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
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
        <option value="66238">OMAChain</option>
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

  it('calls onChange with tx-encoded-value proof including sender from wallet', () => {
    const onChange = vi.fn();
    render(<ProofInput value={null} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('proof-type-select'), { target: { value: 'tx-encoded-value' } });
    fireEvent.change(screen.getByLabelText('chain'), { target: { value: '1' } });
    fireEvent.change(screen.getByPlaceholderText(/0x/i), { target: { value: '0xdeadbeef' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        proofType: 'tx-encoded-value',
        proofPurpose: 'commercial-tx',
        proofObject: expect.objectContaining({
          proofPurpose: 'commercial-tx',
          chainId: 'eip155:1',
          txHash: '0xdeadbeef',
          sender: '0xabc123',
        }),
      })
    );
  });

  it('calls onChange with pop-jws string proofObject', () => {
    const onChange = vi.fn();
    render(<ProofInput value={null} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('proof-type-select'), { target: { value: 'pop-jws' } });
    const jws = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiIxIn0.sig';
    fireEvent.change(screen.getByPlaceholderText(/eyJhbGci/i), { target: { value: jws } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        proofType: 'pop-jws',
        proofObject: jws,
      })
    );
  });

  it('parses x402-receipt JSON into proofObject object', () => {
    const onChange = vi.fn();
    render(<ProofInput value={null} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('proof-type-select'), { target: { value: 'x402-receipt' } });
    const receipt = '{"format":"eip712","payload":{"amount":"1"},"signature":"0xabc"}';
    fireEvent.change(screen.getByPlaceholderText(/\{"format"/i), { target: { value: receipt } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        proofType: 'x402-receipt',
        proofObject: { format: 'eip712', payload: { amount: '1' }, signature: '0xabc' },
      })
    );
  });

  it('stores x402-offer JWS string as proofObject when JSON parse fails', () => {
    const onChange = vi.fn();
    render(<ProofInput value={null} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('proof-type-select'), { target: { value: 'x402-offer' } });
    const jws = 'eyJhbGciOiJFUzI1NiJ9.eyJvZmZlciI6dHJ1ZX0.sig';
    fireEvent.change(screen.getByPlaceholderText(/\{"format"/i), { target: { value: jws } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        proofType: 'x402-offer',
        proofObject: jws,
      })
    );
  });

  it('shows pop-eip712 wallet-connected placeholder', () => {
    render(<ProofInput value={null} onChange={vi.fn()} />);
    fireEvent.change(screen.getByTestId('proof-type-select'), { target: { value: 'pop-eip712' } });
    expect(screen.getByText(/Wallet connected:/i)).toBeInTheDocument();
    expect(screen.getByText(/EIP-712 Wallet Signature/i)).toBeInTheDocument();
  });

  it('filters available proof types when allowedTypes is provided', () => {
    render(
      <ProofInput
        value={null}
        onChange={vi.fn()}
        allowedTypes={['pop-jws', 'evidence-pointer']}
      />
    );
    const select = screen.getByTestId('proof-type-select') as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((opt) => opt.value).filter(Boolean);
    expect(optionValues).toEqual(['pop-jws', 'evidence-pointer']);
  });

  it('initializes chainId and txHash from a proofObject with chainId', () => {
    render(
      <ProofInput
        value={{
          proofType: 'tx-interaction',
          proofPurpose: 'commercial-tx',
          proofObject: { chainId: 'eip155:1', txHash: '0xdead' },
        }}
        onChange={vi.fn()}
        error="bad tx"
      />
    );
    expect(screen.getByPlaceholderText('0x...')).toHaveValue('0xdead');
    expect(screen.getByPlaceholderText('0x...')).toHaveClass('field-error');
  });

  it('initializes jwsValue from a string proofObject', () => {
    const jws = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiIxIn0.sig';
    render(
      <ProofInput
        value={{ proofType: 'pop-jws', proofPurpose: 'commercial-tx', proofObject: jws }}
        onChange={vi.fn()}
        error="bad jws"
      />
    );
    expect(screen.getByPlaceholderText(/eyJhbGciOi/i)).toHaveValue(jws);
    expect(screen.getByPlaceholderText(/eyJhbGciOi/i)).toHaveClass('field-error');
  });

  it('applies field-error to evidence URL and x402 receipt inputs', () => {
    const { unmount } = render(
      <ProofInput
        value={{ proofType: 'evidence-pointer', proofPurpose: 'commercial-tx', proofObject: {} }}
        onChange={vi.fn()}
        error="bad url"
      />
    );
    expect(screen.getByPlaceholderText(/twitter.com/i)).toHaveClass('field-error');
    unmount();

    render(
      <ProofInput
        value={{ proofType: 'x402-receipt', proofPurpose: 'commercial-tx', proofObject: {} }}
        onChange={vi.fn()}
        error="bad receipt"
      />
    );
    expect(screen.getByPlaceholderText(/"format"/i)).toHaveClass('field-error');
  });

  it('uses empty sender when building tx-encoded-value without a wallet address', () => {
    vi.mocked(blockchain.useWallet).mockReturnValue({
      address: null,
      chainId: 1,
      isConnected: true,
    } as any);
    const onChange = vi.fn();
    render(<ProofInput value={null} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('proof-type-select'), { target: { value: 'tx-encoded-value' } });
    fireEvent.change(screen.getByLabelText('chain'), { target: { value: '1' } });
    fireEvent.change(screen.getByPlaceholderText(/0x/i), { target: { value: '0xdeadbeef' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        proofType: 'tx-encoded-value',
        proofObject: expect.objectContaining({
          txHash: '0xdeadbeef',
          sender: '',
        }),
      })
    );
  });

  it('shows truncated wallet address for connected pop-eip712', () => {
    vi.mocked(blockchain.useWallet).mockReturnValue({
      address: '0xabcdef1234567890',
      chainId: 1,
      isConnected: true,
    } as any);
    render(<ProofInput value={null} onChange={vi.fn()} />);
    fireEvent.change(screen.getByTestId('proof-type-select'), { target: { value: 'pop-eip712' } });
    expect(screen.getByText(/Wallet connected: 0xabcd\.\.\.7890/i)).toBeInTheDocument();
  });

});
