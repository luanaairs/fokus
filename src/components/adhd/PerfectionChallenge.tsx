'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '@/lib/context';
import { db, completeTaskById, awardXP, XP_VALUES } from '@/lib/db';
import { formatTimer } from '@/lib/utils';
import type { Task } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  taskId: string;
}

const CHALLENGE_DURATION = 15 * 60; // 15 minutes

export default function PerfectionChallenge({ open, onClose, taskId }: Props) {
  const { refresh } = useApp();
  const [task, setTask] = useState<Task | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(CHALLENGE_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open && taskId) {
      db.tasks.get(taskId).then(t => {
        setTask(t || null);
        setSecondsLeft(CHALLENGE_DURATION);
        setIsRunning(false);
        setIsComplete(false);
        setIsTimeUp(false);
      });
    }
  }, [open, taskId]);

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearTimer();
          setIsRunning(false);
          setIsTimeUp(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return clearTimer;
  }, [isRunning]);

  const handleComplete = async () => {
    if (!task) return;
    await completeTaskById(task.id);
    await awardXP(XP_VALUES.perfectionChallenge, {
      tasksCompleted: (await db.userXP.get('default'))!.tasksCompleted + 1,
    });
    setIsComplete(true);
    setIsRunning(false);
    clearTimer();
    refresh();
  };

  const handleTimeUpComplete = async () => {
    if (!task) return;
    await completeTaskById(task.id);
    await awardXP(XP_VALUES.perfectionChallenge);
    setIsComplete(true);
    refresh();
  };

  if (!open || !task) return null;

  const progress = (CHALLENGE_DURATION - secondsLeft) / CHALLENGE_DURATION;
  const circumference = 2 * Math.PI * 88;
  const isLowTime = secondsLeft <= 60 && secondsLeft > 0;

  return (
    <div className="focus-overlay">
      <button onClick={() => { clearTimer(); onClose(); }} className="btn-secondary" style={{
        position: 'absolute', top: 28, right: 28,
      }}>
        Exit Challenge
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        {/* Header badge */}
        <div style={{
          fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em',
          color: 'var(--color-amber)', background: 'var(--color-amber-light)',
          padding: '6px 20px', borderRadius: 'var(--radius-full)',
        }}>
          Done &gt; Perfect
        </div>

        {isComplete ? (
          /* Victory screen */
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 8 }}>
              Challenge Complete!
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 8 }}>
              Done is better than perfect. You shipped it.
            </p>
            <p style={{ color: 'var(--color-amber)', fontSize: 14, fontWeight: 600, marginBottom: 24 }}>
              +{XP_VALUES.perfectionChallenge} XP earned
            </p>
            <button className="btn-primary" onClick={onClose} style={{ padding: '12px 32px' }}>
              Back to Work
            </button>
          </div>
        ) : isTimeUp ? (
          /* Time's up */
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 8 }}>
              Time&apos;s Up!
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 4 }}>
              &quot;{task.title}&quot;
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
              Whatever you got done — that&apos;s enough. Ship it.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn-ghost" onClick={onClose}>Keep Working</button>
              <button className="btn-primary" onClick={handleTimeUpComplete} style={{ padding: '12px 28px' }}>
                Mark as Done
              </button>
            </div>
          </div>
        ) : (
          /* Active challenge */
          <>
            {/* Timer */}
            <div style={{ position: 'relative', width: 200, height: 200 }}>
              <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="100" cy="100" r="88" fill="none" stroke="var(--bg-input)" strokeWidth="6" />
                <circle cx="100" cy="100" r="88" fill="none"
                  stroke={isLowTime ? 'var(--color-accent)' : 'var(--color-amber)'}
                  strokeWidth="6" strokeLinecap="round"
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
                  fontFamily: 'var(--font-mono)', fontSize: 36, fontWeight: 600,
                  color: isLowTime ? 'var(--color-accent)' : 'var(--text-primary)',
                  animation: isLowTime ? 'pulse 1s ease-in-out infinite' : 'none',
                }}>
                  {formatTimer(secondsLeft)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {isRunning ? 'Just do it.' : 'Ready?'}
                </span>
              </div>
            </div>

            {/* Task */}
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 4 }}>
                {task.title}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                15 minutes. No perfection. Just progress.
              </p>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: 12 }}>
              {!isRunning ? (
                <button className="btn-primary" onClick={() => setIsRunning(true)} style={{ padding: '12px 32px', fontSize: 15 }}>
                  Start Challenge
                </button>
              ) : (
                <>
                  <button className="btn-ghost" onClick={() => { clearTimer(); setIsRunning(false); }}>
                    Pause
                  </button>
                  <button className="btn-primary" onClick={handleComplete} style={{ padding: '12px 28px' }}>
                    Done Early!
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
