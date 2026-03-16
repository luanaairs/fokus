'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { db, completeTaskById } from '@/lib/db';
import { priorityConfig, formatMinutes } from '@/lib/utils';
import type { Task } from '@/types';

type Quadrant = 'urgent-important' | 'not-urgent-important' | 'urgent-not-important' | 'not-urgent-not-important';

const quadrants: { id: Quadrant; label: string; description: string; color: string; bg: string }[] = [
  { id: 'urgent-important', label: 'Do First', description: 'Critical & High priority, due soon', color: 'var(--color-critical)', bg: 'var(--color-rose-light)' },
  { id: 'not-urgent-important', label: 'Schedule', description: 'High priority, not urgent', color: 'var(--color-sky)', bg: 'var(--color-sky-light)' },
  { id: 'urgent-not-important', label: 'Delegate', description: 'Due soon but lower priority', color: 'var(--color-amber)', bg: 'var(--color-amber-light)' },
  { id: 'not-urgent-not-important', label: 'Eliminate', description: 'Low priority, no deadline pressure', color: 'var(--text-muted)', bg: 'var(--bg-input)' },
];

function classifyTask(t: Task): Quadrant {
  const isUrgent = t.dueDate ? (t.dueDate - Date.now()) < 3 * 24 * 60 * 60 * 1000 : false;
  const isImportant = t.priority === 'critical' || t.priority === 'high';
  if (isUrgent && isImportant) return 'urgent-important';
  if (!isUrgent && isImportant) return 'not-urgent-important';
  if (isUrgent && !isImportant) return 'urgent-not-important';
  return 'not-urgent-not-important';
}

export default function EisenhowerMatrix() {
  const { refreshKey, refresh, setFocusMode, setFocusTaskId } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    db.tasks.where('status').anyOf('todo', 'in_progress').toArray().then(t =>
      setTasks(t.filter(tt => !tt.parentTaskId))
    );
  }, [refreshKey]);

  const grouped: Record<Quadrant, Task[]> = {
    'urgent-important': [], 'not-urgent-important': [],
    'urgent-not-important': [], 'not-urgent-not-important': [],
  };
  tasks.forEach(t => grouped[classifyTask(t)].push(t));

  const completeTask = async (id: string) => {
    await completeTaskById(id);
    refresh();
  };

  return (
    <div className="page-content" style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 4 }}>Priorities</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Eisenhower Matrix — Urgency vs Importance</p>
      </div>

      <div className="grid-eisenhower" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 1000 }}>
        {quadrants.map(q => (
          <div key={q.id} className="card" style={{ padding: 20, minHeight: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 4, height: 28, borderRadius: 2, background: q.color }} />
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: q.color }}>{q.label}</h3>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{q.description}</div>
              </div>
              <span className="badge" style={{ marginLeft: 'auto', background: q.bg, color: q.color }}>{grouped[q.id].length}</span>
            </div>
            {grouped[q.id].length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>Empty</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {grouped[q.id].map(t => (
                  <div key={t.id} className="task-row" style={{ padding: '8px 12px' }}>
                    <button className="btn-icon" onClick={() => completeTask(t.id)} style={{ padding: 4 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /></svg>
                    </button>
                    <div className="priority-dot" style={{ background: priorityConfig[t.priority].color }} />
                    <span style={{ flex: 1, fontSize: 13 }}>{t.title}</span>
                    {t.estimatedMinutes > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{formatMinutes(t.estimatedMinutes)}</span>}
                    <button className="btn-icon" onClick={() => { setFocusTaskId(t.id); setFocusMode(true); }} style={{ padding: 4, color: 'var(--color-accent)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
