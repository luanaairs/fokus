'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/db';
import {
  priorityConfig, statusConfig, formatMinutes, formatDateShort,
  todayStart, todayEnd, daysFromNow, now
} from '@/lib/utils';
import type { Task, Project, Student } from '@/types';
import Modal from '@/components/shared/Modal';
import TaskForm from './TaskForm';
import EmptyState from '@/components/shared/EmptyState';

type ViewMode = 'today' | 'upcoming' | 'project' | 'student' | 'backlog' | 'all';

export default function TaskList() {
  const { refreshKey, refresh, setFocusMode, setFocusTaskId, setTimerTaskId, setTimerDuration } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<ViewMode>('today');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filterProject, setFilterProject] = useState('');
  const [filterStudent, setFilterStudent] = useState('');
  const [showSubtaskForm, setShowSubtaskForm] = useState<string | null>(null);

  useEffect(() => {
    db.projects.toArray().then(setProjects);
    db.students.toArray().then(setStudents);
  }, [refreshKey]);

  useEffect(() => {
    db.tasks.toArray().then(allTasks => {
      const start = todayStart();
      const end = todayEnd();
      const weekEnd = daysFromNow(7);

      let filtered: Task[];
      switch (view) {
        case 'today':
          filtered = allTasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate >= start && t.dueDate <= end && !t.parentTaskId);
          break;
        case 'upcoming':
          filtered = allTasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate > end && t.dueDate <= weekEnd && !t.parentTaskId);
          break;
        case 'project':
          filtered = allTasks.filter(t => t.status !== 'done' && (!filterProject || t.projectId === filterProject) && !t.parentTaskId);
          break;
        case 'student':
          filtered = allTasks.filter(t => t.status !== 'done' && (!filterStudent || t.studentId === filterStudent) && !t.parentTaskId);
          break;
        case 'backlog':
          filtered = allTasks.filter(t => t.status !== 'done' && !t.dueDate && !t.parentTaskId);
          break;
        default:
          filtered = allTasks.filter(t => !t.parentTaskId);
      }

      filtered.sort((a, b) => {
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (a.status !== 'done' && b.status === 'done') return -1;
        return priorityConfig[a.priority].sortOrder - priorityConfig[b.priority].sortOrder;
      });

      // Attach subtasks
      const withSubs = filtered.map(t => ({
        ...t,
        _subtasks: allTasks.filter(s => s.parentTaskId === t.id),
      }));
      setTasks(filtered);
    });
  }, [refreshKey, view, filterProject, filterStudent]);

  const complete = async (id: string) => {
    await db.tasks.update(id, { status: 'done', completedAt: now() });
    refresh();
  };

  const defer = async (id: string, days: number) => {
    const date = daysFromNow(days);
    await db.tasks.update(id, { dueDate: date, status: 'deferred', deferredUntil: date });
    refresh();
  };

  const deleteTask = async (id: string) => {
    await db.tasks.delete(id);
    // Delete subtasks
    const subs = await db.tasks.where('parentTaskId').equals(id).toArray();
    await db.tasks.bulkDelete(subs.map(s => s.id));
    refresh();
  };

  const startTimer = (t: Task) => {
    setTimerTaskId(t.id);
    setTimerDuration(t.estimatedMinutes || 25);
  };

  const views: { id: ViewMode; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'project', label: 'By Project' },
    { id: 'student', label: 'By Student' },
    { id: 'backlog', label: 'Backlog' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1000 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700 }}>Tasks</h1>
        <button className="btn-primary" onClick={() => { setEditingTask(undefined); setShowForm(true); }}>+ New Task</button>
      </div>

      <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
        {views.map(v => (
          <button
            key={v.id}
            className={view === v.id ? 'btn-primary' : 'btn-ghost'}
            style={{ fontSize: 13, padding: '6px 12px' }}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}

        {view === 'project' && (
          <select className="select" style={{ width: 'auto', marginLeft: 8 }} value={filterProject} onChange={e => setFilterProject(e.target.value)}>
            <option value="">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {view === 'student' && (
          <select className="select" style={{ width: 'auto', marginLeft: 8 }} value={filterStudent} onChange={e => setFilterStudent(e.target.value)}>
            <option value="">All students</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon="☰"
          title={view === 'today' ? 'No tasks for today' : view === 'backlog' ? 'Backlog is empty' : 'No tasks found'}
          description="Create a new task or use Quick Capture"
          action={{ label: '+ New Task', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map(t => (
            <TaskRow
              key={t.id}
              task={t}
              onComplete={() => complete(t.id)}
              onEdit={() => { setEditingTask(t); setShowForm(true); }}
              onDelete={() => deleteTask(t.id)}
              onDefer={(d) => defer(t.id, d)}
              onFocus={() => { setFocusTaskId(t.id); setFocusMode(true); }}
              onTimer={() => startTimer(t)}
              onAddSubtask={() => setShowSubtaskForm(t.id)}
              projects={projects}
              students={students}
              refreshKey={refreshKey}
              refresh={refresh}
            />
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingTask ? 'Edit Task' : 'New Task'} wide>
        <TaskForm
          task={editingTask}
          onSave={() => { setShowForm(false); refresh(); }}
          onCancel={() => setShowForm(false)}
        />
      </Modal>

      <Modal open={!!showSubtaskForm} onClose={() => setShowSubtaskForm(null)} title="Add Subtask">
        <TaskForm
          defaults={{ parentTaskId: showSubtaskForm || undefined }}
          onSave={() => { setShowSubtaskForm(null); refresh(); }}
          onCancel={() => setShowSubtaskForm(null)}
        />
      </Modal>
    </div>
  );
}

function TaskRow({
  task, onComplete, onEdit, onDelete, onDefer, onFocus, onTimer, onAddSubtask,
  projects, students, refreshKey, refresh,
}: {
  task: Task;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDefer: (days: number) => void;
  onFocus: () => void;
  onTimer: () => void;
  onAddSubtask: () => void;
  projects: Project[];
  students: Student[];
  refreshKey: number;
  refresh: () => void;
}) {
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    db.tasks.where('parentTaskId').equals(task.id).toArray().then(setSubtasks);
  }, [task.id, refreshKey]);

  const project = projects.find(p => p.id === task.projectId);
  const student = students.find(s => s.id === task.studentId);
  const isDone = task.status === 'done';

  return (
    <div>
      <div
        className="flex items-center gap-3"
        style={{
          padding: '10px 14px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          opacity: isDone ? 0.5 : 1,
        }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <button className="btn-icon" onClick={onComplete} style={{ color: isDone ? 'var(--color-emerald)' : 'var(--text-muted)', fontSize: 16 }}>
          {isDone ? '✓' : '○'}
        </button>
        <span style={{ color: priorityConfig[task.priority].color, fontSize: 10 }}>●</span>
        <div style={{ flex: 1, cursor: 'pointer' }} onClick={onEdit}>
          <div style={{ fontSize: 14, fontWeight: 500, textDecoration: isDone ? 'line-through' : 'none' }}>
            {task.title}
          </div>
          <div className="flex items-center gap-2" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {project && (
              <span className="badge" style={{ background: project.color + '22', color: project.color }}>{project.name}</span>
            )}
            {student && <span className="badge" style={{ background: 'var(--bg-tertiary)' }}>{student.name}</span>}
            {task.contextTag && <span>{task.contextTag}</span>}
            {task.isRecurring && <span>↻</span>}
            {subtasks.length > 0 && <span>{subtasks.filter(s => s.status === 'done').length}/{subtasks.length} subtasks</span>}
          </div>
        </div>
        {task.dueDate && (
          <span style={{ fontSize: 12, color: task.dueDate < now() && !isDone ? 'var(--color-rose)' : 'var(--text-muted)' }}>
            {formatDateShort(task.dueDate)}
          </span>
        )}
        {task.estimatedMinutes > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {formatMinutes(task.estimatedMinutes)}
          </span>
        )}
        <span className="badge" style={{
          background: statusConfig[task.status].color + '22',
          color: statusConfig[task.status].color,
          fontSize: 11,
        }}>
          {statusConfig[task.status].label}
        </span>

        {showActions && !isDone && (
          <div className="flex items-center gap-1">
            <button className="btn-icon" onClick={onTimer} title="Start timer">⏱</button>
            <button className="btn-icon" onClick={onFocus} title="Focus mode">◎</button>
            <button className="btn-icon" onClick={() => onDefer(1)} title="Defer to tomorrow">→</button>
            <button className="btn-icon" onClick={onAddSubtask} title="Add subtask" style={{ fontSize: 11 }}>+sub</button>
            <button className="btn-icon" onClick={onDelete} title="Delete" style={{ color: 'var(--color-rose)' }}>✕</button>
          </div>
        )}
      </div>

      {subtasks.length > 0 && (
        <div style={{ marginLeft: 36, marginTop: 2 }}>
          {subtasks.map(sub => (
            <div key={sub.id} className="flex items-center gap-2" style={{
              padding: '6px 10px', fontSize: 13, borderLeft: '2px solid var(--border-color)',
            }}>
              <button className="btn-icon" onClick={async () => {
                await db.tasks.update(sub.id, { status: sub.status === 'done' ? 'todo' : 'done', completedAt: sub.status === 'done' ? undefined : now() });
                refresh();
              }} style={{ color: sub.status === 'done' ? 'var(--color-emerald)' : 'var(--text-muted)', fontSize: 14 }}>
                {sub.status === 'done' ? '✓' : '○'}
              </button>
              <span style={{ textDecoration: sub.status === 'done' ? 'line-through' : 'none', color: sub.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                {sub.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
