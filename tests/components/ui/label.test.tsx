import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Label } from '@/components/ui/label'

describe('Label component', () => {
  it('renders with text content', () => {
    render(<Label>Username</Label>)
    expect(screen.getByText('Username')).toBeInTheDocument()
  })

  it('renders with htmlFor attribute', () => {
    render(<Label htmlFor="email">Email</Label>)
    const label = screen.getByText('Email')
    expect(label).toHaveAttribute('for', 'email')
  })

  it('applies custom className', () => {
    render(<Label className="custom-class">Label</Label>)
    const label = screen.getByText('Label')
    expect(label).toHaveClass('custom-class')
  })

  it('applies default styling classes', () => {
    render(<Label>Styled Label</Label>)
    const label = screen.getByText('Styled Label')
    expect(label).toHaveClass('text-sm')
    expect(label).toHaveClass('font-medium')
  })

  it('renders children elements', () => {
    render(
      <Label>
        <span data-testid="child">Child Element</span>
      </Label>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<Label ref={ref}>Ref Label</Label>)
    expect(ref.current).toBeInstanceOf(HTMLLabelElement)
  })

  it('passes through additional props', () => {
    render(<Label data-testid="test-label" id="my-label">Props Label</Label>)
    const label = screen.getByTestId('test-label')
    expect(label).toHaveAttribute('id', 'my-label')
  })
})
