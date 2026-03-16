'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/db';
import { newId, now, formatMinutes } from '@/lib/utils';
import type { Routine, RoutineItem, RoutineType, TimeOfDay } from '@/types';
import Modal from '@/components/shared/Modal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import EmptyState from '@/components/shared/EmptyState';
import RoutineEditor from './RoutineEditor';
import RoutineRunner from './RoutineRunner';
import DayView from './DayView';
import EndOfDayReview from './EndOfDayReview';

type View = 'list' | 'day' | 'edit' | 'run';

export default function RoutineManager() {
  const { refreshKey, refresh } = useApp();
  const [view, setView] = useState<View>('list');
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [itemCounts, setItemCounts] = useState<Map<string, { count: number; minutes: number }>>(new Map());
  const [showForm, setShowForm] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [runRoutineId, setRunRoutineId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Routine | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [filterType, setFilterType] = useState<string>('');

  useEffect(() => {
    db.routines.toArray().then(all => {
      const filtered = filterType ? all.filter(r => r.type === filterType) : all;
      setRoutines(filtered.sort((a, b) => b.updatedAt - a.updatedAt));
    });
    db.routineItems.toArray().then(items => {
      const counts = new Map<string, { count: number; minutes: number }>();
      for (const item of items) {
        const existing = counts.get(item.routineId) || { count: 0, minutes: 0 };
        if (item.type !== 'divider') {
          existing.count++;
          existing.minutes += item.durationMinutes;
        }
        counts.set(item.routineId, existing);
      }
      setItemCounts(counts);
    });
  }, [refreshKey, filterType]);

  const createRoutine = async (data: { name: string; type: RoutineType; timeOfDay: TimeOfDay; weekDays?: number[] }) => {
    const routine: Routine = {
      id: newId(),
      name: data.name.trim(),
      type: data.type,
      timeOfDay: data.timeOfDay,
      weekDays: data.weekDays,
      isTemplate: false,
      isActive: false,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.routines.add(routine);
    setShowForm(false);
    setSelectedRoutine(routine);
    setView('edit');
    refresh();
  };

  const deleteRoutine = async (id: string) => {
    await db.routineItems.where('routineId').equals(id).delete();
    await db.routineRuns.where('routineId').equals(id).delete();
    await db.routines.delete(id);
    setConfirmDelete(null);
    refresh();
  };

  const installTemplate = async (template: { name: string; type: RoutineType; timeOfDay: TimeOfDay; items: { title: string; type: 'step' | 'buffer' | 'divider'; duration: number }[] }) => {
    const routine: Routine = {
      id: newId(), name: template.name, type: template.type,
      timeOfDay: template.timeOfDay, isTemplate: false, isActive: false,
      createdAt: now(), updatedAt: now(),
    };
    await db.routines.add(routine);
    for (let i = 0; i < template.items.length; i++) {
      const item = template.items[i];
      await db.routineItems.add({
        id: newId(), routineId: routine.id, type: item.type,
        title: item.title, durationMinutes: item.duration,
        sortOrder: i, createdAt: now(),
      });
    }
    setShowTemplates(false);
    setSelectedRoutine(routine);
    setView('edit');
    refresh();
  };

  const startRun = (routineId: string) => {
    setRunRoutineId(routineId);
    setView('run');
  };

  const editRoutine = (routine: Routine) => {
    setSelectedRoutine(routine);
    setView('edit');
  };

  if (view === 'run' && runRoutineId) {
    return <RoutineRunner routineId={runRoutineId} onExit={() => { setRunRoutineId(null); setView('list'); refresh(); }} />;
  }

  if (view === 'edit' && selectedRoutine) {
    return <RoutineEditor routine={selectedRoutine} onBack={() => { setSelectedRoutine(null); setView('list'); }} onStartRun={startRun} />;
  }

  if (view === 'day') {
    return (
      <div>
        <div style={{ padding: '12px 28px 0', display: 'flex', gap: 8 }}>
          <button className={view === 'day' ? 'btn-secondary' : 'btn-ghost'} onClick={() => setView('day')} style={{ fontSize: 12 }}>Day View</button>
          <button className="btn-ghost" onClick={() => setView('list')} style={{ fontSize: 12 }}>All Routines</button>
        </div>
        <DayView onStartRun={startRun} onEditRoutine={editRoutine} />
        <EndOfDayReview />
      </div>
    );
  }

  const typeLabels: Record<RoutineType, { label: string; icon: string; color: string }> = {
    fixed: { label: 'Fixed', icon: '◉', color: 'var(--color-accent)' },
    timed: { label: 'Timed', icon: '◷', color: 'var(--color-sky)' },
    flexible: { label: 'Queue', icon: '≡', color: 'var(--color-emerald)' },
    weekly: { label: 'Weekly', icon: '↻', color: 'var(--color-amber)' },
  };

  return (
    <div className="page-content" style={{ padding: '24px 28px', maxWidth: 1000 }}>
      <div className="header-with-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>Routines</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className={view === 'list' ? 'btn-ghost' : 'btn-secondary'} onClick={() => setView('day')} style={{ fontSize: 12 }}>
            Day View
          </button>
          <button className="btn-ghost" onClick={() => setShowTemplates(true)} style={{ fontSize: 12 }}>
            Templates
          </button>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + New Routine
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['', 'fixed', 'timed', 'flexible', 'weekly'].map(t => (
          <button key={t} onClick={() => setFilterType(t)} style={{
            padding: '5px 12px', borderRadius: 'var(--radius-full)', fontSize: 12,
            border: filterType === t ? '1px solid var(--color-accent)' : '1px solid var(--border-color)',
            background: filterType === t ? 'var(--color-accent-light)' : 'transparent',
            color: filterType === t ? 'var(--color-accent)' : 'var(--text-muted)',
            cursor: 'pointer', fontWeight: 500,
          }}>
            {t ? typeLabels[t as RoutineType].label : 'All'}
          </button>
        ))}
      </div>

      {routines.length === 0 ? (
        <EmptyState
          icon="🔄"
          title="No routines yet"
          description="Build structured routines for your day — morning anchors, work queues, or time-blocked schedules"
          action={{ label: '+ Create Routine', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="grid-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {routines.map(r => {
            const stats = itemCounts.get(r.id) || { count: 0, minutes: 0 };
            const tl = typeLabels[r.type];
            return (
              <div key={r.id} className="card" style={{ cursor: 'pointer', padding: 20 }} onClick={() => editRoutine(r)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: tl.color, fontSize: 16 }}>{tl.icon}</span>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{r.name}</h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {r.isActive && (
                      <span className="badge" style={{ background: 'var(--color-emerald-light)', color: 'var(--color-emerald)', fontSize: 10 }}>
                        Active
                      </span>
                    )}
                    <span className="badge" style={{ fontSize: 10, background: tl.color + '18', color: tl.color }}>
                      {tl.label}
                    </span>
                    <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setConfirmDelete(r); }} style={{ color: 'var(--color-rose)', padding: 2 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {stats.count} steps · {formatMinutes(stats.minutes)}
                  {r.timeOfDay !== 'custom' && ` · ${r.timeOfDay}`}
                  {r.timeOfDay === 'custom' && r.customLabel && ` · ${r.customLabel}`}
                </div>
                {r.type === 'weekly' && r.weekDays && r.weekDays.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, i) => (
                      <span key={i} style={{
                        width: 22, height: 22, borderRadius: '50%', fontSize: 10, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: r.weekDays!.includes(i) ? 'var(--color-accent-light)' : 'transparent',
                        color: r.weekDays!.includes(i) ? 'var(--color-accent)' : 'var(--text-muted)',
                      }}>
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Routine Form */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Routine">
        <NewRoutineForm onSave={createRoutine} onCancel={() => setShowForm(false)} />
      </Modal>

      {/* Templates */}
      <Modal open={showTemplates} onClose={() => setShowTemplates(false)} title="Routine Templates">
        <TemplateLibrary onInstall={installTemplate} onCancel={() => setShowTemplates(false)} />
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Routine"
        message={`Delete "${confirmDelete?.name}" and all its items? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => { if (confirmDelete) deleteRoutine(confirmDelete.id); }}
        onCancel={() => setConfirmDelete(null)}
      />

      <EndOfDayReview />
    </div>
  );
}

function NewRoutineForm({ onSave, onCancel }: {
  onSave: (data: { name: string; type: RoutineType; timeOfDay: TimeOfDay; weekDays?: number[] }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<RoutineType>('fixed');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('morning');
  const [weekDays, setWeekDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const toggleDay = (d: number) => {
    setWeekDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  };

  return (
    <div className="flex flex-col gap-3">
      <input className="input" placeholder="Routine name" value={name} onChange={e => setName(e.target.value)} autoFocus />
      <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Type</label>
          <select className="select" value={type} onChange={e => setType(e.target.value as RoutineType)}>
            <option value="fixed">Fixed daily</option>
            <option value="timed">Time-blocked</option>
            <option value="flexible">Flexible queue</option>
            <option value="weekly">Weekly recurring</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Time of day</label>
          <select className="select" value={timeOfDay} onChange={e => setTimeOfDay(e.target.value as TimeOfDay)}>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>
      {type === 'weekly' && (
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Days</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, i) => (
              <button key={i} type="button" onClick={() => toggleDay(i)} style={{
                width: 38, height: 38, borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
                border: weekDays.includes(i) ? '2px solid var(--color-accent)' : '1px solid var(--border-color)',
                background: weekDays.includes(i) ? 'var(--color-accent-light)' : 'transparent',
                color: weekDays.includes(i) ? 'var(--color-accent)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-3 justify-end" style={{ marginTop: 8 }}>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={() => { if (name.trim()) onSave({ name: name.trim(), type, timeOfDay, weekDays: type === 'weekly' ? weekDays : undefined }); }}>
          Create
        </button>
      </div>
    </div>
  );
}

const TEMPLATES = [
  {
    name: 'Morning Routine',
    type: 'fixed' as RoutineType,
    timeOfDay: 'morning' as TimeOfDay,
    description: 'A grounding start to the day — review, plan, and prepare',
    items: [
      { title: 'Review today\'s calendar', type: 'step' as const, duration: 5 },
      { title: 'Check messages & urgent items', type: 'step' as const, duration: 10 },
      { title: 'Plan top 3 priorities', type: 'step' as const, duration: 5 },
      { title: 'Admin', type: 'divider' as const, duration: 0 },
      { title: 'Process inbox', type: 'step' as const, duration: 10 },
      { title: 'Prep materials for first class', type: 'step' as const, duration: 15 },
      { title: 'Buffer / transition', type: 'buffer' as const, duration: 5 },
    ],
  },
  {
    name: 'Deep Work Block',
    type: 'flexible' as RoutineType,
    timeOfDay: 'afternoon' as TimeOfDay,
    description: 'Focused work session — phone off, notifications silent',
    items: [
      { title: 'Set environment (close tabs, silence notifications)', type: 'step' as const, duration: 2 },
      { title: 'Deep focus work', type: 'step' as const, duration: 45 },
      { title: 'Break', type: 'buffer' as const, duration: 10 },
      { title: 'Deep focus work', type: 'step' as const, duration: 45 },
      { title: 'Review & save progress', type: 'step' as const, duration: 5 },
    ],
  },
  {
    name: 'End-of-Day Wind-Down',
    type: 'fixed' as RoutineType,
    timeOfDay: 'evening' as TimeOfDay,
    description: 'Close out the day cleanly so nothing lingers',
    items: [
      { title: 'Wrap-up', type: 'divider' as const, duration: 0 },
      { title: 'File & organize today\'s materials', type: 'step' as const, duration: 10 },
      { title: 'Log any student notes', type: 'step' as const, duration: 10 },
      { title: 'Update task statuses', type: 'step' as const, duration: 5 },
      { title: 'Plan tomorrow', type: 'divider' as const, duration: 0 },
      { title: 'Review tomorrow\'s schedule', type: 'step' as const, duration: 5 },
      { title: 'Prep any materials needed', type: 'step' as const, duration: 10 },
      { title: 'Brain dump / parking lot', type: 'step' as const, duration: 5 },
    ],
  },
];

function TemplateLibrary({ onInstall, onCancel }: {
  onInstall: (template: typeof TEMPLATES[0]) => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {TEMPLATES.map((t, i) => (
        <div key={i} className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{t.name}</h3>
            <button className="btn-primary" onClick={() => onInstall(t)} style={{ fontSize: 12, padding: '5px 12px' }}>
              Use template
            </button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{t.description}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {t.items.filter(i => i.type !== 'divider').map((item, j) => (
              <span key={j} style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-input)', color: 'var(--text-muted)',
              }}>
                {item.title} ({formatMinutes(item.duration)})
              </span>
            ))}
          </div>
        </div>
      ))}
      <button className="btn-ghost" onClick={onCancel} style={{ alignSelf: 'flex-end' }}>Close</button>
    </div>
  );
}
