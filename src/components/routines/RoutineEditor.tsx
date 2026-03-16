'use client';

import React, { useState, useEffect } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent, DragOverlay, type DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useApp } from '@/lib/context';
import { db, completeTaskById } from '@/lib/db';
import { newId, now, formatMinutes } from '@/lib/utils';
import type { Routine, RoutineItem, RoutineItemType, RoutineType, TimeOfDay, Task, Project } from '@/types';
import Modal from '@/components/shared/Modal';

interface Props {
  routine: Routine;
  onBack: () => void;
  onStartRun: (routineId: string) => void;
}

const typeIcons: Record<RoutineItemType, string> = {
  step: '●',
  linked_task: '☑',
  buffer: '◇',
  divider: '—',
};

const typeColors: Record<RoutineItemType, string> = {
  step: 'var(--color-accent)',
  linked_task: 'var(--color-sky)',
  buffer: 'var(--color-amber)',
  divider: 'var(--text-muted)',
};

function SortableItem({ item, tasks, projects, onEdit, onDelete }: {
  item: RoutineItem;
  tasks: Map<string, Task>;
  projects: Map<string, Project>;
  onEdit: (item: RoutineItem) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const linkedTask = item.linkedTaskId ? tasks.get(item.linkedTaskId) : null;
  const linkedProject = linkedTask?.projectId ? projects.get(linkedTask.projectId) : null;

  if (item.type === 'divider') {
    return (
      <div ref={setNodeRef} style={style} {...attributes}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0',
        }}>
          <div {...listeners} style={{ cursor: 'grab', color: 'var(--text-muted)', padding: '0 4px' }}>⋮⋮</div>
          <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>
            {item.title}
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
          <button className="btn-icon" onClick={() => onEdit(item)} style={{ padding: 2, fontSize: 11 }}>Edit</button>
          <button className="btn-icon" onClick={() => onDelete(item.id)} style={{ padding: 2, color: 'var(--color-rose)', fontSize: 11 }}>✕</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="card" style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
        borderLeft: `3px solid ${typeColors[item.type]}`,
      }}>
        <div {...listeners} style={{ cursor: 'grab', color: 'var(--text-muted)', padding: '0 4px', userSelect: 'none' }}>⋮⋮</div>
        <span style={{ color: typeColors[item.type], fontSize: 14, width: 20, textAlign: 'center' }}>
          {typeIcons[item.type]}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>
            {item.type === 'linked_task' && linkedTask ? linkedTask.title : item.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            {item.type === 'linked_task' && linkedProject && (
              <span style={{ fontSize: 11, color: linkedProject.color, background: linkedProject.color + '18', padding: '1px 6px', borderRadius: 'var(--radius-sm)' }}>
                {linkedProject.name}
              </span>
            )}
            {item.notes && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.notes}</span>}
          </div>
        </div>
        {item.durationMinutes > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            {formatMinutes(item.durationMinutes)}
          </span>
        )}
        {item.startTime && (
          <span style={{ fontSize: 11, color: 'var(--color-sky)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
            {item.startTime}
          </span>
        )}
        <button className="btn-icon" onClick={() => onEdit(item)} style={{ padding: 2, fontSize: 11 }}>Edit</button>
        <button className="btn-icon" onClick={() => onDelete(item.id)} style={{ padding: 2, color: 'var(--color-rose)', fontSize: 11 }}>✕</button>
      </div>
    </div>
  );
}

function DragOverlayItem({ item }: { item: RoutineItem }) {
  return (
    <div className="card" style={{
      padding: '12px 14px', borderLeft: `3px solid ${typeColors[item.type]}`,
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)', opacity: 0.9,
    }}>
      <span style={{ fontWeight: 500, fontSize: 14 }}>{item.title}</span>
    </div>
  );
}

