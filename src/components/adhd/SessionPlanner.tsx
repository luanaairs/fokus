'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import Modal from '@/components/shared/Modal';
import { db } from '@/lib/db';
import { formatMinutes, todayStart, todayEnd, priorityConfig } from '@/lib/utils';
import type { Task, Priority } from '@/types';

export default function SessionPlanner() {
  const { sessionPlannerOpen, setSessionPlannerOpen, setFocusMode, setFocusTaskId, setTimerTaskId, setTimerDuration } = useApp();
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
    // Load candidate tasks
    const start = todayStart();
    const end = todayEnd();
    db.tasks.where('status').anyOf('todo', 'in_progress').toArray().then(tasks => {
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
          <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 14 }}>
            How long do you have?
          </p>
          <div className="flex items-center gap-3" style={{ marginBottom: 20 }}>
            {[15, 30, 45, 60, 90, 120].map(m => (
              <button
                key={m}
                className={minutes === m ? 'btn-primary' : 'btn-ghost'}
                onClick={() => setMinutes(m)}
                style={{ fontSize: 13 }}
              >
                {formatMinutes(m)}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={plan}>Plan my session</button>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              {formatMinutes(totalSelected)} of {formatMinutes(minutes)} planned
            </span>
            <div className="progress-bar" style={{ width: 120 }}>
              <div className="progress-bar-fill" style={{
                width: `${Math.min(100, (totalSelected / minutes) * 100)}%`,
                background: totalSelected > minutes ? 'var(--color-rose)' : 'var(--color-accent)',
              }} />
            </div>
          </div>
          <div className="flex flex-col gap-2" style={{ maxHeight: 350, overflowY: 'auto', marginBottom: 16 }}>
            {suggested.map(t => (
              <label
                key={t.id}
                className="flex items-center gap-3 card"
                style={{ padding: '10px 12px', cursor: 'pointer', opacity: selected.has(t.id) ? 1 : 0.5 }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(t.id)}
                  onChange={() => toggle(t.id)}
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                <span style={{ color: priorityConfig[t.priority].color, fontSize: 12 }}>●</span>
                <span style={{ flex: 1, fontSize: 14 }}>{t.title}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {formatMinutes(t.estimatedMinutes || 15)}
                </span>
              </label>
            ))}
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-ghost" onClick={() => setPlanned(false)}>Back</button>
            <button className="btn-primary" onClick={startSession}>Start Session</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
