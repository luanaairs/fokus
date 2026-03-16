'use client';

import React from 'react';
import { useApp } from '@/lib/context';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'tasks', label: 'Tasks', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { id: 'routines', label: 'Routines', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  { id: 'students', label: 'Students', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { id: 'writing', label: 'Writing', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { id: 'priorities', label: 'Priorities', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
];

const adhdItems = [
  { id: 'inbox', label: 'Inbox', icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4' },
  { id: 'parking', label: 'Parking Lot', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
];

function NavIcon({ path }: { path: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

interface SidebarProps {
  currentModule: string;
  onNavigate: (module: string) => void;
  onBackup?: () => void;
}

export default function Sidebar({ currentModule, onNavigate, onBackup }: SidebarProps) {
  const { setCaptureOpen, setSessionPlannerOpen, theme, toggleTheme } = useApp();

  return (
    <aside style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-light)',
      padding: '20px 12px',
    }}>
      {/* Logo */}
      <div style={{ padding: '4px 16px', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 'var(--radius-sm)',
            background: 'var(--color-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-display)',
          }}>
            f
          </div>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            color: 'var(--text-primary)',
          }}>
            fokus
          </span>
        </div>
      </div>

      {/* Menu */}
      <div className="section-label">Menu</div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 24 }}>
        {menuItems.map(m => (
          <button
            key={m.id}
            className={`sidebar-link ${currentModule === m.id ? 'active' : ''}`}
            onClick={() => onNavigate(m.id)}
          >
            <NavIcon path={m.icon} />
            {m.label}
          </button>
        ))}
      </nav>

      {/* ADHD Tools */}
      <div className="section-label">Capture</div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 24 }}>
        {adhdItems.map(m => (
          <button
            key={m.id}
            className={`sidebar-link ${currentModule === m.id ? 'active' : ''}`}
            onClick={() => onNavigate(m.id)}
          >
            <NavIcon path={m.icon} />
            {m.label}
          </button>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {/* Bottom Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 4px 0', borderTop: '1px solid var(--border-light)' }}>
        <button className="btn-primary" onClick={() => setCaptureOpen(true)} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Quick Capture
          <span className="kbd-hint" style={{ fontSize: 10, opacity: 0.7, marginLeft: 4, fontWeight: 400 }}>⌘K</span>
        </button>
        <button className="btn-ghost" onClick={() => setSessionPlannerOpen(true)} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
          Session Planner
        </button>
        {onBackup && (
          <button className="btn-icon" onClick={onBackup} style={{
            width: '100%', justifyContent: 'flex-start', padding: '8px 16px', gap: 10, display: 'flex', fontSize: 13, color: 'var(--text-muted)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Backup & Restore
          </button>
        )}
        <button className="btn-icon" onClick={toggleTheme} style={{
          width: '100%', justifyContent: 'flex-start', padding: '8px 16px', gap: 10, display: 'flex', fontSize: 13, color: 'var(--text-muted)',
        }}>
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
          )}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </div>
    </aside>
  );
}
