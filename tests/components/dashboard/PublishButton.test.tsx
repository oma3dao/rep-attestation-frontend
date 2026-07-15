import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PublishButton } from '@/components/dashboard/PublishButton';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe('PublishButton', () => {
  it('renders the Publish trigger and hides the menu by default', () => {
    render(<PublishButton />);
    expect(screen.getByRole('button', { name: /Publish/i })).toBeInTheDocument();
    expect(screen.queryByText('User Review')).not.toBeInTheDocument();
  });

  it('reveals all publish menu items with correct links when opened', async () => {
    render(<PublishButton />);
    await userEvent.click(screen.getByRole('button', { name: /Publish/i }));

    const userReview = await screen.findByRole('menuitem', { name: /User Review/i });
    expect(userReview).toHaveAttribute('href', '/publish/user-review');

    const contentClaim = await screen.findByRole('menuitem', { name: /Content Claim/i });
    expect(contentClaim).toHaveAttribute('href', '/publish/responsibility-claim');

    const other = await screen.findByRole('menuitem', { name: /Other attestations/i });
    expect(other).toHaveAttribute('href', '/publish');
  });

  it('pre-fills responsibleParty when user has exactly one subject', async () => {
    const subjects = [{ id: '1', canonicalDid: 'did:web:example.com', subjectDidHash: 'abc', displayName: null, isDefault: true }];
    render(<PublishButton subjects={subjects} />);
    await userEvent.click(screen.getByRole('button', { name: /Publish/i }));

    const contentClaim = await screen.findByRole('menuitem', { name: /Content Claim/i });
    expect(contentClaim).toHaveAttribute('href', '/publish/responsibility-claim?responsibleParty=did%3Aweb%3Aexample.com');
  });

  it('does not pre-fill when user has multiple subjects', async () => {
    const subjects = [
      { id: '1', canonicalDid: 'did:web:a.com', subjectDidHash: 'a', displayName: null, isDefault: true },
      { id: '2', canonicalDid: 'did:web:b.com', subjectDidHash: 'b', displayName: null, isDefault: false },
    ];
    render(<PublishButton subjects={subjects} />);
    await userEvent.click(screen.getByRole('button', { name: /Publish/i }));

    const contentClaim = await screen.findByRole('menuitem', { name: /Content Claim/i });
    expect(contentClaim).toHaveAttribute('href', '/publish/responsibility-claim');
  });
});
