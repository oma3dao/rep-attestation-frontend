import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

describe('Popover component', () => {
  it('renders trigger element', () => {
    render(
      <Popover>
        <PopoverTrigger>Open Popover</PopoverTrigger>
        <PopoverContent>Popover content</PopoverContent>
      </Popover>
    )
    expect(screen.getByText('Open Popover')).toBeInTheDocument()
  })

  it('shows content when trigger is clicked', () => {
    render(
      <Popover>
        <PopoverTrigger>Click me</PopoverTrigger>
        <PopoverContent>Hello from popover</PopoverContent>
      </Popover>
    )
    
    fireEvent.click(screen.getByText('Click me'))
    expect(screen.getByText('Hello from popover')).toBeInTheDocument()
  })

  it('applies custom className to content', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Trigger</PopoverTrigger>
        <PopoverContent className="custom-popover">Content</PopoverContent>
      </Popover>
    )
    
    const content = screen.getByText('Content')
    expect(content).toHaveClass('custom-popover')
  })

  it('applies default styling classes', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Trigger</PopoverTrigger>
        <PopoverContent>Styled content</PopoverContent>
      </Popover>
    )
    
    const content = screen.getByText('Styled content')
    expect(content).toHaveClass('rounded-md')
    expect(content).toHaveClass('border')
  })

  it('renders children elements', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Trigger</PopoverTrigger>
        <PopoverContent>
          <div data-testid="child-element">Child</div>
        </PopoverContent>
      </Popover>
    )
    
    expect(screen.getByTestId('child-element')).toBeInTheDocument()
  })

  it('supports different align values', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Trigger</PopoverTrigger>
        <PopoverContent align="start">Aligned content</PopoverContent>
      </Popover>
    )
    
    expect(screen.getByText('Aligned content')).toBeInTheDocument()
  })

  it('supports custom sideOffset', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Trigger</PopoverTrigger>
        <PopoverContent sideOffset={10}>Offset content</PopoverContent>
      </Popover>
    )
    
    expect(screen.getByText('Offset content')).toBeInTheDocument()
  })

  it('hides content when trigger is clicked again', () => {
    render(
      <Popover>
        <PopoverTrigger>Toggle</PopoverTrigger>
        <PopoverContent>Toggle content</PopoverContent>
      </Popover>
    )
    
    const trigger = screen.getByText('Toggle')
    
    // Open
    fireEvent.click(trigger)
    expect(screen.getByText('Toggle content')).toBeInTheDocument()
    
    // Close
    fireEvent.click(trigger)
    expect(screen.queryByText('Toggle content')).not.toBeInTheDocument()
  })
})
