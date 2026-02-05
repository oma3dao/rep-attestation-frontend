// Mock ResizeObserver for cmdk
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock scrollIntoView for jsdom
Element.prototype.scrollIntoView = () => {};

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from '@/components/ui/command';

describe('Command components', () => {
  describe('Command', () => {
    it('renders with default styles', () => {
      render(
        <Command data-testid="command">
          <div>Content</div>
        </Command>
      );
      const command = screen.getByTestId('command');
      expect(command).toBeInTheDocument();
      expect(command).toHaveClass('flex', 'h-full', 'w-full', 'flex-col');
    });

    it('accepts custom className', () => {
      render(
        <Command className="custom-class" data-testid="command">
          <div>Content</div>
        </Command>
      );
      expect(screen.getByTestId('command')).toHaveClass('custom-class');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <Command ref={ref} data-testid="command">
          <div>Content</div>
        </Command>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('CommandDialog', () => {
    it('renders dialog with command inside', () => {
      render(
        <CommandDialog open={true}>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandItem>Item 1</CommandItem>
          </CommandList>
        </CommandDialog>
      );
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    });
  });

  describe('CommandInput', () => {
    it('renders input with search icon', () => {
      render(
        <Command>
          <CommandInput placeholder="Type a command..." />
        </Command>
      );
      expect(screen.getByPlaceholderText('Type a command...')).toBeInTheDocument();
    });

    it('accepts custom className', () => {
      render(
        <Command>
          <CommandInput className="custom-input" placeholder="Search" data-testid="cmd-input" />
        </Command>
      );
      const input = screen.getByPlaceholderText('Search');
      expect(input).toHaveClass('custom-input');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <Command>
          <CommandInput ref={ref} placeholder="Search" />
        </Command>
      );
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });
  });

  describe('CommandList', () => {
    it('renders list with default styles', () => {
      render(
        <Command>
          <CommandList data-testid="cmd-list">
            <CommandItem>Item</CommandItem>
          </CommandList>
        </Command>
      );
      const list = screen.getByTestId('cmd-list');
      expect(list).toBeInTheDocument();
      expect(list).toHaveClass('max-h-[300px]', 'overflow-y-auto');
    });

    it('accepts custom className', () => {
      render(
        <Command>
          <CommandList className="custom-list" data-testid="cmd-list">
            <CommandItem>Item</CommandItem>
          </CommandList>
        </Command>
      );
      expect(screen.getByTestId('cmd-list')).toHaveClass('custom-list');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <Command>
          <CommandList ref={ref} data-testid="cmd-list">
            <CommandItem>Item</CommandItem>
          </CommandList>
        </Command>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('CommandEmpty', () => {
    it('renders empty state', () => {
      render(
        <Command>
          <CommandEmpty data-testid="cmd-empty">No results found.</CommandEmpty>
        </Command>
      );
      expect(screen.getByText('No results found.')).toBeInTheDocument();
    });

    it('applies default styles', () => {
      render(
        <Command>
          <CommandEmpty data-testid="cmd-empty">No results</CommandEmpty>
        </Command>
      );
      const empty = screen.getByTestId('cmd-empty');
      expect(empty).toHaveClass('py-6', 'text-center', 'text-sm');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <Command>
          <CommandEmpty ref={ref} data-testid="cmd-empty">Empty</CommandEmpty>
        </Command>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('CommandGroup', () => {
    it('renders group with heading', () => {
      render(
        <Command>
          <CommandGroup heading="Suggestions" data-testid="cmd-group">
            <CommandItem>Calendar</CommandItem>
            <CommandItem>Calculator</CommandItem>
          </CommandGroup>
        </Command>
      );
      expect(screen.getByText('Suggestions')).toBeInTheDocument();
      expect(screen.getByText('Calendar')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <Command>
          <CommandGroup className="custom-group" data-testid="cmd-group">
            <CommandItem>Item</CommandItem>
          </CommandGroup>
        </Command>
      );
      expect(screen.getByTestId('cmd-group')).toHaveClass('custom-group');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <Command>
          <CommandGroup ref={ref} data-testid="cmd-group">
            <CommandItem>Item</CommandItem>
          </CommandGroup>
        </Command>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('CommandSeparator', () => {
    it('renders separator with default styles', () => {
      render(
        <Command>
          <CommandGroup>
            <CommandItem>Item 1</CommandItem>
          </CommandGroup>
          <CommandSeparator data-testid="cmd-separator" />
          <CommandGroup>
            <CommandItem>Item 2</CommandItem>
          </CommandGroup>
        </Command>
      );
      const separator = screen.getByTestId('cmd-separator');
      expect(separator).toBeInTheDocument();
      expect(separator).toHaveClass('-mx-1', 'h-px', 'bg-border');
    });

    it('accepts custom className', () => {
      render(
        <Command>
          <CommandSeparator className="custom-separator" data-testid="cmd-separator" />
        </Command>
      );
      expect(screen.getByTestId('cmd-separator')).toHaveClass('custom-separator');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <Command>
          <CommandSeparator ref={ref} data-testid="cmd-separator" />
        </Command>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('CommandItem', () => {
    it('renders item with content', () => {
      render(
        <Command>
          <CommandList>
            <CommandItem>Test Item</CommandItem>
          </CommandList>
        </Command>
      );
      expect(screen.getByText('Test Item')).toBeInTheDocument();
    });

    it('applies default styles', () => {
      render(
        <Command>
          <CommandList>
            <CommandItem data-testid="cmd-item">Item</CommandItem>
          </CommandList>
        </Command>
      );
      const item = screen.getByTestId('cmd-item');
      expect(item).toHaveClass('relative', 'flex', 'cursor-default', 'select-none');
    });

    it('accepts custom className', () => {
      render(
        <Command>
          <CommandList>
            <CommandItem className="custom-item" data-testid="cmd-item">Item</CommandItem>
          </CommandList>
        </Command>
      );
      expect(screen.getByTestId('cmd-item')).toHaveClass('custom-item');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <Command>
          <CommandList>
            <CommandItem ref={ref} data-testid="cmd-item">Item</CommandItem>
          </CommandList>
        </Command>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('CommandShortcut', () => {
    it('renders shortcut text', () => {
      render(
        <Command>
          <CommandList>
            <CommandItem>
              Calendar
              <CommandShortcut>⌘K</CommandShortcut>
            </CommandItem>
          </CommandList>
        </Command>
      );
      expect(screen.getByText('⌘K')).toBeInTheDocument();
    });

    it('applies default styles', () => {
      render(
        <Command>
          <CommandList>
            <CommandItem>
              Calendar
              <CommandShortcut data-testid="cmd-shortcut">⌘K</CommandShortcut>
            </CommandItem>
          </CommandList>
        </Command>
      );
      const shortcut = screen.getByTestId('cmd-shortcut');
      expect(shortcut).toHaveClass('ml-auto', 'text-xs', 'tracking-widest');
    });

    it('accepts custom className', () => {
      render(
        <Command>
          <CommandList>
            <CommandItem>
              Calendar
              <CommandShortcut className="custom-shortcut" data-testid="cmd-shortcut">
                ⌘K
              </CommandShortcut>
            </CommandItem>
          </CommandList>
        </Command>
      );
      expect(screen.getByTestId('cmd-shortcut')).toHaveClass('custom-shortcut');
    });
  });

  describe('Combined usage', () => {
    it('renders full command menu', () => {
      render(
        <Command>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Suggestions">
              <CommandItem>
                Calendar
                <CommandShortcut>⌘C</CommandShortcut>
              </CommandItem>
              <CommandItem>
                Search Emoji
                <CommandShortcut>⌘E</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Settings">
              <CommandItem>Profile</CommandItem>
              <CommandItem>Settings</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      );

      expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
      expect(screen.getByText('Suggestions')).toBeInTheDocument();
      expect(screen.getByText('Calendar')).toBeInTheDocument();
      expect(screen.getByText('⌘C')).toBeInTheDocument();
      // "Settings" appears twice: as a heading and as an item
      expect(screen.getAllByText('Settings')).toHaveLength(2);
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });
  });
});
