import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose
} from '@/components/ui/dialog'

describe('Dialog component', () => {
  it('renders trigger button', () => {
    render(
      <Dialog>
        <DialogTrigger>Open Dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    expect(screen.getByText('Open Dialog')).toBeInTheDocument()
  })

  it('opens dialog when trigger is clicked', () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>Dialog content here</DialogDescription>
        </DialogContent>
      </Dialog>
    )
    
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('Dialog Title')).toBeInTheDocument()
    expect(screen.getByText('Dialog content here')).toBeInTheDocument()
  })

  it('renders DialogHeader with custom className', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader className="custom-header">
            <DialogTitle>Title</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
    
    const header = screen.getByText('Title').parentElement
    expect(header).toHaveClass('custom-header')
  })

  it('renders DialogFooter with custom className', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogFooter className="custom-footer">
            <button>Action</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
    
    const footer = screen.getByText('Action').parentElement
    expect(footer).toHaveClass('custom-footer')
  })

  it('renders DialogTitle with custom className', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle className="custom-title">Custom Title</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    
    const title = screen.getByText('Custom Title')
    expect(title).toHaveClass('custom-title')
  })

  it('renders DialogDescription with custom className', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription className="custom-desc">Description</DialogDescription>
        </DialogContent>
      </Dialog>
    )
    
    const desc = screen.getByText('Description')
    expect(desc).toHaveClass('custom-desc')
  })

  it('renders close button with sr-only text', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    
    expect(screen.getByText('Close')).toHaveClass('sr-only')
  })

  it('closes dialog when close button is clicked', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <p>Content</p>
        </DialogContent>
      </Dialog>
    )
    
    expect(screen.getByText('Content')).toBeInTheDocument()
    
    // Find and click the close button (the X icon button)
    const closeButton = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeButton)
    
    // Content should no longer be visible
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('renders DialogContent with custom className', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent className="custom-content">
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    
    const content = screen.getByRole('dialog')
    expect(content).toHaveClass('custom-content')
  })
})
