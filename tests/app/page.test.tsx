import React from 'react';
import { render } from '@testing-library/react';
import Page from '../../src/app/page';

describe('Main Page', () => {
  it('renders without crashing', () => {
    render(<Page />);
  });
}); 