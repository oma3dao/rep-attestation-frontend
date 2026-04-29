import { render, screen, fireEvent, act, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import { useToast } from '@/components/ui/toast';
import React from 'react';
import { vi } from 'vitest';

function ToastTestComponent() {
  const { showToast, ToastContainer, dismissToast } = useToast();
  return (
    <div>
      <button onClick={() => showToast('Info message', 'info')}>Show Info</button>
      <button onClick={() => showToast('Error message', 'error')}>Show Error</button>
      <button onClick={() => showToast('Success message', 'success')}>Show Success</button>
      <button onClick={() => showToast('Auto-dismiss', 'info', 500)}>Show Auto-dismiss</button>
      <button onClick={() => dismissToast('1')}>Dismiss 1</button>
      <ToastContainer />
    </div>
  );
}

describe('toast (useToast)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
  });

  it('shows info toast', () => {
    render(<ToastTestComponent />);
    fireEvent.click(screen.getByText('Show Info'));
    expect(screen.getByText('Info message')).toBeInTheDocument();
  });

  it('shows error toast', () => {
    render(<ToastTestComponent />);
    fireEvent.click(screen.getByText('Show Error'));
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('shows success toast', () => {
    render(<ToastTestComponent />);
    fireEvent.click(screen.getByText('Show Success'));
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('auto-dismisses toast after timeout', async () => {
    render(<ToastTestComponent />);
    fireEvent.click(screen.getByText('Show Auto-dismiss'));
    expect(screen.getByText('Auto-dismiss')).toBeInTheDocument();

    // Advance past the toast duration (500ms)
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // The Toast component has a 300ms fade-out animation delay before calling onClose
    // which removes the toast from the DOM
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByText('Auto-dismiss')).not.toBeInTheDocument();
  }, 10000);

  it('can dismiss toast manually', async () => {
    vi.useFakeTimers();
    render(<ToastTestComponent />);
    fireEvent.click(screen.getByText('Show Info'));
    const toast = screen.getByText('Info message');
    expect(toast).toBeInTheDocument();
    const closeBtn = screen.getByRole('button', { name: /×/ });
    fireEvent.click(closeBtn);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByText('Info message')).not.toBeInTheDocument();
  }, 10000);

  it('shows multiple toasts', () => {
    render(<ToastTestComponent />);
    fireEvent.click(screen.getByText('Show Info'));
    fireEvent.click(screen.getByText('Show Error'));
    expect(screen.getByText('Info message')).toBeInTheDocument();
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('dismissToast removes toast when called with toast id', () => {
    let lastToastId: string;
    function DismissByIdComponent() {
      const { showToast, ToastContainer, dismissToast } = useToast();
      return (
        <div>
          <button onClick={() => { lastToastId = showToast('To dismiss', 'info'); }}>Show</button>
          <button onClick={() => dismissToast(lastToastId!)}>Dismiss by id</button>
          <ToastContainer />
        </div>
      );
    }
    render(<DismissByIdComponent />);
    fireEvent.click(screen.getByText('Show'));
    expect(screen.getByText('To dismiss')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Dismiss by id'));
    act(() => { vi.advanceTimersByTime(0); });
    expect(screen.queryByText('To dismiss')).not.toBeInTheDocument();
  });
});

function ToastContainerCenterTest() {
  const { showToast, ToastContainer } = useToast();
  return (
    <div>
      <button onClick={() => showToast('Center toast', 'info')}>Show</button>
      <ToastContainer position="center" />
    </div>
  );
}

describe('ToastContainer position', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    act(() => { vi.runOnlyPendingTimers(); });
    vi.useRealTimers();
  });

  it('renders with center position class when position is center', () => {
    render(<ToastContainerCenterTest />);
    fireEvent.click(screen.getByText('Show'));
    const container = document.querySelector('.fixed.left-1\\/2.top-24');
    expect(container || document.querySelector('[class*="translate-x"]')).toBeTruthy();
  });
}); 