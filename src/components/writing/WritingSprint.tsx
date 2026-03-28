'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '@/lib/context';
import { db, awardXP, XP_VALUES } from '@/lib/db';
import { formatTimer, now } from '@/lib/utils';
import type { WritingProject } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  project: WritingProject;
}

const SPRINT_DURATIONS = [
  { label: '15 min', seconds: 15 * 60 },
  { label: '30 min', seconds: 30 * 60 },
  { label: '45 min', seconds: 45 * 60 },
  { label: '60 min', seconds: 60 * 60 },
];

export default function WritingSprint({ open, onClose, project }: Props) {
  const { refresh } = useApp();
  const [phase, setPhase] = useState<'setup' | 'running' | 'log'>('setup');
  const [duration, setDuration] = useState(SPRINT_DURATIONS[1].seconds);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [wordsAdded, setWordsAdded] = useState('');
  const [sprintNote, setSprintNote] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) {
      setPhase('setup');
      setIsRunning(false);
      setWordsAdded('');
      setSprintNote('');
      setElapsedSeconds(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [open]);

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setElapsedSeconds(e => e + 1);
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearTimer();
          setIsRunning(false);
          setPhase('log');
          // Play chime
          try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = 600; osc.type = 'sine';
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
            osc.start(); osc.stop(ctx.currentTime + 1);
          } catch {}
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return clearTimer;
  }, [isRunning]);

  const startSprint = () => {
    setSecondsLeft(duration);
    setElapsedSeconds(0);
    setIsRunning(true);
    setPhase('running');
  };

  const endEarly = () => {
    clearTimer();
    setIsRunning(false);
    setPhase('log');
  };

  const logWords = async () => {
    const added = parseInt(wordsAdded) || 0;
    if (added > 0) {
      const newCount = project.currentWordCount + added;
      const history = [...(project.wordCountHistory || []), {
        date: now(),
        count: newCount,
        sessionMinutes: Math.round(elapsedSeconds / 60),
        note: sprintNote || undefined,
      }];
      await db.writingProjects.update(project.id, {
        currentWordCount: newCount,
        wordCountHistory: history,
        updatedAt: now(),
      } as any);
      await awardXP(XP_VALUES.pomodoroComplete); // reuse pomo XP for sprints
    }
    refresh();
    onClose();
  };

  if (!open) return null;

  const progress = duration > 0 ? (duration - secondsLeft) / duration : 0;
  const circumference = 2 * Math.PI * 88;

  return (
    <div className="focus-overlay">
      <button onClick={() => { clearTimer(); onClose(); }} className="btn-secondary" style={{
        position: 'absolute', top: 28, right: 28,
      }}>
        Exit Sprint
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <div style={{
          fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em',
          color: 'var(--color-sky)', background: 'var(--color-sky-light)',
          padding: '6px 20px', borderRadius: 'var(--radius-full)',
        }}>
          Writing Sprint
        </div>

        {phase === 'setup' && (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 4 }}>
              {project.title}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
              Pick your sprint length and start writing.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
              {SPRINT_DURATIONS.map(d => (
                <button
                  key={d.seconds}
                  className={duration === d.seconds ? 'btn-primary' : 'btn-ghost'}
                  onClick={() => setDuration(d.seconds)}
                  style={{ padding: '10px 20px' }}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <button className="btn-primary" onClick={startSprint} style={{ padding: '14px 40px', fontSize: 16 }}>
              Start Sprint
            </button>
          </div>
        )}

        {phase === 'running' && (
          <>
            {/* Timer */}
            <div style={{ position: 'relative', width: 200, height: 200 }}>
              <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="100" cy="100" r="88" fill="none" stroke="var(--bg-input)" strokeWidth="6" />
                <circle cx="100" cy="100" r="88" fill="none"
                  stroke="var(--color-sky)" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - progress)}
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 36, fontWeight: 600, color: 'var(--color-sky)' }}>
                  {formatTimer(secondsLeft)}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>remaining</span>
              </div>
            </div>

            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, textAlign: 'center' }}>
              Keep writing...
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              {project.title} · {Math.round(elapsedSeconds / 60)}m elapsed
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
              {isRunning ? (
                <button className="btn-ghost" onClick={() => { clearTimer(); setIsRunning(false); }}>Pause</button>
              ) : (
                <button className="btn-ghost" onClick={() => setIsRunning(true)}>Resume</button>
              )}
              <button className="btn-primary" onClick={endEarly}>Done Writing</button>
            </div>
          </>
        )}

        {phase === 'log' && (
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✍️</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 4 }}>
              Sprint Complete!
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
              {Math.round(elapsedSeconds / 60)} minutes of writing. How many words did you add?
            </p>

            <input
              type="number"
              className="input"
              placeholder="Words added this session"
              value={wordsAdded}
              onChange={e => setWordsAdded(e.target.value)}
              autoFocus
              style={{ textAlign: 'center', fontSize: 20, marginBottom: 10 }}
            />
            <input
              className="input"
              placeholder="Quick note about this session (optional)"
              value={sprintNote}
              onChange={e => setSprintNote(e.target.value)}
              style={{ marginBottom: 20, fontSize: 13 }}
            />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn-ghost" onClick={() => { refresh(); onClose(); }}>Skip</button>
              <button className="btn-primary" onClick={logWords} style={{ padding: '12px 32px' }}>
                Log Words
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
