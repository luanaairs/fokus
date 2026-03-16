'use client';

import React from 'react';

interface Props {
  icon: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '64px 20px', textAlign: 'center',
    }}>
      <div style={{
        fontSize: 40, marginBottom: 16, opacity: 0.3,
        width: 72, height: 72, borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 6 }}>{title}</h3>
      {description && <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 300, marginBottom: 20 }}>{description}</p>}
      {action && <button className="btn-primary" onClick={action.onClick}>{action.label}</button>}
    </div>
  );
}
