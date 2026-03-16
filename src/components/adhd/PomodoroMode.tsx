'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/lib/context';
import { db, awardXP, XP_VALUES } from '@/lib/db';
import { formatTimer, newId, now } from '@/lib/utils';
import type { Task } from '@/types';

type Phase = 'work' | 'short_break' | 'long_break';

const PHASE_DURATIONS: Record<Phase, number> = {
  work: 25 * 60,
  short_break: 5 * 60,
  long_break: 15 * 60,
};

const PHASE_LABELS: Record<Phase, string> = {
  work: 'Focus',
  short_break: 'Short Break',
  long_break: 'Long Break',
};

const PHASE_COLORS: Record<Phase, string> = {
  work: 'var(--color-accent)',
  short_break: 'var(--color-emerald)',
  long_break: 'var(--color-sky)',
};

interface Props {
  open: boolean;
  onClose: () => void;
  taskId?: string;
}

export default function PomodoroMode({ open, onClose, taskId }: Props) {
  const { refresh } = useApp();
  const [task, setTask] = useState<Task | null>(null);
  const [phase, setPhase] = useState<Phase>('work');
  const [secondsLeft, setSecondsLeft] = useState(PHASE_DURATIONS.work);
  const [isRunning, setIsRunning] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [totalWorkSeconds, setTotalWorkSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (taskId) {
      db.tasks.get(taskId).then(t => setTask(t || null));
    } else {
      setTask(null);
    }
  }, [taskId]);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open]);

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const reset = () => {
    clearTimer();
    setIsRunning(false);
    setPhase('work');
    setSecondsLeft(PHASE_DURATIONS.work);
    setCompletedPomodoros(0);
    setTotalWorkSeconds(0);
  };

  const playChime = () => {
    // Use Web Audio API for a simple chime
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch {
      // Audio not available
    }
  };

  const completePhase = useCallback(async () => {
    clearTimer();
    setIsRunning(false);
    playChime();

    if (phase === 'work') {
      const newCount = completedPomodoros + 1;
      setCompletedPomodoros(newCount);

      // Record session
      await db.pomodoroSessions.add({
        id: newId(),
        taskId: task?.id,
        type: 'work',
        duration: PHASE_DURATIONS.work,
        completedAt: now(),
      });

      // Award XP
      await awardXP(XP_VALUES.pomodoroComplete);
      refresh();

      // Decide next break
      if (newCount % 4 === 0) {
        setPhase('long_break');
        setSecondsLeft(PHASE_DURATIONS.long_break);
      } else {
        setPhase('short_break');
        setSecondsLeft(PHASE_DURATIONS.short_break);
      }
    } else {
      // Break over, back to work
      setPhase('work');
      setSecondsLeft(PHASE_DURATIONS.work);
    }
  }, [phase, completedPomodoros, task, refresh]);

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (phase === 'work') {
          setTotalWorkSeconds(t => t + 1);
        }
        if (prev <= 1) {
          completePhase();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return clearTimer;
  }, [isRunning, completePhase, phase]);

  if (!open) return null;

  const totalDuration = PHASE_DURATIONS[phase];
  const progress = totalDuration > 0 ? ((totalDuration - secondsLeft) / totalDuration) : 0;
  const circumference = 2 * Math.PI * 88;
  const color = PHASE_COLORS[phase];

  return (
    <div className="focus-overlay">
      <button onClick={onClose} className="btn-secondary" style={{
        position: 'absolute', top: 28, right: 28,
      }}>
        Exit Pomodoro
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
        {/* Phase badge */}
        <div style={{
          fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em',
          color, background: 'var(--bg-input)',
          padding: '6px 20px', borderRadius: 'var(--radius-full)',
        }}>
          {PHASE_LABELS[phase]}
        </div>

        {/* Tomato counter */}
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{
              width: 24, height: 24, borderRadius: '50%',
              background: i < (completedPomodoros % 4) ? 'var(--color-accent)' : 'var(--bg-input)',
              border: `2px solid ${i < (completedPomodoros % 4) ? 'var(--color-accent)' : 'var(--border-color)'}`,
              transition: 'all 0.3s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: 'white',
            }}>
              {i < (completedPomodoros % 4) ? '🍅' : ''}
            </div>
          ))}
          {completedPomodoros >= 4 && (
            <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 4 }}>
              x{Math.floor(completedPomodoros / 4)}
            </span>
          )}
        </div>

        {/* Timer */}
        <div style={{ position: 'relative', width: 220, height: 220 }}>
          <svg width="220" height="220" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="100" cy="100" r="88" fill="none" stroke="var(--bg-input)" strokeWidth="6" />
            <circle cx="100" cy="100" r="88" fill="none"
              stroke={color} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 42, fontWeight: 600, color,
            }}>
              {formatTimer(secondsLeft)}
            </span>
          </div>
        </div>

        {/* Task name */}
        {task && (
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, textAlign: 'center' }}>
            {task.title}
          </h2>
        )}
        {!task && (
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            Free Pomodoro
          </h2>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', gap: 12 }}>
          {!isRunning ? (
            <button className="btn-primary" onClick={() => setIsRunning(true)} style={{ padding: '12px 32px', fontSize: 15 }}>
              {secondsLeft < totalDuration ? 'Resume' : 'Start'}
            </button>
          ) : (
            <button className="btn-secondary" onClick={() => { clearTimer(); setIsRunning(false); }}>
              Pause
            </button>
          )}
          {phase !== 'work' && (
            <button className="btn-ghost" onClick={() => {
              clearTimer();
              setIsRunning(false);
              setPhase('work');
              setSecondsLeft(PHASE_DURATIONS.work);
            }}>
              Skip Break
            </button>
          )}
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex', gap: 24, color: 'var(--text-muted)', fontSize: 13,
          padding: '12px 24px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)',
        }}>
          <span>Pomodoros: <strong style={{ color: 'var(--text-primary)' }}>{completedPomodoros}</strong></span>
          <span>Focus time: <strong style={{ color: 'var(--text-primary)' }}>{Math.floor(totalWorkSeconds / 60)}m</strong></span>
        </div>
      </div>
    </div>
  );
}
