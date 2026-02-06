import React from 'react';
import { render } from '@testing-library/react';
import { Providers } from '@/components/providers';
import Page from '@/app/page';

describe('Main Page', () => {
  it('renders without crashing', () => {
    render(
      <Providers>
        <Page />
      </Providers>
    );
  });
}); 