'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/db';
import { newId, now, priorityConfig, formatDate } from '@/lib/utils';
import type { Task } from '@/types';

interface DoomTask {
  task: Task;
  deferCount: number;
}

export default function DoomPileDetector({ onNavigateToTasks }: { onNavigateToTasks: () => void }) {
  const { refreshKey, refresh } = useApp();
  const [doomTasks, setDoomTasks] = useState<DoomTask[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    db.tasks.toArray().then(allTasks => {
      // Find tasks that have been deferred or are old and still open
      const candidates: DoomTask[] = [];

      allTasks.forEach(t => {
        if (t.status === 'done') return;

        let deferCount = 0;

        // Count how many times dueDate has likely been pushed back
        // (estimate: tasks older than 14 days that are still todo)
        const ageInDays = (Date.now() - t.createdAt) / (24 * 60 * 60 * 1000);

        if (t.status === 'deferred') {
          deferCount = 3; // Explicitly deferred
        } else if (ageInDays > 30 && t.status === 'todo') {
          deferCount = Math.floor(ageInDays / 10); // Sitting for a long time
        } else if (t.dueDate && t.dueDate < Date.now() - 7 * 24 * 60 * 60 * 1000 && t.status === 'todo') {
          deferCount = 3; // Overdue by more than a week
        }

        if (deferCount >= 3) {
          candidates.push({ task: t, deferCount });
        }
      });

      candidates.sort((a, b) => b.deferCount - a.deferCount);
      setDoomTasks(candidates.slice(0, 10));
    });
  }, [refreshKey]);

  const visibleTasks = doomTasks.filter(d => !dismissed.has(d.task.id));

  if (visibleTasks.length === 0) return null;

  const breakDown = async (task: Task) => {
    // Create 3 smaller subtasks from the original
    const subtaskTitles = [
      `${task.title} — Part 1: Start`,
      `${task.title} — Part 2: Continue`,
      `${task.title} — Part 3: Finish`,
    ];
    for (let i = 0; i < subtaskTitles.length; i++) {
      await db.tasks.add({
        id: newId(),
        title: subtaskTitles[i],
        description: '',
        priority: task.priority,
        projectId: task.projectId,
        studentId: task.studentId,
        contextTag: task.contextTag,
        estimatedMinutes: Math.ceil((task.estimatedMinutes || 30) / 3),
        status: 'todo',
        parentTaskId: task.id,
        isRecurring: false,
        createdAt: now(),
        updatedAt: now(),
      });
    }
    await db.tasks.update(task.id, { status: 'done', completedAt: now() });
    refresh();
  };

  const dropTask = async (id: string) => {
    await db.tasks.update(id, { status: 'done', completedAt: now() });
    refresh();
  };

  return (
    <div className="card" style={{ padding: 20, borderLeft: '4px solid var(--color-amber)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 20 }}>🪨</span>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>Doom Pile</h3>
        <span className="badge" style={{ background: 'var(--color-amber-light)', color: 'var(--color-amber)', fontSize: 11 }}>
          {visibleTasks.length} stuck
        </span>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>
        These tasks keep getting pushed. Break them down, delegate, or let them go.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibleTasks.slice(0, 5).map(({ task, deferCount }) => (
          <div key={task.id} style={{
            background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', overflow: 'hidden',
          }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                cursor: 'pointer',
              }}
              onClick={() => setExpandedId(expandedId === task.id ? null : task.id)}
            >
              <div className="priority-dot" style={{ background: priorityConfig[task.priority].color }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{task.title}</span>
              <span style={{ fontSize: 11, color: 'var(--color-amber)', fontWeight: 600 }}>
                ~{deferCount}x deferred
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                style={{ transform: expandedId === task.id ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>

            {expandedId === task.id && (
              <div style={{ padding: '8px 14px 12px', borderTop: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  Created {formatDate(task.createdAt)}
                  {task.dueDate && ` · Due ${formatDate(task.dueDate)}`}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-ghost" onClick={() => breakDown(task)} style={{ fontSize: 12, padding: '6px 12px' }}>
                    Break It Down
                  </button>
                  <button className="btn-ghost" onClick={() => setDismissed(d => new Set(d).add(task.id))} style={{ fontSize: 12, padding: '6px 12px' }}>
                    Not Now
                  </button>
                  <button className="btn-ghost" onClick={() => dropTask(task.id)} style={{ fontSize: 12, padding: '6px 12px', color: 'var(--color-accent)' }}>
                    Drop It
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
