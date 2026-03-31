'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/lib/context';
import { db, completeTaskById, uncompleteTaskById } from '@/lib/db';
import { newId, now, todayStart, todayEnd, priorityConfig } from '@/lib/utils';
import type { Task, Priority } from '@/types';

/**
 * DailyTodoList — a lightweight "today" checklist on the dashboard.
 *
 * Features:
 *   - Quick-add with slash syntax (/high /30m /tag Name /tomorrow)
 *   - "+search" to add existing tasks
 *   - Drag-and-drop reordering
 *   - Carry-forward prompt for yesterday's unfinished items
 *   - Auto-suggestions for overdue / due-today / high-priority tasks
 */

interface DailyItem {
  id: string;
  taskId?: string;
  label: string;
  done: boolean;
  priority?: Priority;
  estimatedMinutes?: number;
  sortOrder: number;
}

interface CarryForwardItem {
  id: string;
  taskId?: string;
  label: string;
  priority?: Priority;
  selected: boolean;
}

const STORAGE_KEY = 'fokus-daily-todo';

function todayStr() { return new Date().toISOString().split('T')[0]; }

function loadStorage(): { date: string; items: DailyItem[]; reflectionDone?: boolean } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveStorage(items: DailyItem[], reflectionDone?: boolean) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    date: todayStr(),
    items,
    reflectionDone: reflectionDone || false,
  }));
}

interface Props {
  onFocusTask?: (taskId: string) => void;
}

