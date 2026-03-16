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
    <div className="flex flex-col items-center justify-center" style={{ padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.5 }}>{icon}</div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{title}</h3>
      {description && <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 300, marginBottom: 16 }}>{description}</p>}
      {action && <button className="btn-primary" onClick={action.onClick}>{action.label}</button>}
    </div>
  );
}
