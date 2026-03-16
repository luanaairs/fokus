'use client';

import React, { useEffect, useState } from 'react';

interface Props {
  from: string;
  to: string;
  onComplete: () => void;
}

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  tasks: 'Tasks',
  routines: 'Routines',
  students: 'Students',
  writing: 'Writing',
  priorities: 'Priorities',
  inbox: 'Inbox',
  parking: 'Parking Lot',
  settings: 'Settings',
};

const TIPS = [
  'Take a breath before diving in.',
  'You\'re shifting gears — that\'s okay.',
  'One thing at a time.',
  'What\'s the one thing you need here?',
  'You don\'t have to do everything.',
  'Progress, not perfection.',
  'Your brain needs a moment to switch.',
];

export default function TransitionPrompt({ from, to, onComplete }: Props) {
  const [visible, setVisible] = useState(true);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 300);
    }, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'var(--bg-app)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s ease',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
        color: 'var(--text-muted)', fontSize: 14,
      }}>
        <span style={{ padding: '4px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
          {MODULE_LABELS[from] || from}
        </span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
        <span style={{ padding: '4px 12px', background: 'var(--color-accent-light)', color: 'var(--color-accent)', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
          {MODULE_LABELS[to] || to}
        </span>
      </div>
      <p style={{
        fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)',
        textAlign: 'center', maxWidth: 360,
      }}>
        {tip}
      </p>
      <div style={{
        width: 48, height: 3, background: 'var(--color-accent)',
        borderRadius: 'var(--radius-full)', marginTop: 24,
        animation: 'shrink 2s linear forwards',
      }} />
      <style>{`
        @keyframes shrink {
          from { width: 120px; }
          to { width: 0px; }
        }
      `}</style>
    </div>
  );
}
