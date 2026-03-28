'use client';

import React from 'react';
import type { WordCountEntry } from '@/types';

interface Props {
  history: WordCountEntry[];
}

export default function WritingHeatmap({ history }: Props) {
  // Build a map of date → words added that day
  const dailyWords = new Map<string, number>();

  for (let i = 1; i < history.length; i++) {
    const date = new Date(history[i].date).toISOString().split('T')[0];
    const added = Math.max(0, history[i].count - history[i - 1].count);
    dailyWords.set(date, (dailyWords.get(date) || 0) + added);
  }
  // First entry counts as itself
  if (history.length > 0) {
    const date = new Date(history[0].date).toISOString().split('T')[0];
    if (!dailyWords.has(date)) {
      dailyWords.set(date, history[0].count);
    }
  }

  // Generate last 12 weeks of dates
  const weeks: string[][] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let w = 11; w >= 0; w--) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - (w * 7 + (6 - d)));
      week.push(date.toISOString().split('T')[0]);
    }
    weeks.push(week);
  }

  const maxWords = Math.max(1, ...Array.from(dailyWords.values()));

  const getColor = (words: number) => {
    if (words === 0) return 'var(--bg-input)';
    const intensity = Math.min(1, words / maxWords);
    if (intensity < 0.25) return 'var(--color-emerald-light)';
    if (intensity < 0.5) return '#6dd4a0';
    if (intensity < 0.75) return '#3dba7e';
    return 'var(--color-emerald)';
  };

  // Session log from history
  const sessions = history
    .filter(h => h.sessionMinutes && h.sessionMinutes > 0)
    .slice(-5)
    .reverse();

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginBottom: 14 }}>Activity</h3>

      {/* Heatmap grid */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 14, overflowX: 'auto' }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {week.map(date => {
              const words = dailyWords.get(date) || 0;
              const isToday = date === today.toISOString().split('T')[0];
              return (
                <div
                  key={date}
                  title={`${date}: ${words.toLocaleString()} words`}
                  style={{
                    width: 14, height: 14,
                    borderRadius: 3,
                    background: getColor(words),
                    border: isToday ? '2px solid var(--color-accent)' : '1px solid var(--border-light)',
                    cursor: 'default',
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', marginBottom: sessions.length > 0 ? 14 : 0 }}>
        <span>Less</span>
        {['var(--bg-input)', 'var(--color-emerald-light)', '#6dd4a0', '#3dba7e', 'var(--color-emerald)'].map((c, i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: c, border: '1px solid var(--border-light)' }} />
        ))}
        <span>More</span>
        <span style={{ marginLeft: 'auto' }}>Last 12 weeks</span>
      </div>

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recent Sessions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sessions.map((s, i) => {
              const date = new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
              const wordsAdded = i < sessions.length - 1
                ? Math.max(0, s.count - sessions[i + 1]?.count)
                : s.count;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                  padding: '6px 10px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)',
                }}>
                  <span style={{ color: 'var(--text-muted)', width: 50 }}>{date}</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-emerald)' }}>
                    +{wordsAdded.toLocaleString()} words
                  </span>
                  {s.sessionMinutes && (
                    <span style={{ color: 'var(--text-muted)' }}>· {s.sessionMinutes}m</span>
                  )}
                  {s.note && (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {s.note}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
