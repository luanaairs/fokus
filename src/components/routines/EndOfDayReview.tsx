'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/db';
import { formatMinutes, now } from '@/lib/utils';
import type { Routine, RoutineItem, RoutineRun, RoutineRunItemState } from '@/types';
import Modal from '@/components/shared/Modal';

export default function EndOfDayReview() {
  const { refresh } = useApp();
  const [open, setOpen] = useState(false);
  const [completed, setCompleted] = useState<{ title: string; minutes: number }[]>([]);
  const [incomplete, setIncomplete] = useState<{ itemId: string; title: string; routineId: string }[]>([]);
  const [tomorrowRoutines, setTomorrowRoutines] = useState<Routine[]>([]);
  const [totalMinutesWorked, setTotalMinutesWorked] = useState(0);

  useEffect(() => {
    // Check if it's time for end-of-day review
    const checkTime = async () => {
      const settings = await db.settings.get('default');
      const reviewTime = settings?.endOfDayTime || '17:00';
      const now = new Date();
      const [h, m] = reviewTime.split(':').map(Number);
      const lastReview = localStorage.getItem('fokus_last_eod_review');
      const today = now.toISOString().split('T')[0];

      if (now.getHours() >= h && now.getMinutes() >= m && lastReview !== today) {
        await loadReviewData();
        setOpen(true);
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const loadReviewData = async () => {
    const today = new Date().toISOString().split('T')[0];
    const runs = await db.routineRuns.where('date').equals(today).toArray();
    const allItems = await db.routineItems.toArray();
    const itemMap = new Map(allItems.map(i => [i.id, i]));

    const completedList: { title: string; minutes: number }[] = [];
    const incompleteList: { itemId: string; title: string; routineId: string }[] = [];
    let totalMins = 0;

    for (const run of runs) {
      const doneStates = run.itemStates.filter(s => s.status === 'done');
      for (const state of doneStates) {
        const item = itemMap.get(state.itemId);
        if (item) {
          completedList.push({ title: item.title, minutes: item.durationMinutes });
          totalMins += Math.round(state.elapsedSeconds / 60);
        }
      }

      // Find incomplete items (not done, not skipped)
      const routineItems = allItems.filter(i => i.routineId === run.routineId && i.type !== 'divider');
      const stateMap = new Map(run.itemStates.map(s => [s.itemId, s]));
      for (const item of routineItems) {
        const state = stateMap.get(item.id);
        if (!state || state.status === 'pending') {
          incompleteList.push({ itemId: item.id, title: item.title, routineId: run.routineId });
        }
      }
    }

    setCompleted(completedList);
    setIncomplete(incompleteList);
    setTotalMinutesWorked(totalMins);

    // Tomorrow's routines
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = tomorrow.getDay();
    const allRoutines = await db.routines.toArray();
    const tRoutines = allRoutines.filter(r => {
      if (r.type === 'weekly' && r.weekDays?.includes(tomorrowDay)) return true;
      if (r.isActive) return true;
      return false;
    });
    setTomorrowRoutines(tRoutines);
  };

  const dismiss = async () => {
    localStorage.setItem('fokus_last_eod_review', new Date().toISOString().split('T')[0]);
    setOpen(false);
  };

  const deferItem = async (itemId: string) => {
    // Remove from incomplete list — the item stays in the routine for next run
    setIncomplete(prev => prev.filter(i => i.itemId !== itemId));
  };

  const sendToBacklog = async (itemId: string, title: string) => {
    // Create a task from the incomplete item
    await db.tasks.add({
      id: (await import('@/lib/utils')).newId(),
      title, description: '', priority: 'medium', status: 'todo',
      contextTag: '', estimatedMinutes: 25, isRecurring: false,
      createdAt: now(), updatedAt: now(),
    });
    setIncomplete(prev => prev.filter(i => i.itemId !== itemId));
    refresh();
  };

  const resetRoutines = async () => {
    // Mark all active routine runs as historical — tomorrow starts fresh
    // The run system already creates new runs per day, so no action needed
    dismiss();
  };

  return (
    <Modal open={open} onClose={dismiss} title="End of Day" wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* What got done */}
        <div className="card" style={{ borderLeft: '4px solid var(--color-emerald)', background: 'var(--color-emerald-light)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--color-emerald)', marginBottom: 8 }}>
            Completed
          </h3>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--color-emerald)', marginBottom: 4 }}>
            {completed.length} steps
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
            ~{formatMinutes(totalMinutesWorked)} of routine time
          </div>
          {completed.length > 0 && (
            <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {completed.map((c, i) => (
                <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--color-emerald)' }}>✓</span> {c.title}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* What rolled over */}
        {incomplete.length > 0 && (
          <div className="card" style={{ borderLeft: '4px solid var(--color-amber)', background: 'var(--color-amber-light)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--color-amber)', marginBottom: 8 }}>
              Not completed ({incomplete.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {incomplete.map(item => (
                <div key={item.itemId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ fontSize: 13 }}>· {item.title}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-ghost" onClick={() => deferItem(item.itemId)} style={{ fontSize: 11, padding: '3px 8px' }}>
                      Tomorrow
                    </button>
                    <button className="btn-ghost" onClick={() => sendToBacklog(item.itemId, item.title)} style={{ fontSize: 11, padding: '3px 8px' }}>
                      Backlog
                    </button>
                    <button className="btn-ghost" onClick={() => setIncomplete(prev => prev.filter(i => i.itemId !== item.itemId))} style={{ fontSize: 11, padding: '3px 8px', color: 'var(--text-muted)' }}>
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tomorrow preview */}
        {tomorrowRoutines.length > 0 && (
          <div className="card" style={{ borderLeft: '4px solid var(--color-sky)', background: 'var(--color-sky-light)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--color-sky)', marginBottom: 8 }}>
              Tomorrow
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {tomorrowRoutines.map(r => (
                <div key={r.id} style={{ fontSize: 13 }}>
                  · {r.name}
                  <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                    ({r.timeOfDay === 'custom' ? r.customLabel : r.timeOfDay})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button className="btn-primary" onClick={resetRoutines} style={{ alignSelf: 'flex-end' }}>
          Close out today
        </button>
      </div>
    </Modal>
  );
}
