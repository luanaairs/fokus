'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { db, completeTaskById, recordFocusSession } from '@/lib/db';
import { formatTimer } from '@/lib/utils';
import { useTimer } from '@/hooks/useTimer';
import type { Task } from '@/types';

export default function FocusMode() {
  const { focusMode, setFocusMode, focusTaskId, setFocusTaskId, refresh } = useApp();
  const [task, setTask] = useState<Task | null>(null);
  const timer = useTimer();

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
    const elapsed = (task.estimatedMinutes * 60 || 25 * 60) - timer.secondsLeft;
    await completeTaskById(task.id);
    if (elapsed > 0) await recordFocusSession(task.id, elapsed);
    timer.stop();
    setFocusMode(false);
    setFocusTaskId(null);
    refresh();
  };

  const exitFocus = async () => {
    const totalDuration = task.estimatedMinutes * 60 || 25 * 60;
    const elapsed = totalDuration - timer.secondsLeft;
    if (elapsed > 30) await recordFocusSession(task.id, elapsed);
    timer.stop();
    setFocusMode(false);
    setFocusTaskId(null);
  };

  const progress = timer.progress;
  const circumference = 2 * Math.PI * 90;

  return (
    <div className="focus-overlay">
      <button onClick={exitFocus} style={{
        position: 'absolute', top: 28, right: 28, cursor: 'pointer',
      }} className="btn-secondary">
        Exit Focus Mode
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40, maxWidth: 500 }}>
        <div style={{
          fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em',
          color: 'var(--color-accent)', background: 'var(--color-accent-light)',
          padding: '6px 20px', borderRadius: 'var(--radius-full)',
        }}>
          Focus Mode
        </div>

        {/* Timer Ring */}
        <div style={{ position: 'relative', width: 220, height: 220 }}>
          <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <circle cx="100" cy="100" r="90" fill="none" stroke="var(--bg-input)" strokeWidth="6" />
            <circle
              cx="100" cy="100" r="90" fill="none"
              stroke="var(--color-accent)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress / 100)}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 42, fontWeight: 600, color: 'var(--color-accent)' }}>
              {formatTimer(timer.secondsLeft)}
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 8 }}>
            {task.title}
          </h2>
          {task.description && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 400 }}>
              {task.description}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          {timer.isRunning ? (
            <button className="btn-secondary" onClick={() => timer.pause()}>Pause</button>
          ) : timer.secondsLeft > 0 ? (
            <button className="btn-secondary" onClick={() => timer.resume()}>Resume</button>
          ) : (
            <button className="btn-secondary" onClick={() => timer.start(task.estimatedMinutes * 60 || 25 * 60)}>
              Start Timer
            </button>
          )}
          <button className="btn-primary" onClick={completeTask} style={{ paddingLeft: 24, paddingRight: 24 }}>
            Complete Task
          </button>
        </div>
      </div>
    </div>
  );
}
