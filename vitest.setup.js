process.env.NEXT_PUBLIC_CLIENT_ID = 'test-client-id';

import '@testing-library/jest-dom';

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