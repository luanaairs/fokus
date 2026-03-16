'use client';

import React from 'react';
import { useApp } from '@/lib/context';

export default function SwitchWarning() {
  const { switchWarning, setSwitchWarning } = useApp();
  if (!switchWarning?.show) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 380 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          Still working on this?
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
          You have a timer running for <strong>{switchWarning.taskTitle}</strong>. Want to continue or switch away?
        </p>
        <div className="flex gap-3 justify-end">
          <button className="btn-ghost" onClick={() => {
            switchWarning.onContinue();
            setSwitchWarning(null);
          }}>Switch anyway</button>
          <button className="btn-primary" onClick={() => setSwitchWarning(null)}>
            Stay focused
          </button>
        </div>
      </div>
    </div>
  );
}