export default function RoutineEditor({ routine, onBack, onStartRun }: Props) {
  const { refresh, refreshKey } = useApp();
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [tasks, setTasks] = useState<Map<string, Task>>(new Map());
  const [projects, setProjects] = useState<Map<string, Project>>(new Map());
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<RoutineItem | undefined>();
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);

  const [routineData, setRoutineData] = useState(routine);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    db.routineItems.where('routineId').equals(routine.id).toArray().then(items => {
      setItems(items.sort((a, b) => a.sortOrder - b.sortOrder));
    });
    db.tasks.toArray().then(all => setTasks(new Map(all.map(t => [t.id, t]))));
    db.projects.toArray().then(all => setProjects(new Map(all.map(p => [p.id, p]))));
    db.routines.get(routine.id).then(r => { if (r) setRoutineData(r); });
  }, [routine.id, refreshKey]);

  const totalMinutes = items.filter(i => i.type !== 'divider').reduce((s, i) => s + i.durationMinutes, 0);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    // Persist new sort order
    for (let i = 0; i < reordered.length; i++) {
      await db.routineItems.update(reordered[i].id, { sortOrder: i });
    }
    refresh();
  };

  const saveItem = async (data: { title: string; notes: string; durationMinutes: number; type: RoutineItemType; startTime: string }) => {
    if (editingItem) {
      await db.routineItems.update(editingItem.id, {
        title: data.title, notes: data.notes || undefined,
        durationMinutes: data.durationMinutes, type: data.type,
        startTime: data.startTime || undefined,
      });
    } else {
      const sortOrder = insertIndex !== null ? insertIndex : items.length;
      // Shift existing items if inserting
      if (insertIndex !== null) {
        for (const item of items.filter(i => i.sortOrder >= sortOrder)) {
          await db.routineItems.update(item.id, { sortOrder: item.sortOrder + 1 });
        }
      }
      await db.routineItems.add({
        id: newId(), routineId: routine.id, type: data.type,
        title: data.title, notes: data.notes || undefined,
        durationMinutes: data.durationMinutes,
        startTime: data.startTime || undefined,
        sortOrder, createdAt: now(),
      });
    }
    setEditingItem(undefined);
    setShowItemForm(false);
    setInsertIndex(null);
    refresh();
  };

  const deleteItem = async (id: string) => {
    await db.routineItems.delete(id);
    refresh();
  };

  const linkTask = async (task: Task) => {
    const sortOrder = items.length;
    await db.routineItems.add({
      id: newId(), routineId: routine.id, type: 'linked_task',
      title: task.title, linkedTaskId: task.id,
      durationMinutes: task.estimatedMinutes || 25,
      sortOrder, createdAt: now(),
    });
    setShowTaskPicker(false);
    refresh();
  };

  const saveRoutineSettings = async (data: Partial<Routine>) => {
    await db.routines.update(routine.id, { ...data, updatedAt: now() });
    setShowSettings(false);
    refresh();
  };

  const duplicateRoutine = async () => {
    const newRoutine: Routine = {
      ...routineData,
      id: newId(),
      name: `${routineData.name} (copy)`,
      isTemplate: false,
      isActive: false,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.routines.add(newRoutine);
    // Copy items
    for (const item of items) {
      await db.routineItems.add({
        ...item,
        id: newId(),
        routineId: newRoutine.id,
        createdAt: now(),
      });
    }
    refresh();
    onBack();
  };

  const toggleActive = async () => {
    await db.routines.update(routine.id, { isActive: !routineData.isActive, updatedAt: now() });
    refresh();
  };

  const activeItem = activeId ? items.find(i => i.id === activeId) : null;

  return (
    <div className="page-content" style={{ padding: '24px 28px', maxWidth: 800 }}>
      <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 16, fontSize: 13 }}>← Back to Routines</button>

      <div className="header-with-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>{routineData.name}</h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {routineData.type === 'fixed' && `Fixed · ${routineData.timeOfDay}`}
            {routineData.type === 'timed' && `Time-blocked${routineData.startTime ? ` · starts ${routineData.startTime}` : ''}`}
            {routineData.type === 'flexible' && 'Flexible queue'}
            {routineData.type === 'weekly' && `Weekly · ${(routineData.weekDays || []).map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}`}
            {' · '}{formatMinutes(totalMinutes)} total
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-ghost" onClick={() => setShowSettings(true)} style={{ fontSize: 12 }}>Settings</button>
          <button className="btn-ghost" onClick={duplicateRoutine} style={{ fontSize: 12 }}>Duplicate</button>
          <button className={routineData.isActive ? 'btn-secondary' : 'btn-ghost'} onClick={toggleActive} style={{ fontSize: 12 }}>
            {routineData.isActive ? '★ Active today' : 'Set active'}
          </button>
          {items.length > 0 && (
            <button className="btn-primary" onClick={() => onStartRun(routine.id)} style={{ fontSize: 13 }}>
              ▶ Start routine
            </button>
          )}
        </div>
      </div>

      {/* Items list with drag and drop */}
      <div style={{ marginTop: 20 }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((item, idx) => (
                <React.Fragment key={item.id}>
                  {/* Insert button between items */}
                  <button
                    onClick={() => { setInsertIndex(idx); setEditingItem(undefined); setShowItemForm(true); }}
                    style={{
                      background: 'transparent', border: '1px dashed var(--border-color)',
                      borderRadius: 'var(--radius-sm)', padding: 2, cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: 11, opacity: 0.4,
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
                  >+</button>
                  <SortableItem
                    item={item} tasks={tasks} projects={projects}
                    onEdit={(item) => { setEditingItem(item); setShowItemForm(true); }}
                    onDelete={deleteItem}
                  />
                </React.Fragment>
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeItem ? <DragOverlayItem item={activeItem} /> : null}
          </DragOverlay>
        </DndContext>

        {/* Add buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn-ghost" onClick={() => { setInsertIndex(null); setEditingItem(undefined); setShowItemForm(true); }} style={{ fontSize: 13 }}>
            + Add step
          </button>
          <button className="btn-ghost" onClick={() => setShowTaskPicker(true)} style={{ fontSize: 13, color: 'var(--color-sky)' }}>
            + Link task
          </button>
          <button className="btn-ghost" onClick={() => saveItem({ title: 'Break', notes: '', durationMinutes: 10, type: 'buffer', startTime: '' })} style={{ fontSize: 13, color: 'var(--color-amber)' }}>
            + Buffer
          </button>
          <button className="btn-ghost" onClick={() => {
            const label = prompt('Section label:');
            if (label) saveItem({ title: label, notes: '', durationMinutes: 0, type: 'divider', startTime: '' });
          }} style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            + Divider
          </button>
        </div>
      </div>

      {/* Item Form Modal */}
      <Modal open={showItemForm} onClose={() => { setShowItemForm(false); setEditingItem(undefined); setInsertIndex(null); }} title={editingItem ? 'Edit Item' : 'Add Item'}>
        <ItemForm
          item={editingItem}
          isTimed={routineData.type === 'timed'}
          onSave={saveItem}
          onCancel={() => { setShowItemForm(false); setEditingItem(undefined); setInsertIndex(null); }}
        />
      </Modal>

      {/* Task Picker Modal */}
      <Modal open={showTaskPicker} onClose={() => setShowTaskPicker(false)} title="Link a Task">
        <TaskPicker tasks={tasks} linkedIds={new Set(items.filter(i => i.linkedTaskId).map(i => i.linkedTaskId!))} projects={projects} onSelect={linkTask} />
      </Modal>

      {/* Settings Modal */}
      <Modal open={showSettings} onClose={() => setShowSettings(false)} title="Routine Settings">
        <RoutineSettingsForm routine={routineData} onSave={saveRoutineSettings} onCancel={() => setShowSettings(false)} />
      </Modal>
    </div>
  );
}

function ItemForm({ item, isTimed, onSave, onCancel }: {
  item?: RoutineItem; isTimed: boolean;
  onSave: (data: { title: string; notes: string; durationMinutes: number; type: RoutineItemType; startTime: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(item?.title || '');
  const [notes, setNotes] = useState(item?.notes || '');
  const [duration, setDuration] = useState(item?.durationMinutes || 15);
  const [type, setType] = useState<RoutineItemType>(item?.type || 'step');
  const [startTime, setStartTime] = useState(item?.startTime || '');

  return (
    <div className="flex flex-col gap-3">
      <select className="select" value={type} onChange={e => setType(e.target.value as RoutineItemType)}>
        <option value="step">Step</option>
        <option value="buffer">Buffer / Break</option>
        <option value="divider">Section Divider</option>
      </select>
      <input className="input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      {type !== 'divider' && (
        <>
          <textarea className="textarea" placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Duration</label>
              <select className="select" value={duration} onChange={e => setDuration(Number(e.target.value))}>
                {[5, 10, 15, 20, 25, 30, 45, 60, 90, 120].map(m => (
                  <option key={m} value={m}>{formatMinutes(m)}</option>
                ))}
              </select>
            </div>
            {isTimed && (
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Start time</label>
                <input type="time" className="input" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
            )}
          </div>
        </>
      )}
      <div className="flex gap-3 justify-end" style={{ marginTop: 8 }}>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={() => { if (title.trim()) onSave({ title: title.trim(), notes, durationMinutes: type === 'divider' ? 0 : duration, type, startTime }); }}>
          {item ? 'Update' : 'Add'}
        </button>
      </div>
    </div>
  );
}

function TaskPicker({ tasks, linkedIds, projects, onSelect }: {
  tasks: Map<string, Task>;
  linkedIds: Set<string>;
  projects: Map<string, Project>;
  onSelect: (task: Task) => void;
}) {
  const [search, setSearch] = useState('');
  const available = Array.from(tasks.values())
    .filter(t => t.status !== 'done' && !linkedIds.has(t.id))
    .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const po = { critical: 0, high: 1, medium: 2, low: 3 };
      return po[a.priority] - po[b.priority];
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input className="input" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
      <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {available.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No available tasks.</p>}
        {available.map(t => {
          const proj = t.projectId ? projects.get(t.projectId) : null;
          return (
            <button key={t.id} className="card" onClick={() => onSelect(t)} style={{
              padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              border: 'none', background: 'var(--bg-input)',
            }}>
              <span style={{ color: { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' }[t.priority], fontSize: 10 }}>●</span>
              <span style={{ flex: 1, fontSize: 13 }}>{t.title}</span>
              {proj && <span style={{ fontSize: 11, color: proj.color }}>{proj.name}</span>}
              {t.estimatedMinutes > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatMinutes(t.estimatedMinutes)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RoutineSettingsForm({ routine, onSave, onCancel }: {
  routine: Routine;
  onSave: (data: Partial<Routine>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(routine.name);
  const [type, setType] = useState<RoutineType>(routine.type);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(routine.timeOfDay);
  const [customLabel, setCustomLabel] = useState(routine.customLabel || '');
  const [startTime, setStartTime] = useState(routine.startTime || '');
  const [weekDays, setWeekDays] = useState<number[]>(routine.weekDays || []);

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
      {timeOfDay === 'custom' && (
        <input className="input" placeholder="Custom label (e.g. Pre-class prep)" value={customLabel} onChange={e => setCustomLabel(e.target.value)} />
      )}
      {type === 'timed' && (
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Start time</label>
          <input type="time" className="input" value={startTime} onChange={e => setStartTime(e.target.value)} />
        </div>
      )}
      {(type === 'weekly') && (
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Days</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, i) => (
              <button key={i} onClick={() => toggleDay(i)} style={{
                width: 36, height: 36, borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
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
        <button className="btn-primary" onClick={() => {
          if (name.trim()) onSave({
            name: name.trim(), type, timeOfDay,
            customLabel: timeOfDay === 'custom' ? customLabel : undefined,
            startTime: type === 'timed' ? startTime : undefined,
            weekDays: type === 'weekly' ? weekDays : undefined,
          });
        }}>Save</button>
      </div>
    </div>
  );
}
