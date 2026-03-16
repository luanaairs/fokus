'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/lib/context';
import { db, completeTaskById } from '@/lib/db';
import { newId, now, formatMinutes, formatTimer } from '@/lib/utils';
import type { Routine, RoutineItem, RoutineRun, RoutineRunItemState, RoutineItemStatus, Task } from '@/types';
import Modal from '@/components/shared/Modal';

interface Props {
  routineId: string;
  onExit: () => void;
}

export default function RoutineRunner({ routineId, onExit }: Props) {
  const { refresh, refreshKey, setActiveRoutine } = useApp();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [run, setRun] = useState<RoutineRun | null>(null);
  const [itemStates, setItemStates] = useState<Map<string, RoutineRunItemState>>(new Map());
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showInsert, setShowInsert] = useState(false);
  const [insertTitle, setInsertTitle] = useState('');
  const [insertDuration, setInsertDuration] = useState(15);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load routine data
  useEffect(() => {
    const load = async () => {
      const r = await db.routines.get(routineId);
      if (!r) return;
      setRoutine(r);
      const allItems = await db.routineItems.where('routineId').equals(routineId).toArray();
      const sorted = allItems.sort((a, b) => a.sortOrder - b.sortOrder);
      setItems(sorted);

      // Check for existing run today
      const today = new Date().toISOString().split('T')[0];
      const existingRuns = await db.routineRuns.where('routineId').equals(routineId).toArray();
      const todayRun = existingRuns.find(r => r.date === today);

      if (todayRun) {
        setRun(todayRun);
        const stateMap = new Map(todayRun.itemStates.map(s => [s.itemId, s]));
        setItemStates(stateMap);
        // Find current active item
        const activeState = todayRun.itemStates.find(s => s.status === 'active');
        if (activeState) {
          setActiveItemId(activeState.itemId);
          setTimerSeconds(activeState.elapsedSeconds || 0);
        } else {
          // Find first pending item
          const firstPending = sorted.find(i => i.type !== 'divider' && !stateMap.has(i.id));
          if (firstPending) startItem(firstPending.id, stateMap, sorted);
        }
      } else {
        // Create new run
        const newRun: RoutineRun = {
          id: newId(), routineId, date: today,
          startedAt: now(), itemStates: [],
        };
        await db.routineRuns.add(newRun);
        setRun(newRun);
        // Start first non-divider item
        const first = sorted.find(i => i.type !== 'divider');
        if (first) startItem(first.id, new Map(), sorted);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routineId]);

  // Timer tick
  useEffect(() => {
    if (activeItemId && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeItemId, isPaused]);

  // Update TopBar active routine indicator
  useEffect(() => {
    if (routine && activeItemId) {
      const activeItem = items.find(i => i.id === activeItemId);
      const remaining = items
        .filter(i => i.type !== 'divider')
        .filter(i => {
          const s = itemStates.get(i.id);
          return !s || s.status === 'pending' || s.status === 'active';
        })
        .reduce((sum, i) => sum + i.durationMinutes, 0);
      setActiveRoutine({
        routineId: routine.id,
        routineName: routine.name,
        currentStep: activeItem?.title,
        remainingMinutes: remaining,
      });
    } else if (routine && !activeItemId) {
      setActiveRoutine(null);
    }
    return () => setActiveRoutine(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routine, activeItemId, itemStates]);

  // Persist run state periodically
  useEffect(() => {
    if (!run) return;
    const interval = setInterval(() => persistRun(), 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, itemStates, activeItemId, timerSeconds]);

  const persistRun = useCallback(async () => {
    if (!run) return;
    const states = Array.from(itemStates.values()).map(s => {
      if (s.itemId === activeItemId) {
        return { ...s, elapsedSeconds: timerSeconds };
      }
      return s;
    });
    await db.routineRuns.update(run.id, { itemStates: states });
  }, [run, itemStates, activeItemId, timerSeconds]);

  const startItem = (itemId: string, currentStates: Map<string, RoutineRunItemState>, currentItems: RoutineItem[]) => {
    const state: RoutineRunItemState = {
      itemId, status: 'active', startedAt: now(), elapsedSeconds: 0,
    };
    const newStates = new Map(currentStates);
    newStates.set(itemId, state);
    setItemStates(newStates);
    setActiveItemId(itemId);
    setTimerSeconds(0);
    setIsPaused(false);
  };

  const completeCurrentItem = async () => {
    if (!activeItemId) return;
    const item = items.find(i => i.id === activeItemId);
    if (!item) return;

    // Mark as done
    const state = itemStates.get(activeItemId);
    const updatedState: RoutineRunItemState = {
      ...state!, status: 'done', completedAt: now(), elapsedSeconds: timerSeconds,
    };
    const newStates = new Map(itemStates);
    newStates.set(activeItemId, updatedState);
    setItemStates(newStates);

    // If linked task, complete in task system
    if (item.type === 'linked_task' && item.linkedTaskId) {
      await completeTaskById(item.linkedTaskId);
    }

    // Move to next item
    moveToNext(activeItemId, newStates);
    await persistRun();
    refresh();
  };

  const skipItem = () => {
    if (!activeItemId) return;
    const state = itemStates.get(activeItemId);
    const updatedState: RoutineRunItemState = {
      ...state!, status: 'skipped', elapsedSeconds: timerSeconds,
    };
    const newStates = new Map(itemStates);
    newStates.set(activeItemId, updatedState);
    setItemStates(newStates);
    moveToNext(activeItemId, newStates);
  };

  const moveToNext = (currentId: string, states: Map<string, RoutineRunItemState>) => {
    const currentIdx = items.findIndex(i => i.id === currentId);
    const remaining = items.slice(currentIdx + 1).filter(i => i.type !== 'divider');
    const nextItem = remaining.find(i => {
      const s = states.get(i.id);
      return !s || s.status === 'pending';
    });
    if (nextItem) {
      startItem(nextItem.id, states, items);
    } else {
      // Routine complete
      setActiveItemId(null);
      if (timerRef.current) clearInterval(timerRef.current);
      if (run) {
        db.routineRuns.update(run.id, {
          completedAt: now(),
          itemStates: Array.from(states.values()),
        });
      }
    }
  };

  const togglePause = () => {
    setIsPaused(p => !p);
  };

  const insertOnTheFly = async () => {
    if (!insertTitle.trim() || !activeItemId) return;
    const currentIdx = items.findIndex(i => i.id === activeItemId);
    // Shift items after current
    const newItem: RoutineItem = {
      id: newId(), routineId, type: 'step',
      title: insertTitle.trim(), durationMinutes: insertDuration,
      sortOrder: currentIdx + 0.5, createdAt: now(),
    };
    await db.routineItems.add(newItem);
    // Re-sort
    const allItems = await db.routineItems.where('routineId').equals(routineId).toArray();
    const sorted = allItems.sort((a, b) => a.sortOrder - b.sortOrder);
    for (let i = 0; i < sorted.length; i++) {
      await db.routineItems.update(sorted[i].id, { sortOrder: i });
    }
    setItems(sorted);
    setInsertTitle('');
    setShowInsert(false);
    refresh();
  };

  if (!routine || !run) return null;

  const completedItems = items.filter(i => i.type !== 'divider' && itemStates.get(i.id)?.status === 'done');
  const totalItems = items.filter(i => i.type !== 'divider');
  const remainingMinutes = items
    .filter(i => i.type !== 'divider')
    .filter(i => {
      const s = itemStates.get(i.id);
      return !s || s.status === 'pending' || s.status === 'active';
    })
    .reduce((sum, i) => sum + i.durationMinutes, 0);

  const activeItem = activeItemId ? items.find(i => i.id === activeItemId) : null;
  const activeTimerTarget = activeItem ? activeItem.durationMinutes * 60 : 0;
  const timerProgress = activeTimerTarget > 0 ? Math.min(1, timerSeconds / activeTimerTarget) : 0;
  const isOvertime = timerSeconds > activeTimerTarget && activeTimerTarget > 0;
  const isRoutineComplete = !activeItemId && completedItems.length > 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Run Header */}
      <header style={{
        padding: '16px 28px', background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn-ghost" onClick={async () => { await persistRun(); onExit(); }} style={{ fontSize: 13 }}>← Exit</button>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>{routine.name}</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {completedItems.length}/{totalItems.length} · {formatMinutes(remainingMinutes)} remaining
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn-ghost" onClick={() => setShowInsert(true)} style={{ fontSize: 12 }}>+ Insert</button>
        </div>
      </header>

      <div className="routine-runner-body" style={{ flex: 1, overflowY: 'auto', display: 'flex' }}>
        {/* Step list - left side */}
        <div style={{ width: 340, borderRight: '1px solid var(--border-light)', overflowY: 'auto', padding: '16px 0' }}>
          {items.map(item => {
            const state = itemStates.get(item.id);
            const status = state?.status || 'pending';
            const isActive = item.id === activeItemId;

            if (item.type === 'divider') {
              return (
                <div key={item.id} style={{ padding: '12px 20px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>
                  {item.title}
                </div>
              );
            }

            return (
              <div key={item.id} style={{
                padding: '12px 20px', cursor: 'pointer',
                background: isActive ? 'var(--color-accent-light)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--color-accent)' : '3px solid transparent',
                opacity: status === 'done' ? 0.5 : status === 'skipped' ? 0.4 : 1,
                transition: 'all 0.15s ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>
                    {status === 'done' ? '✓' : status === 'skipped' ? '→' : isActive ? '▶' : '○'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: 13, fontWeight: isActive ? 600 : 400,
                      textDecoration: status === 'done' ? 'line-through' : 'none',
                      color: status === 'skipped' ? 'var(--text-muted)' : 'var(--text-primary)',
                    }}>{item.title}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatMinutes(item.durationMinutes)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Active step detail - center */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          {isRoutineComplete ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Routine Complete</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 24 }}>
                {completedItems.length} of {totalItems.length} steps completed
              </p>
              <button className="btn-primary" onClick={onExit} style={{ fontSize: 14, padding: '10px 24px' }}>Done</button>
            </div>
          ) : activeItem ? (
            <>
              {/* Timer Arc */}
              <div style={{ position: 'relative', width: 200, height: 200, marginBottom: 24 }}>
                <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="100" cy="100" r="88" fill="none" stroke="var(--border-color)" strokeWidth="6" />
                  <circle cx="100" cy="100" r="88" fill="none"
                    stroke={isOvertime ? 'var(--color-rose)' : 'var(--color-accent)'}
                    strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 88}`}
                    strokeDashoffset={`${2 * Math.PI * 88 * (1 - timerProgress)}`}
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                  />
                </svg>
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 36, fontWeight: 700,
                    color: isOvertime ? 'var(--color-rose)' : 'var(--text-primary)',
                  }}>
                    {isOvertime ? '+' : ''}{formatTimer(isOvertime ? timerSeconds - activeTimerTarget : activeTimerTarget - timerSeconds)}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    of {formatMinutes(activeItem.durationMinutes)}
                  </span>
                </div>
              </div>

              {/* Current step info */}
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, marginBottom: 4, textAlign: 'center' }}>
                {activeItem.title}
              </h2>
              {activeItem.notes && (
                <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16, textAlign: 'center', maxWidth: 400 }}>
                  {activeItem.notes}
                </p>
              )}

              {/* What's next */}
              {(() => {
                const currentIdx = items.findIndex(i => i.id === activeItemId);
                const nextItem = items.slice(currentIdx + 1).find(i => i.type !== 'divider' && (!itemStates.get(i.id) || itemStates.get(i.id)?.status === 'pending'));
                if (nextItem) {
                  return (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
                      Up next: <strong>{nextItem.title}</strong> · {formatMinutes(nextItem.durationMinutes)}
                    </div>
                  );
                }
                return null;
              })()}

              {/* Controls */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button className="btn-ghost" onClick={skipItem} style={{ fontSize: 13 }}>Skip →</button>
                <button className="btn-ghost" onClick={togglePause} style={{ fontSize: 13, minWidth: 80 }}>
                  {isPaused ? '▶ Resume' : '⏸ Pause'}
                </button>
                <button className="btn-primary" onClick={completeCurrentItem} style={{ fontSize: 14, padding: '10px 28px' }}>
                  Done ✓
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Insert on-the-fly modal */}
      <Modal open={showInsert} onClose={() => setShowInsert(false)} title="Quick Insert">
        <div className="flex flex-col gap-3">
          <input className="input" placeholder="Step title" value={insertTitle} onChange={e => setInsertTitle(e.target.value)} autoFocus />
          <select className="select" value={insertDuration} onChange={e => setInsertDuration(Number(e.target.value))}>
            {[5, 10, 15, 20, 25, 30].map(m => <option key={m} value={m}>{formatMinutes(m)}</option>)}
          </select>
          <div className="flex gap-3 justify-end">
            <button className="btn-ghost" onClick={() => setShowInsert(false)}>Cancel</button>
            <button className="btn-primary" onClick={insertOnTheFly}>Insert after current</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
