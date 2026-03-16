'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { useApp } from '@/lib/context';
import Modal from '@/components/shared/Modal';
import { formatMinutes } from '@/lib/utils';
import type { Task } from '@/types';

export default function WeeklyReview() {
  const { refreshKey } = useApp();
  const [open, setOpen] = useState(false);
  const [completed, setCompleted] = useState<Task[]>([]);
  const [rolledOver, setRolledOver] = useState<Task[]>([]);
  const [upcoming, setUpcoming] = useState<Task[]>([]);

  useEffect(() => {
    // Check if it's Friday or if review is due
    const day = new Date().getDay();
    const lastReview = localStorage.getItem('fokus_last_review');
    const today = new Date().toISOString().split('T')[0];
    if (day === 5 && lastReview !== today) {
      loadReviewData();
      setOpen(true);
    }
  }, []);

  const loadReviewData = async () => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const allTasks = await db.tasks.toArray();
    setCompleted(allTasks.filter(t => t.status === 'done' && t.completedAt && t.completedAt >= weekAgo));
    setRolledOver(allTasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < Date.now()));
    setUpcoming(allTasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate >= Date.now() && t.dueDate < Date.now() + 7 * 24 * 60 * 60 * 1000));
  };

  const dismiss = () => {
    localStorage.setItem('fokus_last_review', new Date().toISOString().split('T')[0]);
    setOpen(false);
  };

  const totalMinutes = completed.reduce((s, t) => s + (t.estimatedMinutes || 0), 0);

  return (
    <Modal open={open} onClose={dismiss} title="Weekly Review" wide>
      <div className="flex flex-col gap-6">
        <div className="card" style={{ borderTop: '3px solid var(--color-emerald)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--color-emerald)', marginBottom: 8 }}>
            Completed This Week
          </h3>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{completed.length} tasks</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>~{formatMinutes(totalMinutes)} of focused work</div>
          {completed.length > 0 && (
            <div className="flex flex-col gap-1" style={{ marginTop: 8, maxHeight: 150, overflowY: 'auto' }}>
              {completed.map(t => (
                <div key={t.id} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>✓ {t.title}</div>
              ))}
            </div>
          )}
        </div>

        {rolledOver.length > 0 && (
          <div className="card" style={{ borderTop: '3px solid var(--color-amber)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--color-amber)', marginBottom: 8 }}>
              Rolled Over ({rolledOver.length})
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>These were due but not completed — reschedule or defer?</p>
            <div className="flex flex-col gap-1">
              {rolledOver.map(t => (
                <div key={t.id} style={{ fontSize: 13 }}>• {t.title}</div>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ borderTop: '3px solid var(--color-sky)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--color-sky)', marginBottom: 8 }}>
            Next Week ({upcoming.length})
          </h3>
          {upcoming.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing scheduled yet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {upcoming.map(t => (
                <div key={t.id} style={{ fontSize: 13 }}>• {t.title}</div>
              ))}
            </div>
          )}
        </div>

        <button className="btn-primary" onClick={dismiss} style={{ alignSelf: 'flex-end' }}>Done reviewing</button>
      </div>
    </Modal>
  );
}
