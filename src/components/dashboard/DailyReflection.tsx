'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { newId, now } from '@/lib/utils';
import type { DailyReflection as ReflectionType } from '@/types';

const MOOD_LABELS = ['Awful', 'Rough', 'Okay', 'Good', 'Great'];
const MOOD_EMOJI = ['😩', '😐', '🙂', '😊', '🔥'];
const ENERGY_LABELS = ['Drained', 'Low', 'Medium', 'High', 'Wired'];

function todayStr() { return new Date().toISOString().split('T')[0]; }

interface Props {
  completedCount: number;
  totalPlanned: number;
}

export default function DailyReflection({ completedCount, totalPlanned }: Props) {
  const [existing, setExisting] = useState<ReflectionType | null>(null);
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [energy, setEnergy] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [wins, setWins] = useState('');
  const [struggles, setStruggles] = useState('');
  const [tomorrowFocus, setTomorrowFocus] = useState('');
  const [saved, setSaved] = useState(false);
  const [recentReflections, setRecentReflections] = useState<ReflectionType[]>([]);

  useEffect(() => {
    db.dailyReflections.where('date').equals(todayStr()).first().then(r => {
      if (r) {
        setExisting(r);
        setMood(r.mood);
        setEnergy(r.energy);
        setWins(r.wins);
        setStruggles(r.struggles);
        setTomorrowFocus(r.tomorrowFocus);
      }
    });
    db.dailyReflections.orderBy('date').reverse().limit(7).toArray().then(setRecentReflections);
  }, []);

  const save = async () => {
    const data: ReflectionType = {
      id: existing?.id || newId(),
      date: todayStr(),
      mood, energy, wins, struggles, tomorrowFocus,
      createdAt: existing?.createdAt || now(),
    };
    await db.dailyReflections.put(data);
    setExisting(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Show the prompt button in the lower part of the dashboard
  if (!open) {
    const pct = totalPlanned > 0 ? Math.round((completedCount / totalPlanned) * 100) : 0;
    const hour = new Date().getHours();
    const isEvening = hour >= 16;
    return (
      <div className="card" style={{
        padding: 16, cursor: 'pointer',
        borderLeft: existing ? '4px solid var(--color-emerald)' : isEvening ? '4px solid var(--color-amber)' : '4px solid var(--border-light)',
      }} onClick={() => setOpen(true)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginBottom: 2 }}>
              {existing ? 'Daily Reflection' : isEvening ? 'Time to reflect?' : 'Daily Reflection'}
            </h3>
            {existing ? (
              <span style={{ fontSize: 12, color: 'var(--color-emerald)' }}>
                {MOOD_EMOJI[existing.mood - 1]} {MOOD_LABELS[existing.mood - 1]} · {ENERGY_LABELS[existing.energy - 1]} energy
              </span>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {totalPlanned > 0 ? `${pct}% done today — ` : ''}How did it go?
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{existing ? 'Edit' : 'Reflect'} →</span>
        </div>
      </div>
    );
  }

  // Reflection form
  return (
    <div className="card" style={{ padding: 24, borderLeft: '4px solid var(--color-amber)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Daily Reflection</h3>
        <button className="btn-icon" onClick={() => setOpen(false)} style={{ color: 'var(--text-muted)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Mood */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Mood
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          {([1, 2, 3, 4, 5] as const).map(v => (
            <button key={v} onClick={() => setMood(v)} style={{
              flex: 1, padding: '10px 4px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
              background: mood === v ? 'var(--color-accent)' : 'var(--bg-input)',
              color: mood === v ? '#fff' : 'var(--text-primary)',
              transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: 20, marginBottom: 2 }}>{MOOD_EMOJI[v - 1]}</div>
              <div style={{ fontSize: 10 }}>{MOOD_LABELS[v - 1]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Energy */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Energy level
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          {([1, 2, 3, 4, 5] as const).map(v => (
            <button key={v} onClick={() => setEnergy(v)} style={{
              flex: 1, padding: '8px 4px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
              background: energy >= v ? energyGradient(v) : 'var(--bg-input)',
              color: energy >= v ? '#fff' : 'var(--text-muted)',
              fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
            }}>
              {ENERGY_LABELS[v - 1]}
            </button>
          ))}
        </div>
      </div>

      {/* Text fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-emerald)', display: 'block', marginBottom: 4 }}>
            Wins — what went well?
          </label>
          <textarea className="textarea" value={wins} onChange={e => setWins(e.target.value)}
            placeholder="Even small wins count..." rows={2} style={{ fontSize: 13 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-rose)', display: 'block', marginBottom: 4 }}>
            Struggles — what was hard?
          </label>
          <textarea className="textarea" value={struggles} onChange={e => setStruggles(e.target.value)}
            placeholder="No judgement, just observations..." rows={2} style={{ fontSize: 13 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-sky)', display: 'block', marginBottom: 4 }}>
            Tomorrow — what should I focus on?
          </label>
          <textarea className="textarea" value={tomorrowFocus} onChange={e => setTomorrowFocus(e.target.value)}
            placeholder="One thing that would make tomorrow a win..." rows={2} style={{ fontSize: 13 }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {saved && <span style={{ fontSize: 12, color: 'var(--color-emerald)' }}>Saved!</span>}
        <div style={{ flex: 1 }} />
        <button className="btn-primary" onClick={save} style={{ fontSize: 13 }}>
          {existing ? 'Update reflection' : 'Save reflection'}
        </button>
      </div>

      {/* Recent reflections mini-view */}
      {recentReflections.length > 1 && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Recent
          </span>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {recentReflections.filter(r => r.date !== todayStr()).slice(0, 6).map(r => (
              <div key={r.id} title={`${r.date}\nMood: ${MOOD_LABELS[r.mood - 1]}\nEnergy: ${ENERGY_LABELS[r.energy - 1]}`}
                style={{
                  padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-input)', fontSize: 11, textAlign: 'center',
                }}>
                <div style={{ fontSize: 16, marginBottom: 2 }}>{MOOD_EMOJI[r.mood - 1]}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                  {new Date(r.date + 'T00:00').toLocaleDateString('en-GB', { weekday: 'short' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function energyGradient(level: number): string {
  const colors = ['#CD9196', '#E2A716', '#6197E8', '#3da37a', '#A2383B'];
  return colors[level - 1] || 'var(--color-accent)';
}
