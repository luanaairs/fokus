'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/db';
import { formatMinutes, formatTimer, todayStart, todayEnd } from '@/lib/utils';
import { useTimer } from '@/hooks/useTimer';
import type { Task } from '@/types';

export default function TopBar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const {
    activeContext, timerTaskId, timerDuration,
    setTimerTaskId, setTimerDuration, setFocusMode, setFocusTaskId,
    refreshKey,
  } = useApp();
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [completedToday, setCompletedToday] = useState(0);
  const [timerTaskTitle, setTimerTaskTitle] = useState('');

  const timer = useTimer(() => {
    setTimerTaskId(null);
    setTimerDuration(0);
  });

  useEffect(() => {
    const start = todayStart();
    const end = todayEnd();
    db.tasks.where('dueDate').between(start, end).toArray().then(tasks => {
      setTodayTasks(tasks.filter(t => t.status !== 'done'));
    });
    db.tasks.where('status').equals('done').toArray().then(tasks => {
      setCompletedToday(tasks.filter(t => t.completedAt && t.completedAt >= start).length);
    });
  }, [refreshKey]);

  useEffect(() => {
    if (timerTaskId && timerDuration > 0) {
      db.tasks.get(timerTaskId).then(t => {
        if (t) setTimerTaskTitle(t.title);
      });
      timer.start(timerDuration * 60);
    }
  }, [timerTaskId, timerDuration]);

  const totalMinutes = todayTasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0);

  return (
    <header style={{
      height: 56,
      padding: '0 28px',
      background: 'var(--bg-card)',
      borderBottom: '1px solid var(--border-light)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 13,
    }}>
      <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {onMenuToggle && (
          <button className="btn-icon mobile-menu-btn" onClick={onMenuToggle} style={{ display: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          </button>
        )}
        {activeContext.label && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--color-accent-light)', color: 'var(--color-accent)',
            padding: '5px 14px', borderRadius: 'var(--radius-full)',
            fontWeight: 600, fontSize: 12,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent)' }} />
            {activeContext.label}
          </div>
        )}
        <span className="topbar-stats" style={{ color: 'var(--text-muted)' }}>
          {todayTasks.length} remaining · {formatMinutes(totalMinutes)}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          color: 'var(--color-emerald)', fontWeight: 600, fontSize: 13,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
          {completedToday} done today
        </div>

        {timer.isRunning && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--color-accent-light)',
            padding: '6px 16px', borderRadius: 'var(--radius-full)',
            border: '1px solid var(--color-accent-muted)',
          }}>
            <span className="animate-pulse-slow" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 14, color: 'var(--color-accent)' }}>
              {formatTimer(timer.secondsLeft)}
            </span>
            <span style={{ color: 'var(--color-accent-hover)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
              {timerTaskTitle}
            </span>
            <button className="btn-icon" onClick={() => timer.pause()} style={{ padding: 2, color: 'var(--color-accent)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
            </button>
            <button className="btn-icon" onClick={() => {
              if (timerTaskId) { setFocusTaskId(timerTaskId); setFocusMode(true); }
            }} style={{ padding: 2, color: 'var(--color-accent)', fontSize: 11, fontWeight: 600 }}>Focus</button>
            <button className="btn-icon" onClick={() => { timer.stop(); setTimerTaskId(null); setTimerDuration(0); }} style={{ padding: 2, color: 'var(--text-muted)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        {!timer.isRunning && timer.secondsLeft > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg-input)', padding: '6px 14px', borderRadius: 'var(--radius-full)',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: 13 }}>
              {formatTimer(timer.secondsLeft)} paused
            </span>
            <button className="btn-icon" onClick={() => timer.resume()} style={{ padding: 2 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
