process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID = 'test-client-id';

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock scrollIntoView which doesn't exist in jsdom
Element.prototype.scrollIntoView = vi.fn();

// Silence act() warnings in test output
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('not wrapped in act')
    ) {
      return;
    }
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
}); 