'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/db';
import { formatTimer, now } from '@/lib/utils';
import { useTimer } from '@/hooks/useTimer';
import type { Task } from '@/types';

export default function FocusMode() {
  const { focusMode, setFocusMode, focusTaskId, setFocusTaskId, refresh } = useApp();
  const [task, setTask] = useState<Task | null>(null);
  const timer = useTimer(() => {
    // Timer complete
  });

  useEffect(() => {
    if (focusTaskId) {
      db.tasks.get(focusTaskId).then(t => {
        if (t) {
          setTask(t);
          if (!timer.isRunning && t.estimatedMinutes > 0) {
            timer.start(t.estimatedMinutes * 60);
          }
        }
      });
    }
  }, [focusTaskId]);

  if (!focusMode || !task) return null;

  const completeTask = async () => {
    await db.tasks.update(task.id, { status: 'done', completedAt: now() });
    timer.stop();
    setFocusMode(false);
    setFocusTaskId(null);
    refresh();
  };

  const exitFocus = () => {
    timer.stop();
    setFocusMode(false);
    setFocusTaskId(null);
  };

  const progress = timer.progress;

  return (
    <div className="focus-overlay">
      <button
        onClick={exitFocus}
        style={{
          position: 'absolute', top: 24, right: 24,
          background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)', padding: '8px 16px', borderRadius: 8,
          cursor: 'pointer', fontSize: 13,
        }}
      >
        Exit Focus Mode
      </button>

      <div className="flex flex-col items-center gap-8" style={{ maxWidth: 500 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600 }}>
          Focus Mode
        </div>

        <div className="timer-ring">
          <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: -4, width: 'calc(100% + 8px)', height: 'calc(100% + 8px)', transform: 'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r="48" fill="none" stroke="var(--bg-tertiary)" strokeWidth="3" />
            <circle
              cx="50" cy="50" r="48" fill="none"
              stroke="var(--color-accent)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 48}`}
              strokeDashoffset={`${2 * Math.PI * 48 * (1 - progress / 100)}`}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 36, fontWeight: 700, color: 'var(--color-accent)' }}>
            {formatTimer(timer.secondsLeft)}
          </span>
        </div>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, textAlign: 'center' }}>
          {task.title}
        </h2>
        {task.description && (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 400 }}>
            {task.description}
          </p>
        )}

        <div className="flex gap-3">
          {timer.isRunning ? (
            <button className="btn-ghost" onClick={() => timer.pause()}>⏸ Pause</button>
          ) : timer.secondsLeft > 0 ? (
            <button className="btn-ghost" onClick={() => timer.resume()}>▶ Resume</button>
          ) : (
            <button className="btn-ghost" onClick={() => timer.start(task.estimatedMinutes * 60 || 25 * 60)}>
              ⏱ Start Timer
            </button>
          )}
          <button className="btn-primary" onClick={completeTask}>✓ Complete Task</button>
        </div>
      </div>
    </div>
  );
}
