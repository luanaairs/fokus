'use client';

import React from 'react';
import { useApp } from '@/lib/context';

export default function SwitchWarning() {
  const { switchWarning, setSwitchWarning } = useApp();
  if (!switchWarning?.show) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 400, textAlign: 'center', padding: 32 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 'var(--radius-md)',
          background: 'var(--color-amber-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 24,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-amber)" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" /></svg>
        </div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 8 }}>
          Still working on this?
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
          You have a timer running for <strong style={{ color: 'var(--text-primary)' }}>{switchWarning.taskTitle}</strong>.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn-ghost" onClick={() => { switchWarning.onContinue(); setSwitchWarning(null); }}>
            Switch anyway
          </button>
          <button className="btn-primary" onClick={() => setSwitchWarning(null)}>
            Stay focused
          </button>
        </div>
      </div>
    </div>
  );
}
