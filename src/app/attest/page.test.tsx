import React from 'react';
import { render } from '@testing-library/react';
import Page from './page';

describe('Attest Page', () => {
  it('renders without crashing', () => {
    render(<Page />);
  });
}); 