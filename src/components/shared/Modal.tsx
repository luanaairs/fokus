'use client';

import React from 'react';
import { useEscape } from '@/hooks/useKeyboard';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}

export default function Modal({ open, onClose, title, children, wide }: ModalProps) {
  useEscape(onClose);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={wide ? { maxWidth: 720 } : undefined}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>{title}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
