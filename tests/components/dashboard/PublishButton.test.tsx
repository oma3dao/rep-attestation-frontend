import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PublishButton } from '@/components/dashboard/PublishButton';
import { PUBLISH_MENU_ITEMS } from '@/config/publish-categories';

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

    for (const item of PUBLISH_MENU_ITEMS) {
      const link = await screen.findByRole('menuitem', { name: item.label });
      expect(link).toHaveAttribute('href', item.href);
    }
  });
});
