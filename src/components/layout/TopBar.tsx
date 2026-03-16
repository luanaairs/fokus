'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/db';
import { formatMinutes, formatTimer, todayStart, todayEnd } from '@/lib/utils';
import { useTimer } from '@/hooks/useTimer';
import type { Task } from '@/types';

export default function TopBar() {
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
    <header className="flex items-center justify-between" style={{
      height: 52,
      padding: '0 20px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      fontSize: 13,
    }}>
      <div className="flex items-center gap-4">
        {activeContext.label && (
          <div className="flex items-center gap-2" style={{ color: 'var(--color-accent)' }}>
            <span style={{ fontSize: 10 }}>●</span>
            <span style={{ fontWeight: 600 }}>{activeContext.label}</span>
          </div>
        )}
        <div style={{ color: 'var(--text-muted)' }}>
          {todayTasks.length} tasks remaining · {formatMinutes(totalMinutes)} estimated
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div style={{ color: 'var(--color-emerald)' }}>
          ✓ {completedToday} done today
        </div>

        {timer.isRunning && (
          <div className="flex items-center gap-3" style={{
            background: 'var(--bg-tertiary)',
            padding: '4px 12px',
            borderRadius: 8,
          }}>
            <span className="animate-pulse-slow" style={{ color: 'var(--color-accent)', fontSize: 8 }}>●</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {formatTimer(timer.secondsLeft)}
            </span>
            <span style={{ color: 'var(--text-muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {timerTaskTitle}
            </span>
            <button className="btn-icon" onClick={() => timer.pause()} style={{ padding: 2 }}>⏸</button>
            <button className="btn-icon" onClick={() => {
              if (timerTaskId) {
                setFocusTaskId(timerTaskId);
                setFocusMode(true);
              }
            }} style={{ padding: 2, fontSize: 11 }}>Focus</button>
            <button className="btn-icon" onClick={() => {
              timer.stop();
              setTimerTaskId(null);
              setTimerDuration(0);
            }} style={{ padding: 2 }}>✕</button>
          </div>
        )}
        {!timer.isRunning && timer.secondsLeft > 0 && (
          <div className="flex items-center gap-2" style={{
            background: 'var(--bg-tertiary)',
            padding: '4px 12px',
            borderRadius: 8,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {formatTimer(timer.secondsLeft)} paused
            </span>
            <button className="btn-icon" onClick={() => timer.resume()} style={{ padding: 2 }}>▶</button>
          </div>
        )}
      </div>
    </header>
  );
}
