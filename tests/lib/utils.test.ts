import { cn } from '@/lib/utils';

describe('cn utility', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });
  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', undefined, null, 'baz')).toBe('foo baz');
  });
  it('dedupes tailwind classes', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
  it('returns empty string for no input', () => {
    expect(cn()).toBe('');
  });
});
