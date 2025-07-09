import { render, screen } from '@testing-library/react';
import React, { createRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card';

describe('Card component suite', () => {
  it('renders Card with children', () => {
    render(<Card>Card Body</Card>);
    expect(screen.getByText('Card Body')).toBeInTheDocument();
  });

  it('applies custom className to Card', () => {
    render(<Card className="custom-card">Card</Card>);
    expect(screen.getByText('Card').className).toMatch(/custom-card/);
  });

  it('forwards ref to Card', () => {
    const ref = createRef<HTMLDivElement>();
    render(<Card ref={ref}>Ref Card</Card>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('renders CardHeader with children', () => {
    render(<CardHeader>Header</CardHeader>);
    expect(screen.getByText('Header')).toBeInTheDocument();
  });

  it('renders CardTitle with children', () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  it('renders CardDescription with children', () => {
    render(<CardDescription>Description</CardDescription>);
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('renders CardContent with children', () => {
    render(<CardContent>Content</CardContent>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders CardFooter with children', () => {
    render(<CardFooter>Footer</CardFooter>);
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });
}); 