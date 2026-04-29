import React from 'react';
import { render, screen } from '@testing-library/react';
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

  it('renders the OMATrust Reputation Portal heading', () => {
    render(
      <Providers>
        <Page />
      </Providers>
    );
    expect(screen.getByText(/OMATrust Reputation Portal/i)).toBeInTheDocument();
  });

  it('renders the Controller Witness feature card', () => {
    render(
      <Providers>
        <Page />
      </Providers>
    );
    expect(screen.getByText('Controller Witness')).toBeInTheDocument();
    expect(screen.getByText(/third-party witness/i)).toBeInTheDocument();
  });

  it('renders the Key Binding feature card', () => {
    render(
      <Providers>
        <Page />
      </Providers>
    );
    expect(screen.getByText('Key Binding')).toBeInTheDocument();
  });

  it('has a link to the controller-witness attestation page', () => {
    render(
      <Providers>
        <Page />
      </Providers>
    );
    const links = screen.getAllByRole('link');
    const cwLink = links.find(link => link.getAttribute('href') === '/attest/controller-witness');
    expect(cwLink).toBeDefined();
  });

  it('renders all expected feature cards', () => {
    render(
      <Providers>
        <Page />
      </Providers>
    );
    const expectedFeatures = [
      'Security Assessments',
      'Certification Attestations',
      'Endorsements',
      'Linked Identifiers',
      'Key Binding',
      'Controller Witness',
      'User Reviews',
      'User Review Responses',
    ];
    expectedFeatures.forEach(title => {
      expect(screen.getByText(title)).toBeInTheDocument();
    });
  });
}); 