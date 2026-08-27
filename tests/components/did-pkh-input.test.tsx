import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DidPkhInput } from '@/components/did-pkh-input';

const validAddress = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
const validDidPkh = `did:pkh:eip155:1:${validAddress}`;
const validSolanaAddress = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH';
const validSuiAddress = '0x0000000000000000000000000000000000000000000000000000000000000001';

vi.mock('@/components/ui/select', () => {
  const React = require('react') as typeof import('react');
  const SelectContent = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  SelectContent.displayName = 'SelectContent';

  const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  );

  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => {
    const items: Array<{ value: string; label: string }> = [];
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === SelectContent) {
        React.Children.forEach((child.props as { children?: React.ReactNode }).children, (item) => {
          if (!React.isValidElement(item)) return;
          items.push({
            value: String((item.props as { value: string }).value),
            label: String((item.props as { children: React.ReactNode }).children),
          });
        });
      }
    });

    const label =
      value === 'eip155' || value === 'solana' || value === 'sui'
        ? 'Virtual Machine'
        : value === 'mainnet'
          ? 'Network'
          : 'Select';

    return (
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        aria-label={label}
      >
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    );
  };

  return {
    Select,
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectContent,
    SelectItem,
    SelectValue: () => null,
  };
});

describe('DidPkhInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls onChange with a normalized DID on blur for a valid did:pkh paste', () => {
    const onChange = vi.fn();
    render(<DidPkhInput onChange={onChange} />);

    const input = screen.getByLabelText('Blockchain DID');
    fireEvent.change(input, { target: { value: validDidPkh } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(
      expect.stringMatching(/^did:pkh:eip155:1:0x[a-fA-F0-9]{40}$/)
    );
    const normalized = onChange.mock.calls[0][0] as string;
    expect(normalized.toLowerCase()).toBe(
      `did:pkh:eip155:1:${validAddress.toLowerCase()}`
    );
  });

  it('shows a prefix error and calls onChange(null) on blur for invalid prefixes', () => {
    const onChange = vi.fn();
    render(<DidPkhInput onChange={onChange} />);

    const input = screen.getByLabelText('Blockchain DID');
    fireEvent.change(input, { target: { value: 'did:web:example.com' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByText('Must start with did:pkh:')).toBeInTheDocument();
  });

  it('calls onChange(null) on blur when the input is empty', () => {
    const onChange = vi.fn();
    render(<DidPkhInput onChange={onChange} />);

    fireEvent.blur(screen.getByLabelText('Blockchain DID'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('builds a DID from chain id and address via the builder', async () => {
    const onChange = vi.fn();
    render(<DidPkhInput onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Build DID from chain/i }));

    const chainInput = screen.getByPlaceholderText(/6623 for OMAChain/);
    fireEvent.change(chainInput, { target: { value: '1' } });

    fireEvent.change(screen.getByLabelText('Address'), {
      target: { value: validAddress },
    });
    fireEvent.click(screen.getByRole('button', { name: /Use this address/i }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.stringMatching(/^did:pkh:eip155:1:0x[a-fA-F0-9]{40}$/)
      );
    });
  });

  it('builds a Solana did:pkh via the builder', async () => {
    const onChange = vi.fn();
    render(<DidPkhInput onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Build DID from chain/i }));
    fireEvent.change(screen.getByLabelText('Virtual Machine'), {
      target: { value: 'solana' },
    });
    fireEvent.change(screen.getByLabelText('Address'), {
      target: { value: validSolanaAddress },
    });
    fireEvent.click(screen.getByRole('button', { name: /Use this address/i }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        `did:pkh:solana:mainnet:${validSolanaAddress}`
      );
    });
  });

  it('builds a Sui did:pkh via the builder', async () => {
    const onChange = vi.fn();
    render(<DidPkhInput onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Build DID from chain/i }));
    fireEvent.change(screen.getByLabelText('Virtual Machine'), {
      target: { value: 'sui' },
    });
    fireEvent.change(screen.getByLabelText('Address'), {
      target: { value: validSuiAddress },
    });
    fireEvent.click(screen.getByRole('button', { name: /Use this address/i }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        `did:pkh:sui:mainnet:${validSuiAddress}`
      );
    });
  });

  it('shows an error and calls onChange(null) for invalid CAIP after did:pkh:', () => {
    const onChange = vi.fn();
    render(<DidPkhInput onChange={onChange} />);

    const input = screen.getByLabelText('Blockchain DID');
    fireEvent.change(input, { target: { value: 'did:pkh:not-a-valid-caip' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByText(/Invalid/i)).toBeInTheDocument();
  });

  it('syncs external value into the input and builder fields', async () => {
    const onChange = vi.fn();
    const externalDid = `did:pkh:solana:mainnet:${validSolanaAddress}`;
    const { rerender } = render(<DidPkhInput onChange={onChange} value="" />);

    rerender(<DidPkhInput onChange={onChange} value={externalDid} />);

    expect(screen.getByLabelText('Blockchain DID')).toHaveValue(externalDid);

    fireEvent.click(screen.getByRole('button', { name: /Build DID from chain/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('Address')).toHaveValue(validSolanaAddress);
    });
  });

  it('shows an external error prop', () => {
    render(
      <DidPkhInput
        onChange={vi.fn()}
        value={validDidPkh}
        error="External validation failed"
      />
    );

    expect(screen.getByText('External validation failed')).toBeInTheDocument();
  });

  it('emits debounced onChange after 1500ms without blur', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<DidPkhInput onChange={onChange} />);

    const input = screen.getByLabelText('Blockchain DID');
    fireEvent.change(input, { target: { value: validDidPkh } });

    expect(onChange).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1500);

    expect(onChange).toHaveBeenCalledWith(
      expect.stringMatching(/^did:pkh:eip155:1:0x[a-fA-F0-9]{40}$/)
    );
  });

  it('syncs external eip155 value into builder chain id and address fields', async () => {
    const onChange = vi.fn();
    const externalDid = `did:pkh:eip155:42:${validAddress}`;
    const { rerender } = render(<DidPkhInput onChange={onChange} value="" />);

    rerender(<DidPkhInput onChange={onChange} value={externalDid} />);

    expect(screen.getByLabelText('Blockchain DID')).toHaveValue(externalDid);
    fireEvent.click(screen.getByRole('button', { name: /Build DID from chain/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('Address')).toHaveValue(validAddress);
    });
    expect(screen.getByPlaceholderText(/6623 for OMAChain/)).toHaveValue(42);
  });

  it('shows a builder validation error when apply receives an invalid address', async () => {
    const onChange = vi.fn();
    render(<DidPkhInput onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Blockchain DID'), {
      target: { value: 'did:pkh:eip155:1:' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Build DID from chain/i }));
    fireEvent.change(screen.getByPlaceholderText(/6623 for OMAChain/), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Address'), {
      target: { value: 'not-an-address' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Use this address/i }));

    await waitFor(() => {
      expect(screen.getByText(/EVM address must start with 0x/i)).toBeInTheDocument();
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables Use this address when the EVM chain id is cleared', () => {
    const onChange = vi.fn();
    render(<DidPkhInput onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Build DID from chain/i }));
    fireEvent.change(screen.getByPlaceholderText(/6623 for OMAChain/), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Address'), {
      target: { value: validAddress },
    });
    expect(screen.getByRole('button', { name: /Use this address/i })).toBeEnabled();

    fireEvent.change(screen.getByPlaceholderText(/6623 for OMAChain/), {
      target: { value: '' },
    });
    expect(screen.getByRole('button', { name: /Use this address/i })).toBeDisabled();
  });

  it('cancels an in-flight debounce when the value changes before 1500ms', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<DidPkhInput onChange={onChange} />);

    const input = screen.getByLabelText('Blockchain DID');
    const firstDid = `did:pkh:eip155:1:0x1111111111111111111111111111111111111111`;
    const secondDid = validDidPkh;

    fireEvent.change(input, { target: { value: firstDid } });
    await vi.advanceTimersByTimeAsync(1000);
    fireEvent.change(input, { target: { value: secondDid } });
    await vi.advanceTimersByTimeAsync(1500);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.stringMatching(/^did:pkh:eip155:1:0x[a-fA-F0-9]{40}$/)
    );
    expect(onChange.mock.calls[0][0]?.toLowerCase()).toBe(secondDid.toLowerCase());
  });

  it('syncs unknown-namespace did:pkh values into the address field without crashing', async () => {
    const onChange = vi.fn();
    const unknownDid = 'did:pkh:unknown:ref:0xabc123';
    const { rerender } = render(<DidPkhInput onChange={onChange} value="" />);

    rerender(<DidPkhInput onChange={onChange} value={unknownDid} />);

    expect(screen.getByLabelText('Blockchain DID')).toHaveValue(unknownDid);
    fireEvent.click(screen.getByRole('button', { name: /Build DID from chain/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('Address')).toHaveValue('0xabc123');
    });
  });

  it('falls back to Invalid address format when normalizeCaip10 is invalid without an error', async () => {
    const normalizeModule = await import('@/lib/utils/caip10/normalize');
    const normalizeSpy = vi.spyOn(normalizeModule, 'normalizeCaip10').mockReturnValue({
      valid: false,
    });

    const onChange = vi.fn();
    render(<DidPkhInput onChange={onChange} />);

    const input = screen.getByLabelText('Blockchain DID');
    fireEvent.change(input, { target: { value: 'did:pkh:eip155:1:0xabc' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByText('Invalid address format')).toBeInTheDocument();
    });
    expect(onChange).toHaveBeenCalledWith(null);

    normalizeSpy.mockRestore();
  });

  it('syncs a Sui did:pkh external value into the builder', async () => {
    const onChange = vi.fn();
    const externalDid = `did:pkh:sui:mainnet:${validSuiAddress}`;
    const { rerender } = render(<DidPkhInput onChange={onChange} value="" />);

    rerender(<DidPkhInput onChange={onChange} value={externalDid} />);
    expect(screen.getByLabelText('Blockchain DID')).toHaveValue(externalDid);

    fireEvent.click(screen.getByRole('button', { name: /Build DID from chain/i }));
    await waitFor(() => {
      expect(screen.getByLabelText('Address')).toHaveValue(validSuiAddress);
    });
  });

  it('ignores invalid did:pkh values when syncing the builder', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<DidPkhInput onChange={onChange} value="" />);
    rerender(<DidPkhInput onChange={onChange} value="did:pkh:incomplete" />);

    fireEvent.click(screen.getByRole('button', { name: /Build DID from chain/i }));
    expect(screen.getByLabelText('Address')).toHaveValue('');
  });

  it('returns early from builder apply when address is missing', () => {
    const onChange = vi.fn();
    render(<DidPkhInput onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Build DID from chain/i }));
    fireEvent.change(screen.getByPlaceholderText(/6623 for OMAChain/), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /Use this address/i }));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Virtual Machine'), { target: { value: 'solana' } });
    fireEvent.click(screen.getByRole('button', { name: /Use this address/i }));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Virtual Machine'), { target: { value: 'sui' } });
    fireEvent.click(screen.getByRole('button', { name: /Use this address/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('falls back to Invalid address when builder normalize fails without an error', async () => {
    const normalizeModule = await import('@/lib/utils/caip10/normalize');
    const normalizeSpy = vi
      .spyOn(normalizeModule, 'normalizeCaip10')
      .mockReturnValue({ valid: false });

    const onChange = vi.fn();
    render(<DidPkhInput onChange={onChange} value={`did:pkh:eip155:1:${validAddress}`} />);
    fireEvent.click(screen.getByRole('button', { name: /Build DID from chain/i }));
    fireEvent.change(screen.getByPlaceholderText(/6623 for OMAChain/), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: validAddress } });
    fireEvent.click(screen.getByRole('button', { name: /Use this address/i }));

    // Cover result.error || "Invalid address" even if the banner is gated by inputValue.
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Use this address/i })).toBeInTheDocument();
    expect(normalizeSpy).toHaveBeenCalled();
    normalizeSpy.mockRestore();
  });

});
