import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RevokeConfirmationDialog } from '@/components/revoke-confirmation-dialog'

describe('RevokeConfirmationDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    attestationUid: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    isRevoking: false,
  }

  it('renders dialog content when open', () => {
    render(<RevokeConfirmationDialog {...defaultProps} />)
    expect(screen.getByText('Revoke Attestation')).toBeInTheDocument()
    expect(screen.getByText(/this will permanently revoke attestation/i)).toBeInTheDocument()
    expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument()
  })

  it('does not render dialog content when closed', () => {
    render(<RevokeConfirmationDialog {...defaultProps} isOpen={false} />)
    expect(screen.queryByText('Revoke Attestation')).not.toBeInTheDocument()
  })

  it('displays truncated UID for long UIDs', () => {
    render(<RevokeConfirmationDialog {...defaultProps} />)
    // UID is 66 chars, should be truncated to first 10 + ... + last 6
    expect(screen.getByText('0xaaaaaaaa...aaaaaa')).toBeInTheDocument()
  })

  it('displays short UID as-is without truncation', () => {
    render(<RevokeConfirmationDialog {...defaultProps} attestationUid="0x1234" />)
    expect(screen.getByText('0x1234')).toBeInTheDocument()
  })

  it('calls onConfirm when Revoke button is clicked', () => {
    const onConfirm = vi.fn()
    render(<RevokeConfirmationDialog {...defaultProps} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn()
    render(<RevokeConfirmationDialog {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows "Revoking..." text and disables buttons while revoking', () => {
    render(<RevokeConfirmationDialog {...defaultProps} isRevoking={true} />)
    expect(screen.getByRole('button', { name: 'Revoking...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('shows "Revoke" text when not revoking', () => {
    render(<RevokeConfirmationDialog {...defaultProps} isRevoking={false} />)
    expect(screen.getByRole('button', { name: 'Revoke' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled()
  })
})
