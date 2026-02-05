import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimestampInput } from '@/components/TimestampInput';

describe('TimestampInput', () => {
  const defaultProps = {
    value: undefined,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    defaultProps.onChange.mockClear();
  });

  it('renders checkbox and uses "Enter custom date" label when hasAutoDefault is false', () => {
    render(<TimestampInput {...defaultProps} />);
    expect(screen.getByLabelText(/Enter custom date/i)).toBeInTheDocument();
  });

  it('renders "Override current time" label when hasAutoDefault is true', () => {
    render(<TimestampInput {...defaultProps} hasAutoDefault />);
    expect(screen.getByLabelText(/Override current time/i)).toBeInTheDocument();
  });

  it('calls onChange with "0" when checkbox is unchecked', async () => {
    const user = userEvent.setup();
    render(<TimestampInput {...defaultProps} value={1234567890} />);
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);
    expect(defaultProps.onChange).toHaveBeenCalledWith('0');
  });

  it('shows datetime input when checkbox is checked', () => {
    render(<TimestampInput {...defaultProps} value={1234567890} />);
    const input = document.querySelector('input[type="datetime-local"]');
    expect(input).toBeInTheDocument();
  });

  it('calls onChange with timestamp when datetime-local value changes', () => {
    render(<TimestampInput {...defaultProps} value="" hasAutoDefault />);
    const picker = document.querySelector('input[type="datetime-local"]');
    expect(picker).toBeInTheDocument();
    fireEvent.change(picker!, { target: { value: '2009-02-14T00:31' } });
    expect(defaultProps.onChange).toHaveBeenCalled();
    const calledWith = defaultProps.onChange.mock.calls[0][0];
    expect(calledWith).toMatch(/^\d+$/);
  });

  it('displays error class when error prop is set', () => {
    render(<TimestampInput {...defaultProps} error="Invalid date" />);
    const picker = document.querySelector('input[type="datetime-local"]');
    const container = screen.getByLabelText(/Enter custom date|Override current time/i).closest('.space-y-2');
    expect(container).toBeInTheDocument();
  });

  it('shows empty datetime-local when value is 0 or empty', () => {
    render(<TimestampInput {...defaultProps} value="0" hasAutoDefault />);
    const picker = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    expect(picker).toBeInTheDocument();
    expect(picker.value).toBe('');
  });

  it('calls onChange with "0" when datetime-local is cleared', () => {
    render(<TimestampInput {...defaultProps} value="1234567890" hasAutoDefault />);
    const picker = document.querySelector('input[type="datetime-local"]');
    expect(picker).toBeInTheDocument();
    fireEvent.change(picker!, { target: { value: '' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith('0');
  });

  it('shows disabled picker when hasAutoDefault and checkbox unchecked', () => {
    render(<TimestampInput {...defaultProps} hasAutoDefault />);
    const picker = document.querySelector('input[type="datetime-local"]');
    expect(picker).toBeInTheDocument();
    expect(picker).toBeDisabled();
    expect(picker?.className).toMatch(/opacity-50|cursor-not-allowed/);
  });

  it('timestampToDatetimeLocal: value as string number shows formatted date', () => {
    render(<TimestampInput {...defaultProps} value="1234567890" />);
    const picker = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    expect(picker).toBeInTheDocument();
    expect(picker.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('timestampToDatetimeLocal: invalid string value shows empty', () => {
    render(<TimestampInput {...defaultProps} value="notanumber" />);
    const picker = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    expect(picker).toBeInTheDocument();
    expect(picker.value).toBe('');
  });
});
