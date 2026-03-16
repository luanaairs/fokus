'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { formatMinutes } from '@/lib/utils';
import type { Routine, RoutineItem } from '@/types';

interface Props {
  onStartRoutine: (routineId: string) => void;
}

/**
 * ADHD-specific nudge: if a routine is set for the current time of day
 * and hasn't been started within 15 minutes of its expected window,
 * surface a gentle prompt.
 */
export default function RoutineNudge({ onStartRoutine }: Props) {
  const [nudge, setNudge] = useState<{ routine: Routine; totalMinutes: number } | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const check = async () => {
      const hour = new Date().getHours();
      let currentTod: string;
      if (hour < 12) currentTod = 'morning';
      else if (hour < 17) currentTod = 'afternoon';
      else currentTod = 'evening';

      const today = new Date().toISOString().split('T')[0];
      const dayOfWeek = new Date().getDay();
      const allRoutines = await db.routines.toArray();
      const runs = await db.routineRuns.where('date').equals(today).toArray();
      const startedRoutineIds = new Set(runs.map(r => r.routineId));

      // Find routines that should be running now but haven't started
      for (const r of allRoutines) {
        if (dismissed.has(r.id)) continue;
        if (startedRoutineIds.has(r.id)) continue;

        const isForToday = r.isActive || (r.type === 'weekly' && r.weekDays?.includes(dayOfWeek));
        if (!isForToday) continue;

        // Check if it matches current time of day
        if (r.timeOfDay !== currentTod) continue;

        // For timed routines, check if we're past the start time
        if (r.type === 'timed' && r.startTime) {
          const [sh, sm] = r.startTime.split(':').map(Number);
          const startMinutes = sh * 60 + sm;
          const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
          if (nowMinutes < startMinutes + 15) continue; // Not 15 min past start yet
        }

        // Found a routine to nudge about
        const items = await db.routineItems.where('routineId').equals(r.id).toArray();
        const totalMinutes = items.filter(i => i.type !== 'divider').reduce((s, i) => s + i.durationMinutes, 0);
        setNudge({ routine: r, totalMinutes });
        return;
      }
      setNudge(null);
    };

    check();
    const interval = setInterval(check, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [dismissed]);

  if (!nudge) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 900,
      background: 'var(--bg-card)', border: '1px solid var(--color-accent-muted)',
      borderRadius: 'var(--radius-md)', padding: '16px 20px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxWidth: 320,
      animation: 'slideUp 0.3s ease',
    }}>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
          Your {nudge.routine.timeOfDay} routine is waiting
        </span>
        <span style={{ color: 'var(--text-muted)' }}> — {formatMinutes(nudge.totalMinutes)} to complete</span>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
        {nudge.routine.name}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary" onClick={() => { onStartRoutine(nudge.routine.id); setNudge(null); }} style={{ fontSize: 12, padding: '6px 14px' }}>
          Start now
        </button>
        <button className="btn-ghost" onClick={() => {
          setDismissed(prev => new Set(prev).add(nudge.routine.id));
          setNudge(null);
        }} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Later
        </button>
      </div>
    </div>
  );
}
