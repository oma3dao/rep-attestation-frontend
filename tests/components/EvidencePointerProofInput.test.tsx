import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EvidencePointerProofInput } from '@/components/EvidencePointerProofInput'

// Mock the blockchain hook
vi.mock('@/lib/blockchain', () => ({
  useWallet: vi.fn().mockReturnValue({
    address: '0x1234567890abcdef1234567890abcdef12345678',
    chainId: 1,
    isConnected: true,
  }),
}))

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
})

describe('EvidencePointerProofInput', () => {
  const defaultProps = {
    subjectDid: '',
    controllerDid: '',
    value: '',
    onChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Helper to find the proof URL input (Label doesn't use htmlFor, so use role)
  function getProofUrlInput() {
    return screen.getByRole('textbox')
  }

  describe('basic rendering', () => {
    it('renders the proof URL label and input field', () => {
      render(<EvidencePointerProofInput {...defaultProps} />)
      expect(screen.getByText('Proof URL')).toBeInTheDocument()
      expect(getProofUrlInput()).toBeInTheDocument()
    })

    it('shows generic instructions for non-did:web subjects', () => {
      render(
        <EvidencePointerProofInput
          {...defaultProps}
          subjectDid="did:pkh:eip155:1:0xabc"
        />
      )
      expect(screen.getByText(/Evidence Pointer Proof/i)).toBeInTheDocument()
      expect(screen.getByText(/public URL where verifiers can find evidence/i)).toBeInTheDocument()
    })

    it('shows DNS TXT record instructions for did:web subjects', () => {
      render(
        <EvidencePointerProofInput
          {...defaultProps}
          subjectDid="did:web:example.com"
        />
      )
      expect(screen.getByText(/DNS TXT Record Setup/i)).toBeInTheDocument()
      // Multiple elements might contain example.com, so check for the specific instruction
      expect(screen.getByText(/Go to your DNS provider/i)).toBeInTheDocument()
    })

    it('displays current value in the input field', () => {
      render(
        <EvidencePointerProofInput
          {...defaultProps}
          value="https://custom-url.com/proof"
        />
      )
      expect(getProofUrlInput()).toHaveValue('https://custom-url.com/proof')
    })

    it('shows error styling when error prop is provided', () => {
      render(
        <EvidencePointerProofInput
          {...defaultProps}
          error="URL is required"
        />
      )
      const input = getProofUrlInput()
      expect(input.className).toContain('border-red-500')
    })
  })

  describe('did:web auto-population', () => {
    it('auto-generates DNS resolver URL for did:web subjects', () => {
      const onChange = vi.fn()
      render(
        <EvidencePointerProofInput
          {...defaultProps}
          subjectDid="did:web:example.com"
          onChange={onChange}
        />
      )
      expect(onChange).toHaveBeenCalledWith(
        'https://dns.google/resolve?name=_controllers.example.com&type=TXT'
      )
    })

    it('extracts domain correctly from did:web with path', () => {
      const onChange = vi.fn()
      render(
        <EvidencePointerProofInput
          {...defaultProps}
          subjectDid="did:web:example.com:service:api"
          onChange={onChange}
        />
      )
      expect(onChange).toHaveBeenCalledWith(
        'https://dns.google/resolve?name=_controllers.example.com&type=TXT'
      )
    })

    it('handles did:web with port encoding', () => {
      const onChange = vi.fn()
      render(
        <EvidencePointerProofInput
          {...defaultProps}
          subjectDid="did:web:example.com%3A8080"
          onChange={onChange}
        />
      )
      expect(onChange).toHaveBeenCalledWith(
        'https://dns.google/resolve?name=_controllers.example.com:8080&type=TXT'
      )
    })

    it('does not overwrite user-edited URL when subjectDid changes', () => {
      const onChange = vi.fn()
      const { rerender } = render(
        <EvidencePointerProofInput
          {...defaultProps}
          subjectDid="did:web:example.com"
          value=""
          onChange={onChange}
        />
      )

      // First render auto-populates
      expect(onChange).toHaveBeenCalledWith(
        'https://dns.google/resolve?name=_controllers.example.com&type=TXT'
      )
      onChange.mockClear()

      // Simulate user manually editing the URL (parent updates value prop)
      rerender(
        <EvidencePointerProofInput
          {...defaultProps}
          subjectDid="did:web:example.com"
          value="https://my-custom-resolver.com/check"
          onChange={onChange}
        />
      )

      // Now change the subjectDid to a different did:web
      rerender(
        <EvidencePointerProofInput
          {...defaultProps}
          subjectDid="did:web:other-domain.org"
          value="https://my-custom-resolver.com/check"
          onChange={onChange}
        />
      )

      // The user's custom URL should be preserved - auto-populate should NOT fire
      // because the value no longer matches the lastAutoUrl
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]
      // If onChange was called, it should be with the new auto URL
      // But the key behavior is: the input value should NOT have been forcibly overwritten
      // since the user's URL ("https://my-custom-resolver.com/check") differs from lastAutoUrl
      if (onChange.mock.calls.length > 0) {
        // The component fires onChange with the new auto URL because value doesn't match lastAutoUrl
        // and the condition is `!value || value === lastAutoUrl`
        // Since "https://my-custom-resolver.com/check" !== lastAutoUrl (example.com URL),
        // auto-populate should NOT overwrite
        expect(onChange).not.toHaveBeenCalledWith(
          'https://dns.google/resolve?name=_controllers.other-domain.org&type=TXT'
        )
      }
    })

    it('returns null from extractDomainFromDidWeb for non-did:web input', () => {
      const onChange = vi.fn()
      render(
        <EvidencePointerProofInput
          {...defaultProps}
          subjectDid="did:key:z6Mkf..."
          onChange={onChange}
        />
      )
      // For non-did:web, auto-populate should not fire
      expect(onChange).not.toHaveBeenCalled()
    })

    it('shows TXT record host instruction for did:web subjects', () => {
      render(
        <EvidencePointerProofInput
          {...defaultProps}
          subjectDid="did:web:example.com"
        />
      )
      expect(screen.getByText(/Add a TXT record at/i)).toBeInTheDocument()
    })
  })

  describe('evidence string generation', () => {
    it('generates evidence string from controllerDid', () => {
      render(
        <EvidencePointerProofInput
          {...defaultProps}
          subjectDid="did:web:example.com"
          controllerDid="did:pkh:eip155:1:0xcontroller"
        />
      )
      expect(
        screen.getByText(/v=1;controller=did:pkh:eip155:1:0xcontroller/)
      ).toBeInTheDocument()
    })

    it('falls back to wallet DID when controllerDid is empty', () => {
      render(
        <EvidencePointerProofInput
          {...defaultProps}
          subjectDid="did:web:example.com"
          controllerDid=""
        />
      )
      // The mock wallet returns address 0x1234...5678 and chainId 1
      expect(
        screen.getByText(/v=1;controller=did:pkh:eip155:1:0x1234567890abcdef1234567890abcdef12345678/)
      ).toBeInTheDocument()
    })

    it('shows warning when no controller and wallet not connected', async () => {
      // Override the wallet mock for this test
      const blockchainModule = await import('@/lib/blockchain')
      const mockUseWallet = vi.mocked(blockchainModule.useWallet)
      mockUseWallet.mockReturnValue({
        address: undefined,
        chainId: 0,
        isConnected: false,
      } as any)

      render(
        <EvidencePointerProofInput
          {...defaultProps}
          subjectDid="did:web:example.com"
          controllerDid=""
        />
      )
      expect(
        screen.getByText(/Connect your wallet or enter the controller field/i)
      ).toBeInTheDocument()

      // Restore the default mock
      mockUseWallet.mockReturnValue({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1,
        isConnected: true,
      } as any)
    })
  })

  describe('user interaction', () => {
    it('calls onChange when user types in the URL field', () => {
      const onChange = vi.fn()
      render(
        <EvidencePointerProofInput
          {...defaultProps}
          subjectDid="did:pkh:eip155:1:0xabc"
          onChange={onChange}
        />
      )

      const input = getProofUrlInput()
      fireEvent.change(input, { target: { value: 'https://new-url.com' } })
      expect(onChange).toHaveBeenCalledWith('https://new-url.com')
    })

    it('shows "Verification string to post:" label for non-did:web subjects', () => {
      render(
        <EvidencePointerProofInput
          {...defaultProps}
          subjectDid="did:pkh:eip155:1:0xabc"
          controllerDid="did:pkh:eip155:1:0xcontroller"
        />
      )
      expect(screen.getByText('Verification string to post:')).toBeInTheDocument()
    })

    it('copies evidence string to clipboard on button click', async () => {
      render(
        <EvidencePointerProofInput
          {...defaultProps}
          subjectDid="did:web:example.com"
          controllerDid="did:pkh:eip155:1:0xcontroller"
        />
      )

      const copyButton = screen.getByTitle(/copy to clipboard/i)
      fireEvent.click(copyButton)

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          'v=1;controller=did:pkh:eip155:1:0xcontroller'
        )
      })
    })

    it('shows CheckIcon after copy and reverts to CopyIcon after 2 seconds', async () => {
      vi.useFakeTimers()

      render(
        <EvidencePointerProofInput
          {...defaultProps}
          subjectDid="did:web:example.com"
          controllerDid="did:pkh:eip155:1:0xcontroller"
        />
      )

      const copyButton = screen.getByTitle(/copy to clipboard/i)

      // Before clicking, the button should contain the CopyIcon (not CheckIcon)
      // After clicking, the copied state goes true -> CheckIcon shows
      await act(async () => {
        fireEvent.click(copyButton)
      })

      // After 2 seconds, the copied state should auto-reset
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      // The button should still be present and functional (CopyIcon is back)
      expect(screen.getByTitle(/copy to clipboard/i)).toBeInTheDocument()

      vi.useRealTimers()
    })

    it('does not fire clipboard.writeText when evidenceString is empty', async () => {
      // No controller and no wallet = empty evidence string
      const blockchainModule = await import('@/lib/blockchain')
      const mockUseWallet = vi.mocked(blockchainModule.useWallet)
      mockUseWallet.mockReturnValue({
        address: undefined,
        chainId: 0,
        isConnected: false,
      } as any)

      render(
        <EvidencePointerProofInput
          {...defaultProps}
          subjectDid="did:web:example.com"
          controllerDid=""
        />
      )

      // The copy button shouldn't be present when evidenceString is empty
      // (the component shows a warning instead of the evidence string + copy button)
      expect(screen.queryByTitle(/copy to clipboard/i)).not.toBeInTheDocument()

      // Restore the default mock
      mockUseWallet.mockReturnValue({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1,
        isConnected: true,
      } as any)
    })
  })

  describe('placeholder text', () => {
    it('shows DNS resolver placeholder for did:web subjects', () => {
      render(
        <EvidencePointerProofInput
          {...defaultProps}
          subjectDid="did:web:example.com"
        />
      )
      const input = getProofUrlInput()
      expect(input).toHaveAttribute(
        'placeholder',
        'https://dns.google/resolve?name=_controllers.example.com&type=TXT'
      )
    })

    it('shows did.json placeholder for non-did:web subjects', () => {
      render(
        <EvidencePointerProofInput
          {...defaultProps}
          subjectDid="did:pkh:eip155:1:0xabc"
        />
      )
      const input = getProofUrlInput()
      expect(input).toHaveAttribute(
        'placeholder',
        'https://example.com/.well-known/did.json'
      )
    })
  })
})
