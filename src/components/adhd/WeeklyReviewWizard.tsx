'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { db, awardXP } from '@/lib/db';
import { todayStart, priorityConfig, formatMinutes } from '@/lib/utils';
import type { Task } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = 'welcome' | 'wins' | 'stuck' | 'carryover' | 'goals' | 'done';

export default function WeeklyReviewWizard({ open, onClose }: Props) {
  const { refresh } = useApp();
  const [step, setStep] = useState<Step>('welcome');
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [stuckTasks, setStuckTasks] = useState<Task[]>([]);
  const [carryoverTasks, setCarryoverTasks] = useState<Task[]>([]);
  const [selectedCarryover, setSelectedCarryover] = useState<Set<string>>(new Set());
  const [topGoals, setTopGoals] = useState(['', '', '']);
  const [reflection, setReflection] = useState('');
  const [totalFocusMinutes, setTotalFocusMinutes] = useState(0);

  useEffect(() => {
    if (!open) return;
    setStep('welcome');

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    Promise.all([
      db.tasks.toArray(),
      db.focusSessions.toArray(),
      db.pomodoroSessions.toArray(),
    ]).then(([tasks, focusSessions, pomSessions]) => {
      const completed = tasks.filter(t =>
        t.status === 'done' && t.completedAt && t.completedAt > weekAgo
      );
      setCompletedTasks(completed);

      const stuck = tasks.filter(t =>
        t.status !== 'done' && (
          t.status === 'deferred' ||
          (t.dueDate && t.dueDate < Date.now()) ||
          (t.createdAt < weekAgo && t.status === 'todo')
        )
      );
      setStuckTasks(stuck);

      const active = tasks.filter(t =>
        t.status === 'todo' || t.status === 'in_progress'
      ).sort((a, b) => priorityConfig[a.priority].sortOrder - priorityConfig[b.priority].sortOrder);
      setCarryoverTasks(active.slice(0, 10));

      const weekFocus = focusSessions
        .filter(s => s.startedAt > weekAgo)
        .reduce((sum, s) => sum + (s.duration || 0), 0);
      const weekPom = pomSessions
        .filter(s => s.completedAt > weekAgo)
        .reduce((sum, s) => sum + (s.duration || 0), 0);
      setTotalFocusMinutes(Math.round((weekFocus + weekPom) / 60));
    });
  }, [open]);

  if (!open) return null;

  const toggleCarryover = (id: string) => {
    setSelectedCarryover(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleFinish = async () => {
    // Drop unselected carryover tasks (mark deferred)
    for (const task of carryoverTasks) {
      if (!selectedCarryover.has(task.id)) {
        await db.tasks.update(task.id, { status: 'deferred', deferredUntil: Date.now() + 7 * 24 * 60 * 60 * 1000 });
      }
    }

    // Award XP for completing review
    await awardXP(25);
    refresh();
    setStep('done');
  };

  const steps: Step[] = ['welcome', 'wins', 'stuck', 'carryover', 'goals', 'done'];
  const stepIndex = steps.indexOf(step);
  const progressPct = ((stepIndex) / (steps.length - 1)) * 100;

  return (
    <div className="focus-overlay" style={{ overflow: 'auto' }}>
      <button onClick={onClose} className="btn-secondary" style={{ position: 'absolute', top: 28, right: 28 }}>
        Exit Review
      </button>

      {/* Progress bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--bg-input)' }}>
        <div style={{
          height: '100%', background: 'var(--color-accent)',
          width: `${progressPct}%`, transition: 'width 0.4s ease',
          borderRadius: '0 2px 2px 0',
        }} />
      </div>

      <div style={{ maxWidth: 560, width: '100%', padding: '40px 24px' }}>
        {step === 'welcome' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 8 }}>
              Weekly Review
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 8 }}>
              Let&apos;s look back at your week and set up the next one.
            </p>
            <div style={{
              display: 'flex', gap: 20, justifyContent: 'center', margin: '24px 0',
              color: 'var(--text-secondary)', fontSize: 14,
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontFamily: 'var(--font-display)', color: 'var(--color-emerald)' }}>
                  {completedTasks.length}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>completed</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontFamily: 'var(--font-display)', color: 'var(--color-sky)' }}>
                  {formatMinutes(totalFocusMinutes)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>focused</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontFamily: 'var(--font-display)', color: 'var(--color-amber)' }}>
                  {stuckTasks.length}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>stuck</div>
              </div>
            </div>
            <button className="btn-primary" onClick={() => setStep('wins')} style={{ padding: '12px 32px' }}>
              Let&apos;s Go
            </button>
          </div>
        )}

        {step === 'wins' && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 8, textAlign: 'center' }}>
              This Week&apos;s Wins
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
              You completed {completedTasks.length} task{completedTasks.length !== 1 ? 's' : ''}. Here&apos;s what you shipped:
            </p>
            <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 20 }}>
              {completedTasks.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                  No completed tasks this week — and that&apos;s okay. Fresh start ahead.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {completedTasks.map(t => (
                    <div key={t.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', background: 'var(--color-emerald-light)',
                      borderRadius: 'var(--radius-sm)', fontSize: 13,
                    }}>
                      <span style={{ color: 'var(--color-emerald)' }}>✓</span>
                      <span style={{ textDecoration: 'line-through', opacity: 0.8 }}>{t.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn-ghost" onClick={() => setStep('welcome')}>Back</button>
              <button className="btn-primary" onClick={() => setStep('stuck')}>Next</button>
            </div>
          </div>
        )}

        {step === 'stuck' && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 8, textAlign: 'center' }}>
              What Got Stuck
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
              {stuckTasks.length} task{stuckTasks.length !== 1 ? 's' : ''} need attention. That&apos;s normal.
            </p>
            <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 16 }}>
              {stuckTasks.slice(0, 8).map(t => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 13,
                  background: 'var(--bg-input)', marginBottom: 4,
                }}>
                  <div className="priority-dot" style={{ background: priorityConfig[t.priority].color }} />
                  <span style={{ flex: 1 }}>{t.title}</span>
                  <span className="badge" style={{ fontSize: 10 }}>{t.status}</span>
                </div>
              ))}
            </div>
            <textarea
              className="textarea"
              placeholder="Any thoughts on what blocked you this week? (optional)"
              value={reflection}
              onChange={e => setReflection(e.target.value)}
              rows={3}
              style={{ marginBottom: 16 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn-ghost" onClick={() => setStep('wins')}>Back</button>
              <button className="btn-primary" onClick={() => setStep('carryover')}>Next</button>
            </div>
          </div>
        )}

        {step === 'carryover' && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 8, textAlign: 'center' }}>
              Carry Forward
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
              Select tasks to keep active. Unselected tasks will be deferred.
            </p>
            <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
              {carryoverTasks.map(t => (
                <label key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  background: selectedCarryover.has(t.id) ? 'var(--color-accent-light)' : 'var(--bg-input)',
                  cursor: 'pointer', marginBottom: 4, transition: 'background 0.15s',
                }}>
                  <input
                    type="checkbox"
                    checked={selectedCarryover.has(t.id)}
                    onChange={() => toggleCarryover(t.id)}
                    style={{ accentColor: 'var(--color-accent)' }}
                  />
                  <div className="priority-dot" style={{ background: priorityConfig[t.priority].color }} />
                  <span style={{ flex: 1, fontSize: 13 }}>{t.title}</span>
                  {t.estimatedMinutes > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatMinutes(t.estimatedMinutes)}</span>
                  )}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn-ghost" onClick={() => setStep('stuck')}>Back</button>
              <button className="btn-primary" onClick={() => setStep('goals')}>Next</button>
            </div>
          </div>
        )}

        {step === 'goals' && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 8, textAlign: 'center' }}>
              Next Week&apos;s Top 3
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
              What are the 3 most important things for next week?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {topGoals.map((goal, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-muted)',
                    width: 28, textAlign: 'center',
                  }}>
                    {i + 1}
                  </span>
                  <input
                    className="input"
                    placeholder={`Goal ${i + 1}`}
                    value={goal}
                    onChange={e => {
                      const next = [...topGoals];
                      next[i] = e.target.value;
                      setTopGoals(next);
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn-ghost" onClick={() => setStep('carryover')}>Back</button>
              <button className="btn-primary" onClick={handleFinish}>Finish Review</button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 8 }}>
              Review Complete!
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 8 }}>
              You&apos;re set up for a great week.
            </p>
            <p style={{ color: 'var(--color-accent)', fontSize: 14, fontWeight: 600, marginBottom: 24 }}>
              +25 XP earned
            </p>
            {topGoals.filter(g => g.trim()).length > 0 && (
              <div style={{
                background: 'var(--bg-input)', borderRadius: 'var(--radius-md)',
                padding: 16, marginBottom: 24, textAlign: 'left',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Your Top 3
                </div>
                {topGoals.filter(g => g.trim()).map((g, i) => (
                  <div key={i} style={{ fontSize: 14, padding: '4px 0', display: 'flex', gap: 8 }}>
                    <span style={{ color: 'var(--color-accent)' }}>{i + 1}.</span>
                    <span>{g}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="btn-primary" onClick={onClose} style={{ padding: '12px 32px' }}>
              Let&apos;s Go
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