export default function DailyTodoList({ onFocusTask }: Props) {
  const { refreshKey, refresh } = useApp();
  const [items, setItems] = useState<DailyItem[]>([]);
  const [input, setInput] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<Task[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [carryForward, setCarryForward] = useState<CarryForwardItem[] | null>(null);
  const [suggestions, setSuggestions] = useState<Task[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  // Initialize: check for carry-forward or load today's list
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const stored = loadStorage();
    if (stored && stored.date === todayStr()) {
      setItems(stored.items);
    } else if (stored && stored.date !== todayStr() && stored.items.length > 0) {
      // Yesterday's (or older) list — show carry-forward for undone items
      const undone = stored.items.filter(i => !i.done);
      if (undone.length > 0) {
        setCarryForward(undone.map(i => ({
          id: i.id, taskId: i.taskId, label: i.label,
          priority: i.priority, selected: true,
        })));
      }
    }
  }, []);

  // Persist items
  useEffect(() => {
    if (!initialized.current) return;
    saveStorage(items);
  }, [items]);

  // Load suggestions when list is empty or small
  useEffect(() => {
    const start = todayStart();
    const end = todayEnd();
    db.tasks.toArray().then(all => {
      const active = all.filter(t => t.status !== 'done' && t.status !== 'deferred');
      const linkedIds = new Set(items.filter(i => i.taskId).map(i => i.taskId));

      const overdue = active.filter(t => t.dueDate && t.dueDate < start && !linkedIds.has(t.id));
      const dueToday = active.filter(t => t.dueDate && t.dueDate >= start && t.dueDate <= end && !linkedIds.has(t.id));
      const highPriority = active.filter(t =>
        (t.priority === 'critical' || t.priority === 'high') && !linkedIds.has(t.id)
        && !overdue.some(o => o.id === t.id) && !dueToday.some(d => d.id === t.id)
      );

      const combined = [
        ...overdue.sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0)),
        ...dueToday.sort((a, b) => priorityConfig[a.priority].sortOrder - priorityConfig[b.priority].sortOrder),
        ...highPriority.sort((a, b) => priorityConfig[a.priority].sortOrder - priorityConfig[b.priority].sortOrder),
      ].slice(0, 5);

      setSuggestions(combined);
    });
  }, [refreshKey, items]);

  // Search existing tasks
  useEffect(() => {
    if (!input.startsWith('+') || input.length < 2) { setShowSearch(false); return; }
    const query = input.slice(1).trim().toLowerCase();
    if (!query) { setShowSearch(false); return; }
    db.tasks.toArray().then(all => {
      const results = all
        .filter(t => t.status !== 'done' && t.status !== 'deferred')
        .filter(t => t.title.toLowerCase().includes(query))
        .filter(t => !items.some(i => i.taskId === t.id))
        .slice(0, 6);
      setSearchResults(results);
      setShowSearch(results.length > 0);
      setSelectedIdx(0);
    });
  }, [input, items]);

  /* ─── Carry-forward ─── */
  const acceptCarryForward = () => {
    if (!carryForward) return;
    const selected = carryForward.filter(c => c.selected);
    const newItems: DailyItem[] = selected.map((c, i) => ({
      id: newId(), taskId: c.taskId, label: c.label,
      done: false, priority: c.priority, sortOrder: i,
    }));
    setItems(newItems);
    setCarryForward(null);
  };

  const dismissCarryForward = () => { setCarryForward(null); };

  /* ─── Add items ─── */
  const addExistingTask = useCallback((task: Task) => {
    setItems(prev => [...prev, {
      id: newId(), taskId: task.id, label: task.title, done: task.status === 'done',
      priority: task.priority, estimatedMinutes: task.estimatedMinutes || undefined,
      sortOrder: prev.length,
    }]);
    setInput('');
    setShowSearch(false);
  }, []);

  const parseAndAdd = async () => {
    const raw = input.trim();
    if (!raw) return;
    if (showSearch && searchResults.length > 0) { addExistingTask(searchResults[selectedIdx]); return; }

    let title = raw;
    let priority: Priority = 'medium';
    let estimatedMinutes = 0;
    let contextTag = '';
    let dueTomorrow = false;

    const parts = title.split(/\s+/);
    const titleParts: string[] = [];
    let i = 0;
    while (i < parts.length) {
      const p = parts[i];
      if (p === '/critical' || p === '/crit') { priority = 'critical'; }
      else if (p === '/high') { priority = 'high'; }
      else if (p === '/low') { priority = 'low'; }
      else if (p === '/medium' || p === '/med') { priority = 'medium'; }
      else if (p === '/tomorrow' || p === '/tmr') { dueTomorrow = true; }
      else if (/^\/(\d+)(m|min)$/i.test(p)) {
        estimatedMinutes = parseInt(p.match(/\d+/)![0]);
      } else if (/^\/(\d+)(h|hr)$/i.test(p)) {
        estimatedMinutes = parseInt(p.match(/\d+/)![0]) * 60;
      } else if (p === '/tag' && i + 1 < parts.length) {
        i++;
        const tagParts: string[] = [];
        while (i < parts.length && !parts[i].startsWith('/')) { tagParts.push(parts[i]); i++; }
        contextTag = tagParts.join(' ');
        continue;
      } else { titleParts.push(p); }
      i++;
    }

    title = titleParts.join(' ');
    if (!title) return;

    const dueDate = dueTomorrow
      ? (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(23, 59, 59, 999); return d.getTime(); })()
      : todayEnd();

    const taskId = newId();
    await db.tasks.add({
      id: taskId, title, description: '', dueDate, priority, contextTag,
      estimatedMinutes, status: 'todo', isRecurring: false, createdAt: now(), updatedAt: now(),
    });

    setItems(prev => [...prev, {
      id: newId(), taskId, label: title, done: false,
      priority, estimatedMinutes: estimatedMinutes || undefined, sortOrder: prev.length,
    }]);
    setInput('');
    setShowSearch(false);
    refresh();
  };

  const addSuggestion = (task: Task) => {
    addExistingTask(task);
    setSuggestions(prev => prev.filter(t => t.id !== task.id));
  };

  /* ─── Toggle / Remove ─── */
  const toggleDone = async (item: DailyItem) => {
    const newDone = !item.done;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, done: newDone } : i));
    if (item.taskId) {
      if (newDone) await completeTaskById(item.taskId); else await uncompleteTaskById(item.taskId);
      refresh();
    }
  };

  const removeItem = (id: string) => { setItems(prev => prev.filter(i => i.id !== id)); };

  /* ─── Drag-and-drop ─── */
  const handleDragStart = (idx: number) => { setDragIdx(idx); };
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDragEnd = () => {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      setItems(prev => {
        const arr = [...prev];
        const [moved] = arr.splice(dragIdx, 1);
        arr.splice(dragOverIdx, 0, moved);
        return arr.map((item, i) => ({ ...item, sortOrder: i }));
      });
    }
    setDragIdx(null);
    setDragOverIdx(null);
  };

  /* ─── Keyboard ─── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSearch) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, searchResults.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Escape') { setShowSearch(false); }
      else if (e.key === 'Enter') { e.preventDefault(); if (searchResults[selectedIdx]) addExistingTask(searchResults[selectedIdx]); }
      return;
    }
    if (e.key === 'Enter') { e.preventDefault(); parseAndAdd(); }
  };

  const doneCount = items.filter(i => i.done).length;
  const pct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
  const formatTime = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? m % 60 + 'm' : ''}` : `${m}m`;

  /* ─── Carry-forward overlay ─── */
  if (carryForward) {
    return (
      <div className="card" style={{ padding: 24, borderLeft: '4px solid var(--color-amber)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 4 }}>
          Carry forward?
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          You had {carryForward.length} unfinished {carryForward.length === 1 ? 'item' : 'items'} from your last plan. Want to bring them into today?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {carryForward.map(cf => (
            <label key={cf.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', cursor: 'pointer',
              opacity: cf.selected ? 1 : 0.5,
            }}>
              <input type="checkbox" checked={cf.selected}
                onChange={() => setCarryForward(prev => prev!.map(i => i.id === cf.id ? { ...i, selected: !i.selected } : i))}
                style={{ accentColor: 'var(--color-accent)' }} />
              {cf.priority && cf.priority !== 'medium' && (
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: priorityConfig[cf.priority].color, flexShrink: 0 }} />
              )}
              <span style={{ fontSize: 13 }}>{cf.label}</span>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={dismissCarryForward} style={{ fontSize: 13 }}>
            Start fresh
          </button>
          <button className="btn-primary" onClick={acceptCarryForward} style={{ fontSize: 13 }}>
            Carry forward ({carryForward.filter(c => c.selected).length})
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Today&apos;s Plan</h2>
        {items.length > 0 && (
          <span style={{ fontSize: 12, color: doneCount === items.length && items.length > 0 ? 'var(--color-emerald)' : 'var(--text-muted)' }}>
            {doneCount}/{items.length} · {pct}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      {items.length > 0 && (
        <div className="progress-bar" style={{ height: 4, marginBottom: 14 }}>
          <div className="progress-bar-fill" style={{
            width: `${pct}%`,
            background: pct === 100 ? 'var(--color-emerald)' : 'var(--color-accent)',
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}

      {/* Items list */}
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
          {items.map((item, idx) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                borderRadius: 'var(--radius-sm)',
                background: dragOverIdx === idx && dragIdx !== null
                  ? 'var(--color-accent-light)'
                  : item.done ? 'var(--color-emerald-light)' : 'var(--bg-input)',
                transition: 'background 0.15s',
                opacity: dragIdx === idx ? 0.4 : 1,
                cursor: 'grab',
              }}
            >
              {/* Drag handle */}
              <span style={{ color: 'var(--text-muted)', opacity: 0.35, fontSize: 10, cursor: 'grab', flexShrink: 0, userSelect: 'none' }}>
                ⠿
              </span>

              <button className="btn-icon" onClick={() => toggleDone(item)}
                style={{ padding: 2, color: item.done ? 'var(--color-emerald)' : 'var(--text-muted)', flexShrink: 0 }}>
                {item.done ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg>
                )}
              </button>

              {item.priority && item.priority !== 'medium' && (
                <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: priorityConfig[item.priority].color }} />
              )}

              <span style={{
                flex: 1, fontSize: 13,
                textDecoration: item.done ? 'line-through' : 'none',
                opacity: item.done ? 0.6 : 1,
              }}>
                {item.label}
              </span>

              {item.estimatedMinutes && item.estimatedMinutes > 0 && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                  {formatTime(item.estimatedMinutes)}
                </span>
              )}

              {item.taskId && onFocusTask && (
                <button className="btn-icon" onClick={() => onFocusTask(item.taskId!)}
                  title="Focus" style={{ padding: 2, color: 'var(--color-accent)', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>
                </button>
              )}

              <button className="btn-icon" onClick={() => removeItem(item.id)}
                style={{ padding: 2, color: 'var(--text-muted)', opacity: 0.5, flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Auto-suggestions */}
      {suggestions.length > 0 && items.length < 5 && !showSuggestions && (
        <button className="btn-ghost" onClick={() => setShowSuggestions(true)}
          style={{ fontSize: 12, marginBottom: 10, color: 'var(--color-sky)' }}>
          {suggestions.length} suggested {suggestions.length === 1 ? 'task' : 'tasks'} — click to view
        </button>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div style={{
          marginBottom: 12, padding: '10px 12px', borderRadius: 'var(--radius-sm)',
          background: 'var(--color-sky-light, rgba(97,151,232,0.08))',
          border: '1px solid rgba(97,151,232,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-sky)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Suggested
            </span>
            <button className="btn-icon" onClick={() => setShowSuggestions(false)} style={{ padding: 2, color: 'var(--text-muted)', fontSize: 10 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {suggestions.map(t => {
              const isOverdue = t.dueDate && t.dueDate < todayStart();
              return (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', fontSize: 13,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: priorityConfig[t.priority].color, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{t.title}</span>
                  {isOverdue && (
                    <span style={{ fontSize: 10, color: 'var(--color-rose)', fontWeight: 600 }}>overdue</span>
                  )}
                  {t.contextTag && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.contextTag}</span>
                  )}
                  <button className="btn-ghost" onClick={() => addSuggestion(t)}
                    style={{ fontSize: 11, padding: '3px 8px', color: 'var(--color-sky)' }}>
                    + Add
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick-add input */}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          className="input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Type a task... or "+search" to add existing'
          style={{ fontSize: 13, paddingRight: 60 }}
        />
        {input.trim() && (
          <button className="btn-ghost" onClick={parseAndAdd}
            style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 11, padding: '4px 8px' }}>
            Add
          </button>
        )}

        {/* Search dropdown */}
        {showSearch && (
          <div style={{
            position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4,
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)',
            zIndex: 50, maxHeight: 240, overflowY: 'auto',
          }}>
            <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Add existing task
            </div>
            {searchResults.map((t, idx) => (
              <div key={t.id}
                onClick={() => addExistingTask(t)}
                onMouseEnter={() => setSelectedIdx(idx)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                  cursor: 'pointer', fontSize: 13,
                  background: idx === selectedIdx ? 'var(--bg-input)' : 'transparent',
                }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: priorityConfig[t.priority].color, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{t.title}</span>
                {t.contextTag && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.contextTag}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Syntax hint */}
      <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <strong>+</strong>search existing &nbsp;·&nbsp;
        <strong>/high</strong> <strong>/low</strong> priority &nbsp;·&nbsp;
        <strong>/30m</strong> <strong>/1h</strong> time &nbsp;·&nbsp;
        <strong>/tag</strong> Name &nbsp;·&nbsp;
        <strong>/tomorrow</strong> &nbsp;·&nbsp;
        drag to reorder
      </div>
    </div>
  );
}
