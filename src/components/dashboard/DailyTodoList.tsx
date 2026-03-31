'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '@/lib/context';
import { db, completeTaskById, uncompleteTaskById } from '@/lib/db';
import { newId, now, todayEnd, priorityConfig } from '@/lib/utils';
import type { Task, Priority } from '@/types';

/**
 * DailyTodoList — a lightweight "today" checklist on the dashboard.
 *
 * Quick-add syntax:  type a task title, then optionally:
 *   /high /critical /low   → set priority
 *   /30m /1h /15m           → estimated time
 *   /tag Some Tag           → context tag
 *   /tomorrow               → due tomorrow instead of today
 *
 * Also supports picking from existing undone tasks via a search dropdown.
 */

interface DailyItem {
  id: string;
  taskId?: string;   // links to a real Task
  label: string;
  done: boolean;
  priority?: Priority;
  estimatedMinutes?: number;
  sortOrder: number;
}

const STORAGE_KEY = 'fokus-daily-todo';

function loadDailyItems(): DailyItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // clear stale list (saved on a different day)
    if (parsed.date !== new Date().toISOString().split('T')[0]) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return parsed.items || [];
  } catch {
    return [];
  }
}

function saveDailyItems(items: DailyItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    date: new Date().toISOString().split('T')[0],
    items,
  }));
}

interface Props {
  onFocusTask?: (taskId: string) => void;
}

export default function DailyTodoList({ onFocusTask }: Props) {
  const { refreshKey, refresh } = useApp();
  const [items, setItems] = useState<DailyItem[]>(() => loadDailyItems());
  const [input, setInput] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<Task[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Persist whenever items change
  useEffect(() => { saveDailyItems(items); }, [items]);

  // Search existing tasks when input starts with "+"
  useEffect(() => {
    if (!input.startsWith('+') || input.length < 2) {
      setShowSearch(false);
      return;
    }
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

  const parseAndAdd = async () => {
    const raw = input.trim();
    if (!raw) return;

    // If a search result is selected
    if (showSearch && searchResults.length > 0) {
      addExistingTask(searchResults[selectedIdx]);
      return;
    }

    // Parse slash commands
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
        // collect everything until next / or end
        i++;
        const tagParts: string[] = [];
        while (i < parts.length && !parts[i].startsWith('/')) {
          tagParts.push(parts[i]);
          i++;
        }
        contextTag = tagParts.join(' ');
        continue;
      } else {
        titleParts.push(p);
      }
      i++;
    }

    title = titleParts.join(' ');
    if (!title) return;

    // Create a real task in DB
    const dueDate = dueTomorrow
      ? (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(23, 59, 59, 999); return d.getTime(); })()
      : todayEnd();

    const taskId = newId();
    const task: Task = {
      id: taskId,
      title,
      description: '',
      dueDate,
      priority,
      contextTag,
      estimatedMinutes,
      status: 'todo',
      isRecurring: false,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.tasks.add(task);

    setItems(prev => [...prev, {
      id: newId(), taskId, label: title, done: false,
      priority, estimatedMinutes: estimatedMinutes || undefined,
      sortOrder: prev.length,
    }]);
    setInput('');
    setShowSearch(false);
    refresh();
  };

  const addExistingTask = (task: Task) => {
    setItems(prev => [...prev, {
      id: newId(), taskId: task.id, label: task.title, done: task.status === 'done',
      priority: task.priority, estimatedMinutes: task.estimatedMinutes || undefined,
      sortOrder: prev.length,
    }]);
    setInput('');
    setShowSearch(false);
  };

  const toggleDone = async (item: DailyItem) => {
    const newDone = !item.done;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, done: newDone } : i));
    if (item.taskId) {
      if (newDone) await completeTaskById(item.taskId);
      else await uncompleteTaskById(item.taskId);
      refresh();
    }
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

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
          {items.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
              borderRadius: 'var(--radius-sm)', background: item.done ? 'var(--color-emerald-light)' : 'var(--bg-input)',
              transition: 'background 0.15s',
            }}>
              <button className="btn-icon" onClick={() => toggleDone(item)}
                style={{ padding: 2, color: item.done ? 'var(--color-emerald)' : 'var(--text-muted)', flexShrink: 0 }}>
                {item.done ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg>
                )}
              </button>

              {item.priority && item.priority !== 'medium' && (
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: priorityConfig[item.priority].color,
                }} />
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
                  {item.estimatedMinutes >= 60 ? `${Math.floor(item.estimatedMinutes / 60)}h${item.estimatedMinutes % 60 ? item.estimatedMinutes % 60 + 'm' : ''}` : `${item.estimatedMinutes}m`}
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
          <div ref={dropdownRef} style={{
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
        <strong>/tomorrow</strong>
      </div>
    </div>
  );
}
