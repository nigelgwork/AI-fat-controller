import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  shortcuts?: KeyboardShortcut[];
  onOpenCommandPalette?: () => void;
}

// Get the correct modifier key based on platform
const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { enabled = true, shortcuts = [], onOpenCommandPalette } = options;
  const navigate = useNavigate();

  // Default navigation shortcuts
  const defaultShortcuts: KeyboardShortcut[] = [
    {
      key: '1',
      ctrlKey: !isMac,
      metaKey: isMac,
      action: () => navigate('/'),
      description: 'Go to Dashboard',
    },
    {
      key: '2',
      ctrlKey: !isMac,
      metaKey: isMac,
      action: () => navigate('/controller'),
      description: 'Go to Controller',
    },
    {
      key: '3',
      ctrlKey: !isMac,
      metaKey: isMac,
      action: () => navigate('/projects'),
      description: 'Go to Projects',
    },
    {
      key: '4',
      ctrlKey: !isMac,
      metaKey: isMac,
      action: () => navigate('/tasks'),
      description: 'Go to Tasks',
    },
    {
      key: '5',
      ctrlKey: !isMac,
      metaKey: isMac,
      action: () => navigate('/sessions'),
      description: 'Go to Sessions',
    },
    {
      key: '6',
      ctrlKey: !isMac,
      metaKey: isMac,
      action: () => navigate('/agents'),
      description: 'Go to Agents',
    },
    {
      key: '7',
      ctrlKey: !isMac,
      metaKey: isMac,
      action: () => navigate('/settings'),
      description: 'Go to Settings',
    },
    {
      key: 'k',
      ctrlKey: !isMac,
      metaKey: isMac,
      action: () => onOpenCommandPalette?.(),
      description: 'Open Command Palette',
    },
    {
      key: 'n',
      ctrlKey: !isMac,
      metaKey: isMac,
      shiftKey: true,
      action: () => navigate('/projects/new'),
      description: 'New Project',
    },
  ];

  const allShortcuts = [...defaultShortcuts, ...shortcuts];

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Escape to blur inputs
        if (event.key === 'Escape') {
          target.blur();
        }
        return;
      }

      for (const shortcut of allShortcuts) {
        const ctrlOrMeta = isMac ? event.metaKey : event.ctrlKey;

        // Special handling for Cmd/Ctrl shortcuts
        const needsCtrlOrMeta = shortcut.ctrlKey || shortcut.metaKey;
        const hasCtrlOrMeta = needsCtrlOrMeta ? ctrlOrMeta : true;

        if (
          event.key.toLowerCase() === shortcut.key.toLowerCase() &&
          hasCtrlOrMeta &&
          (shortcut.shiftKey === undefined || shortcut.shiftKey === event.shiftKey) &&
          (shortcut.altKey === undefined || shortcut.altKey === event.altKey)
        ) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [enabled, allShortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    shortcuts: allShortcuts,
    isMac,
  };
}

// Format shortcut for display
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrlKey || shortcut.metaKey) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.shiftKey) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (shortcut.altKey) {
    parts.push(isMac ? '⌥' : 'Alt');
  }

  parts.push(shortcut.key.toUpperCase());

  return parts.join(isMac ? '' : '+');
}
