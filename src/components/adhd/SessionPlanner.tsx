'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import Modal from '@/components/shared/Modal';
import { db } from '@/lib/db';
import { formatMinutes, priorityConfig } from '@/lib/utils';
import type { Task } from '@/types';

export default function SessionPlanner() {
  const { sessionPlannerOpen, setSessionPlannerOpen, setTimerTaskId, setTimerDuration } = useApp();
  const [minutes, setMinutes] = useState(60);
  const [suggested, setSuggested] = useState<Task[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [planned, setPlanned] = useState(false);

  useEffect(() => {
    if (!sessionPlannerOpen) {
      setPlanned(false);
      setSelected(new Set());
      return;
    }
    db.tasks.where('status').anyOf('todo', 'in_progress').toArray().then(all => {
      const tasks = all.filter(t => !t.deferredUntil || t.deferredUntil <= Date.now());
      const sorted = tasks.sort((a, b) => {
        const pa = priorityConfig[a.priority].sortOrder;
        const pb = priorityConfig[b.priority].sortOrder;
        if (pa !== pb) return pa - pb;
        if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });
      setSuggested(sorted);
    });
  }, [sessionPlannerOpen]);

  const plan = () => {
    let remaining = minutes;
    const auto = new Set<string>();
    for (const t of suggested) {
      const est = t.estimatedMinutes || 15;
      if (remaining >= est) {
        auto.add(t.id);
        remaining -= est;
      }
      if (remaining <= 0) break;
    }
    setSelected(auto);
    setPlanned(true);
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const totalSelected = suggested.filter(t => selected.has(t.id)).reduce((s, t) => s + (t.estimatedMinutes || 15), 0);

  const startSession = () => {
    const first = suggested.find(t => selected.has(t.id));
    if (first) {
      setTimerTaskId(first.id);
      setTimerDuration(first.estimatedMinutes || 25);
    }
    setSessionPlannerOpen(false);
  };

  return (
    <Modal open={sessionPlannerOpen} onClose={() => setSessionPlannerOpen(false)} title="Session Planner" wide>
      {!planned ? (
        <div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 15 }}>
            How long do you have?
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            {[15, 30, 45, 60, 90, 120].map(m => (
              <button
                key={m}
                className={minutes === m ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setMinutes(m)}
              >
                {formatMinutes(m)}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={plan} style={{ width: '100%' }}>Plan my session</button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              {formatMinutes(totalSelected)} of {formatMinutes(minutes)} planned
            </span>
            <div className="progress-bar" style={{ width: 140 }}>
              <div className="progress-bar-fill" style={{
                width: `${Math.min(100, (totalSelected / minutes) * 100)}%`,
                background: totalSelected > minutes ? 'var(--color-rose)' : 'var(--color-accent)',
              }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 350, overflowY: 'auto', marginBottom: 20 }}>
            {suggested.map(t => (
              <label key={t.id} className="task-row" style={{ cursor: 'pointer', opacity: selected.has(t.id) ? 1 : 0.5 }}>
                <input
                  type="checkbox"
                  checked={selected.has(t.id)}
                  onChange={() => toggle(t.id)}
                  style={{ accentColor: 'var(--color-accent)', width: 16, height: 16 }}
                />
                <div className="priority-dot" style={{ background: priorityConfig[t.priority].color }} />
                <span style={{ flex: 1, fontSize: 14 }}>{t.title}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  {formatMinutes(t.estimatedMinutes || 15)}
                </span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => setPlanned(false)}>Back</button>
            <button className="btn-primary" onClick={startSession}>Start Session</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
