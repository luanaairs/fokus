'use client';

import React from 'react';
import { useApp } from '@/lib/context';

const modules = [
  { id: 'dashboard', label: 'Dashboard', icon: '◈' },
  { id: 'tasks', label: 'Tasks', icon: '☰' },
  { id: 'students', label: 'Students', icon: '◉' },
  { id: 'writing', label: 'Writing', icon: '✎' },
  { id: 'priorities', label: 'Priorities', icon: '◆' },
  { id: 'inbox', label: 'Inbox', icon: '↓' },
  { id: 'parking', label: 'Parking Lot', icon: '▧' },
];

interface SidebarProps {
  currentModule: string;
  onNavigate: (module: string) => void;
}

export default function Sidebar({ currentModule, onNavigate }: SidebarProps) {
  const { setCaptureOpen, setSessionPlannerOpen, theme, toggleTheme } = useApp();

  return (
    <aside className="flex flex-col h-full" style={{
      width: 220,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      padding: '16px 10px',
    }}>
      <div style={{ padding: '4px 14px', marginBottom: 24 }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          fontWeight: 700,
          color: 'var(--color-accent)',
          letterSpacing: '-0.5px',
        }}>
          fokus
        </h1>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          your command center
        </div>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {modules.map(m => (
          <button
            key={m.id}
            className={`sidebar-link ${currentModule === m.id ? 'active' : ''}`}
            onClick={() => onNavigate(m.id)}
          >
            <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </nav>

      <div className="flex flex-col gap-2" style={{ paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
        <button
          className="btn-primary"
          style={{ width: '100%', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}
          onClick={() => setCaptureOpen(true)}
        >
          <span style={{ fontSize: 16 }}>+</span> Quick Capture
          <span style={{ fontSize: 10, opacity: 0.7 }}>⌘K</span>
        </button>
        <button
          className="btn-ghost"
          style={{ width: '100%', fontSize: 13 }}
          onClick={() => setSessionPlannerOpen(true)}
        >
          ⏱ Session Planner
        </button>
        <button
          className="btn-icon"
          style={{ width: '100%', fontSize: 12, padding: '6px 14px', justifyContent: 'flex-start', gap: 8, display: 'flex', alignItems: 'center' }}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? '☀' : '☽'} {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </div>
    </aside>
  );
}
