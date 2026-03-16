'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/db';
import { formatMinutes, formatTime, todayStart, todayEnd } from '@/lib/utils';
import type { Routine, RoutineItem, RoutineRun, Task } from '@/types';

interface Props {
  onStartRun: (routineId: string) => void;
  onEditRoutine: (routine: Routine) => void;
}

interface RoutineWithItems {
  routine: Routine;
  items: RoutineItem[];
  run?: RoutineRun;
  totalMinutes: number;
  completedCount: number;
}

const timeOfDayOrder: Record<string, number> = { morning: 0, afternoon: 1, evening: 2, custom: 1.5 };
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6:00 to 21:00

export default function DayView({ onStartRun, onEditRoutine }: Props) {
  const { refreshKey } = useApp();
  const [activeRoutines, setActiveRoutines] = useState<RoutineWithItems[]>([]);
  const [timedRoutines, setTimedRoutines] = useState<RoutineWithItems[]>([]);
  const [flexibleRoutines, setFlexibleRoutines] = useState<RoutineWithItems[]>([]);
  const [dueTasks, setDueTasks] = useState<Task[]>([]);
  const [dailyCapacity, setDailyCapacity] = useState(420); // 7h default

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split('T')[0];
      const dayOfWeek = new Date().getDay();

      // Get all active routines (or weekly routines for today's day)
      const allRoutines = await db.routines.toArray();
      const todayRoutines = allRoutines.filter(r => {
        if (r.isActive) return true;
        if (r.type === 'weekly' && r.weekDays?.includes(dayOfWeek)) return true;
        return false;
      });

      const allRuns = await db.routineRuns.where('date').equals(today).toArray();
      const runMap = new Map(allRuns.map(r => [r.routineId, r]));

      const withItems: RoutineWithItems[] = await Promise.all(
        todayRoutines.map(async r => {
          const items = await db.routineItems.where('routineId').equals(r.id).toArray();
          const sorted = items.sort((a, b) => a.sortOrder - b.sortOrder);
          const run = runMap.get(r.id);
          const completedCount = run ? run.itemStates.filter(s => s.status === 'done').length : 0;
          const totalMinutes = sorted.filter(i => i.type !== 'divider').reduce((s, i) => s + i.durationMinutes, 0);
          return { routine: r, items: sorted, run, totalMinutes, completedCount };
        })
      );

      const timed = withItems.filter(r => r.routine.type === 'timed').sort((a, b) => (a.routine.startTime || '').localeCompare(b.routine.startTime || ''));
      const flexible = withItems.filter(r => r.routine.type === 'flexible');
      const fixed = withItems.filter(r => r.routine.type !== 'timed' && r.routine.type !== 'flexible')
        .sort((a, b) => (timeOfDayOrder[a.routine.timeOfDay] || 0) - (timeOfDayOrder[b.routine.timeOfDay] || 0));

      setTimedRoutines(timed);
      setFlexibleRoutines(flexible);
      setActiveRoutines(fixed);

      // Get tasks due today not in any routine
      const allItems = await db.routineItems.toArray();
      const linkedTaskIds = new Set(allItems.filter(i => i.linkedTaskId).map(i => i.linkedTaskId!));
      const tasks = await db.tasks.where('dueDate').between(todayStart(), todayEnd()).toArray();
      setDueTasks(tasks.filter(t => t.status !== 'done' && !linkedTaskIds.has(t.id)));

      // Load capacity from settings
      const settings = await db.settings.get('default');
      if (settings?.dailyCapacityMinutes) setDailyCapacity(settings.dailyCapacityMinutes);
    };
    load();
  }, [refreshKey]);

  const totalScheduled = [...activeRoutines, ...timedRoutines, ...flexibleRoutines].reduce((s, r) => s + r.totalMinutes, 0);
  const capacityPct = Math.min(100, (totalScheduled / dailyCapacity) * 100);
  const isOverLoaded = totalScheduled > dailyCapacity;

  return (
    <div className="page-content" style={{ padding: '24px 28px', maxWidth: 1100 }}>
      <div className="header-with-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>Today</h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </div>

      {/* Today's Load */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Today&apos;s load</span>
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: isOverLoaded ? 'var(--color-rose)' : 'var(--text-primary)',
          }}>
            {formatMinutes(totalScheduled)} of {formatMinutes(dailyCapacity)}
          </span>
        </div>
        <div className="progress-bar" style={{ height: 8 }}>
          <div className="progress-bar-fill" style={{
            width: `${capacityPct}%`,
            background: isOverLoaded ? 'var(--color-rose)' : capacityPct > 80 ? 'var(--color-amber)' : 'var(--color-accent)',
          }} />
        </div>
        {isOverLoaded && (
          <div style={{ fontSize: 12, color: 'var(--color-rose)', marginTop: 6 }}>
            Over-scheduled by {formatMinutes(totalScheduled - dailyCapacity)} — consider deferring or removing items
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }} className="grid-main-side">
        {/* Main column: timeline + fixed routines */}
        <div>
          {/* Fixed routines by time of day */}
          {activeRoutines.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              {activeRoutines.map(r => (
                <RoutineBlock key={r.routine.id} data={r} onStart={onStartRun} onEdit={onEditRoutine} />
              ))}
            </div>
          )}

          {/* Time-blocked timeline */}
          {timedRoutines.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginBottom: 12 }}>Timeline</h3>
              <div style={{ position: 'relative', paddingLeft: 60 }}>
                {HOURS.map(hour => (
                  <div key={hour} style={{
                    height: 60, borderTop: '1px solid var(--border-light)',
                    position: 'relative',
                  }}>
                    <span style={{
                      position: 'absolute', left: -55, top: -8,
                      fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
                    }}>
                      {String(hour).padStart(2, '0')}:00
                    </span>
                  </div>
                ))}
                {/* Render timed blocks */}
                {timedRoutines.map(r => {
                  if (!r.routine.startTime) return null;
                  const [h, m] = r.routine.startTime.split(':').map(Number);
                  const startOffset = (h - 6) * 60 + m;
                  const top = startOffset;
                  const height = Math.max(30, r.totalMinutes);
                  return (
                    <div key={r.routine.id} style={{
                      position: 'absolute', left: 0, right: 0,
                      top, height, padding: '6px 12px',
                      background: 'var(--color-accent-light)',
                      borderLeft: '3px solid var(--color-accent)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer', overflow: 'hidden',
                    }} onClick={() => onStartRun(r.routine.id)}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{r.routine.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {r.routine.startTime} · {formatMinutes(r.totalMinutes)}
                        {r.run && ` · ${r.completedCount}/${r.items.filter(i => i.type !== 'divider').length} done`}
                      </div>
                    </div>
                  );
                })}
                {/* Current time indicator */}
                {(() => {
                  const now = new Date();
                  const currentMinutes = (now.getHours() - 6) * 60 + now.getMinutes();
                  if (currentMinutes < 0 || currentMinutes > 16 * 60) return null;
                  return (
                    <div style={{
                      position: 'absolute', left: -8, right: 0, top: currentMinutes,
                      height: 2, background: 'var(--color-rose)', zIndex: 5,
                    }}>
                      <div style={{
                        position: 'absolute', left: -4, top: -4,
                        width: 10, height: 10, borderRadius: '50%',
                        background: 'var(--color-rose)',
                      }} />
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Unscheduled tasks due today */}
          {dueTasks.length > 0 && (
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginBottom: 12 }}>
                Due today (unscheduled)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {dueTasks.map(t => (
                  <div key={t.id} className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      color: { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' }[t.priority],
                      fontSize: 10,
                    }}>●</span>
                    <span style={{ flex: 1, fontSize: 13 }}>{t.title}</span>
                    {t.estimatedMinutes > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatMinutes(t.estimatedMinutes)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeRoutines.length === 0 && timedRoutines.length === 0 && dueTasks.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <p style={{ fontSize: 14 }}>No routines active for today.</p>
              <p style={{ fontSize: 13 }}>Set a routine as active or create a weekly routine to see it here.</p>
            </div>
          )}
        </div>

        {/* Side panel: flexible queues */}
        <div>
          {flexibleRoutines.length > 0 && (
            <>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginBottom: 12 }}>Queues</h3>
              {flexibleRoutines.map(r => (
                <RoutineBlock key={r.routine.id} data={r} onStart={onStartRun} onEdit={onEditRoutine} compact />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RoutineBlock({ data, onStart, onEdit, compact }: {
  data: RoutineWithItems;
  onStart: (id: string) => void;
  onEdit: (routine: Routine) => void;
  compact?: boolean;
}) {
  const { routine, items, run, totalMinutes, completedCount } = data;
  const totalSteps = items.filter(i => i.type !== 'divider').length;
  const progress = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;
  const isStarted = !!run;
  const isDone = run?.completedAt;

  const todLabel = routine.timeOfDay === 'custom' ? routine.customLabel : routine.timeOfDay;

  return (
    <div className="card" style={{ padding: compact ? '12px 14px' : '16px 20px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: compact ? 4 : 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: compact ? 14 : 16 }}>{routine.name}</span>
            {!compact && (
              <span className="badge" style={{ fontSize: 10 }}>{todLabel}</span>
            )}
            {isDone && <span style={{ fontSize: 11, color: 'var(--color-emerald)' }}>✓ Complete</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {totalSteps} steps · {formatMinutes(totalMinutes)}
            {isStarted && !isDone && ` · ${completedCount}/${totalSteps} done`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {!compact && (
            <button className="btn-ghost" onClick={() => onEdit(routine)} style={{ fontSize: 11, padding: '4px 8px' }}>Edit</button>
          )}
          {!isDone && (
            <button className="btn-primary" onClick={() => onStart(routine.id)} style={{ fontSize: 12, padding: '6px 14px' }}>
              {isStarted ? 'Continue' : 'Start'}
            </button>
          )}
        </div>
      </div>
      {isStarted && !isDone && (
        <div className="progress-bar" style={{ height: 4 }}>
          <div className="progress-bar-fill" style={{ width: `${progress}%`, background: 'var(--color-accent)' }} />
        </div>
      )}
    </div>
  );
}
