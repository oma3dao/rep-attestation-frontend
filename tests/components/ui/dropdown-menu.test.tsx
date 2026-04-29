import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';

describe('DropdownMenu (Radix UI)', () => {
  it('renders trigger and does not show content by default', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByText('Open Menu')).toBeInTheDocument();
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
  });

  it('shows content when trigger is clicked', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
          <DropdownMenuItem>Item 2</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await userEvent.click(screen.getByText('Open Menu'));
    expect(await screen.findByText('Item 1')).toBeInTheDocument();
    expect(await screen.findByText('Item 2')).toBeInTheDocument();
  });

  it('calls onSelect when item is clicked', async () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await userEvent.click(screen.getByText('Open Menu'));
    await userEvent.click(await screen.findByText('Item 1'));
    expect(onSelect).toHaveBeenCalled();
  });

  it('renders and toggles a checkbox item', async () => {
    const onCheckedChange = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked={false} onCheckedChange={onCheckedChange}>
            Check me
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await userEvent.click(screen.getByText('Open Menu'));
    await userEvent.click(await screen.findByText('Check me'));
    expect(onCheckedChange).toHaveBeenCalled();
  });

  it('renders and selects a radio item', async () => {
    const onValueChange = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="a" onValueChange={onValueChange}>
            <DropdownMenuRadioItem value="a">A</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="b">B</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await userEvent.click(screen.getByText('Open Menu'));
    await userEvent.click(await screen.findByText('B'));
    expect(onValueChange).toHaveBeenCalledWith('b');
  });

  it('renders label and separator', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Label</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await userEvent.click(screen.getByText('Open Menu'));
    expect(await screen.findByText('Label')).toBeInTheDocument();
    expect(await screen.findByText('Item')).toBeInTheDocument();
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('renders DropdownMenuShortcut inside menu item', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            Save
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await userEvent.click(screen.getByText('Open Menu'));
    expect(await screen.findByText('Save')).toBeInTheDocument();
    expect(await screen.findByText('⌘S')).toBeInTheDocument();
  });

  it('renders and opens a submenu', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Subitem 1</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await userEvent.click(screen.getByText('Open Menu'));
    await userEvent.hover(await screen.findByText('More'));
    expect(await screen.findByText('Subitem 1')).toBeInTheDocument();
  });

  it('handles keyboard navigation (arrow keys, enter, escape)', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
          <DropdownMenuItem>Item 2</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await userEvent.click(screen.getByText('Open Menu'));
    const item1 = await screen.findByText('Item 1');
    await act(async () => {
      item1.focus();
      await userEvent.keyboard('{ArrowDown}');
    });
    const item2 = await screen.findByText('Item 2');
    expect(document.activeElement).toBe(item2);
    await act(async () => {
      await userEvent.keyboard('{ArrowUp}');
    });
    expect(document.activeElement).toBe(item1);
    await act(async () => {
      await userEvent.keyboard('{Escape}');
    });
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
  });

  it('renders disabled item and does not call onSelect', async () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem disabled onSelect={onSelect}>Disabled</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await userEvent.click(screen.getByText('Open Menu'));
    await userEvent.click(await screen.findByText('Disabled'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders DropdownMenuItem with missing props gracefully', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await userEvent.click(screen.getByText('Open Menu'));
    expect(await screen.findByText('Item')).toBeInTheDocument();
  });

  it('handles keyboard navigation when menu is closed', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    // Pressing arrow keys when menu is closed should not throw
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowUp}');
    // Menu should not be open
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
  });

  it('opens and closes submenu with keyboard', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Subitem 1</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await userEvent.click(screen.getByText('Open Menu'));
    const subTrigger = await screen.findByText('More');
    await act(async () => {
      subTrigger.focus();
      await userEvent.keyboard('{Enter}');
    });
    expect(await screen.findByText('Subitem 1')).toBeInTheDocument();
    await act(async () => {
      await userEvent.keyboard('{Escape}');
    });
    expect(screen.queryByText('Subitem 1')).not.toBeInTheDocument();
  });
}); 