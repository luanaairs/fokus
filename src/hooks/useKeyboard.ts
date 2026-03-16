'use client';

import { useEffect } from 'react';

export function useKeyboard(key: string, callback: () => void, modifier: 'ctrl' | 'meta' | 'alt' = 'ctrl') {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const modActive =
        modifier === 'ctrl' ? (e.ctrlKey || e.metaKey) :
        modifier === 'meta' ? e.metaKey :
        e.altKey;
      if (modActive && e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault();
        callback();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, callback, modifier]);
}

export function useEscape(callback: () => void) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        callback();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [callback]);
}
