import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StarRating, getRatingValue } from '@/components/star-rating';

describe('getRatingValue', () => {
  it('rounds numeric values to the nearest integer', () => {
    expect(getRatingValue(3.4)).toBe(3);
    expect(getRatingValue(3.6)).toBe(4);
  });

  it('parses numeric strings', () => {
    expect(getRatingValue('4')).toBe(4);
    expect(getRatingValue('2.5')).toBe(3); // 2.5 rounds to 3 (half-up)
  });

  it('converts bigint values', () => {
    expect(getRatingValue(5n)).toBe(5);
  });

  it('clamps to the [0, max] range', () => {
    expect(getRatingValue(9)).toBe(5);
    expect(getRatingValue(-3)).toBe(0);
    expect(getRatingValue(9, 10)).toBe(9);
  });

  it('returns null for non-finite or non-numeric values', () => {
    expect(getRatingValue(null)).toBeNull();
    expect(getRatingValue(undefined)).toBeNull();
    expect(getRatingValue('not-a-number')).toBeNull();
    expect(getRatingValue(NaN)).toBeNull();
    expect(getRatingValue(Infinity)).toBeNull();
  });
});

describe('StarRating', () => {
  it('renders a dash when the value cannot be parsed', () => {
    render(<StarRating value={null} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('exposes an accessible label and title for a valid rating', () => {
    render(<StarRating value={4} />);
    expect(screen.getByLabelText('4 out of 5 stars')).toBeInTheDocument();
    expect(screen.getByTitle('4/5')).toBeInTheDocument();
  });

  it('renders `max` star icons', () => {
    const { container } = render(<StarRating value={3} max={5} />);
    expect(container.querySelectorAll('svg')).toHaveLength(5);
  });

  it('respects a custom max in the accessible label', () => {
    render(<StarRating value={7} max={10} />);
    expect(screen.getByLabelText('7 out of 10 stars')).toBeInTheDocument();
  });
});
