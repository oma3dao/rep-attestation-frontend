import { describe, it, expect } from 'vitest';
import sitemap from '@/app/sitemap';

describe('sitemap', () => {
  it('returns an array of sitemap entries', () => {
    const result = sitemap();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('each entry has url, lastModified, changeFrequency, and priority', () => {
    const result = sitemap();
    const baseUrl = 'https://reputation.omatrust.org';
    for (const entry of result) {
      expect(entry).toHaveProperty('url');
      expect(entry).toHaveProperty('lastModified');
      expect(entry).toHaveProperty('changeFrequency');
      expect(entry).toHaveProperty('priority');
      expect(typeof entry.url).toBe('string');
      expect(entry.lastModified).toBeInstanceOf(Date);
      expect(['daily', 'weekly', 'monthly', 'yearly']).toContain(entry.changeFrequency);
      expect(typeof entry.priority).toBe('number');
    }
  });

  it('includes base URL with daily frequency and priority 1', () => {
    const result = sitemap();
    const base = result.find(e => e.url === 'https://reputation.omatrust.org');
    expect(base).toBeDefined();
    expect(base?.changeFrequency).toBe('daily');
    expect(base?.priority).toBe(1);
  });

  it('includes attestation routes with weekly frequency and priority 0.8', () => {
    const result = sitemap();
    const attestRoutes = result.filter(e =>
      e.url.startsWith('https://reputation.omatrust.org/attest/')
    );
    expect(attestRoutes.length).toBeGreaterThanOrEqual(6);
    for (const entry of attestRoutes) {
      expect(entry.changeFrequency).toBe('weekly');
      expect(entry.priority).toBe(0.8);
    }
  });

  it('includes certification, endorsement, linked-identifier, security-assessment, user-review, user-review-response', () => {
    const result = sitemap();
    const urls = result.map(e => e.url);
    const base = 'https://reputation.omatrust.org/attest/';
    expect(urls).toContain(`${base}certification`);
    expect(urls).toContain(`${base}endorsement`);
    expect(urls).toContain(`${base}linked-identifier`);
    expect(urls).toContain(`${base}security-assessment`);
    expect(urls).toContain(`${base}user-review`);
    expect(urls).toContain(`${base}user-review-response`);
  });
});
