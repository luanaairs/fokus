'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/db';
import { priorityConfig, now as nowFn, formatMinutes } from '@/lib/utils';
import type { Task } from '@/types';

type Quadrant = 'urgent-important' | 'not-urgent-important' | 'urgent-not-important' | 'not-urgent-not-important';

const quadrants: { id: Quadrant; label: string; description: string; color: string }[] = [
  { id: 'urgent-important', label: 'Do First', description: 'Critical & High priority, due soon', color: 'var(--color-critical)' },
  { id: 'not-urgent-important', label: 'Schedule', description: 'High priority, not urgent', color: 'var(--color-sky)' },
  { id: 'urgent-not-important', label: 'Delegate', description: 'Due soon but lower priority', color: 'var(--color-amber)' },
  { id: 'not-urgent-not-important', label: 'Eliminate', description: 'Low priority, no deadline pressure', color: 'var(--color-surface-500)' },
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
    'urgent-important': [],
    'not-urgent-important': [],
    'urgent-not-important': [],
    'not-urgent-not-important': [],
  };
  tasks.forEach(t => grouped[classifyTask(t)].push(t));

  const completeTask = async (id: string) => {
    await db.tasks.update(id, { status: 'done', completedAt: nowFn() });
    refresh();
  };

  return (
    <div style={{ padding: '24px 28px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Priorities</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>Eisenhower Matrix — Urgency × Importance</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto', gap: 16, maxWidth: 1000 }}>
        {quadrants.map(q => (
          <div key={q.id} className="card" style={{ borderTop: `3px solid ${q.color}`, minHeight: 200 }}>
            <div style={{ marginBottom: 12 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: q.color }}>{q.label}</h3>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{q.description}</div>
            </div>
            {grouped[q.id].length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No tasks in this quadrant</p>
            ) : (
              <div className="flex flex-col gap-1">
                {grouped[q.id].map(t => (
                  <div key={t.id} className="flex items-center gap-2" style={{
                    padding: '6px 8px', background: 'var(--bg-tertiary)', borderRadius: 6, fontSize: 13,
                  }}>
                    <button className="btn-icon" onClick={() => completeTask(t.id)} style={{ fontSize: 14, color: 'var(--text-muted)' }}>○</button>
                    <span style={{ color: priorityConfig[t.priority].color, fontSize: 9 }}>●</span>
                    <span style={{ flex: 1 }}>{t.title}</span>
                    {t.estimatedMinutes > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatMinutes(t.estimatedMinutes)}</span>}
                    <button className="btn-icon" onClick={() => { setFocusTaskId(t.id); setFocusMode(true); }} style={{ fontSize: 10 }}>◎</button>
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
