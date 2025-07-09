import React from 'react';
import { vi } from 'vitest';
import { act } from 'react';
import { ThirdwebProvider } from 'thirdweb/react';

// Mock the client module to always provide a client ID
vi.mock('../../client', () => ({
  __esModule: true,
  default: 'test-client-id',
}));

import { render } from '@testing-library/react';
import AttestationPage from './page';

describe('Attest [type] Page', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      render(
        <ThirdwebProvider>
          <AttestationPage params={Promise.resolve({ type: 'certification' })} />
        </ThirdwebProvider>
      );
    });
  });
}); 