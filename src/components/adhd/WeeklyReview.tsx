'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import Modal from '@/components/shared/Modal';
import { formatMinutes } from '@/lib/utils';
import type { Task } from '@/types';

export default function WeeklyReview() {
  const [open, setOpen] = useState(false);
  const [completed, setCompleted] = useState<Task[]>([]);
  const [rolledOver, setRolledOver] = useState<Task[]>([]);
  const [upcoming, setUpcoming] = useState<Task[]>([]);

  useEffect(() => {
    const day = new Date().getDay();
    const lastReview = localStorage.getItem('fokus_last_review');
    const today = new Date().toISOString().split('T')[0];
    db.settings.get('main').then(settings => {
      const reviewDay = settings?.weeklyReviewDay ?? 5;
      if (day === reviewDay && lastReview !== today) {
        loadReviewData();
        setOpen(true);
      }
    });
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Completed */}
        <div className="card" style={{ borderLeft: '4px solid var(--color-emerald)', background: 'var(--color-emerald-light)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--color-emerald)', marginBottom: 8 }}>
            Completed This Week
          </h3>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 4, color: 'var(--color-emerald)' }}>{completed.length} tasks</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>~{formatMinutes(totalMinutes)} of focused work</div>
          {completed.length > 0 && (
            <div style={{ marginTop: 12, maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {completed.map(t => (
                <div key={t.id} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-emerald)" strokeWidth="2.5" strokeLinecap="round" style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }}><path d="M20 6L9 17l-5-5" /></svg>
                  {t.title}
                </div>
              ))}
            </div>
          )}
        </div>

        {rolledOver.length > 0 && (
          <div className="card" style={{ borderLeft: '4px solid var(--color-amber)', background: 'var(--color-amber-light)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--color-amber)', marginBottom: 8 }}>
              Rolled Over ({rolledOver.length})
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Overdue — reschedule or defer?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {rolledOver.map(t => <div key={t.id} style={{ fontSize: 13 }}>· {t.title}</div>)}
            </div>
          </div>
        )}

        <div className="card" style={{ borderLeft: '4px solid var(--color-sky)', background: 'var(--color-sky-light)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--color-sky)', marginBottom: 8 }}>
            Next Week ({upcoming.length})
          </h3>
          {upcoming.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing scheduled yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {upcoming.map(t => <div key={t.id} style={{ fontSize: 13 }}>· {t.title}</div>)}
            </div>
          )}
        </div>

        <button className="btn-primary" onClick={dismiss} style={{ alignSelf: 'flex-end' }}>Done reviewing</button>
      </div>
    </Modal>
  );
}
