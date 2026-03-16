'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { db, completeTaskById, uncompleteTaskById } from '@/lib/db';
import {
  priorityConfig, statusConfig, formatMinutes, formatDateShort,
  todayStart, todayEnd, daysFromNow, now
} from '@/lib/utils';
import type { Task, Project, Student } from '@/types';
import Modal from '@/components/shared/Modal';
import TaskForm from './TaskForm';
import ProjectManager from './ProjectManager';
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
  const [showProjectManager, setShowProjectManager] = useState(false);

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

      setTasks(filtered);
    });
  }, [refreshKey, view, filterProject, filterStudent]);

  const complete = async (id: string) => {
    await completeTaskById(id);
    refresh();
  };

  const defer = async (id: string, days: number) => {
    const date = daysFromNow(days);
    await db.tasks.update(id, { dueDate: date, status: 'deferred', deferredUntil: date });
    refresh();
  };

  const deleteTask = async (id: string) => {
    await db.tasks.delete(id);
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
    <div style={{ padding: '32px 36px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32 }}>Tasks</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={() => setShowProjectManager(true)}>Manage Projects</button>
          <button className="btn-primary" onClick={() => { setEditingTask(undefined); setShowForm(true); }}>+ New Task</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {views.map(v => (
          <button
            key={v.id}
            style={{
              padding: '7px 16px', borderRadius: 'var(--radius-full)', fontSize: 13, fontWeight: 500,
              background: view === v.id ? 'var(--color-accent)' : 'var(--bg-card)',
              color: view === v.id ? 'white' : 'var(--text-secondary)',
              border: view === v.id ? 'none' : '1px solid var(--border-color)',
              cursor: 'pointer', transition: 'all 0.15s ease',
              boxShadow: view === v.id ? '0 2px 8px rgba(224,122,95,0.25)' : 'var(--shadow-sm)',
            }}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}

        {view === 'project' && (
          <select className="select" style={{ width: 'auto', marginLeft: 8, borderRadius: 'var(--radius-full)' }} value={filterProject} onChange={e => setFilterProject(e.target.value)}>
            <option value="">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {view === 'student' && (
          <select className="select" style={{ width: 'auto', marginLeft: 8, borderRadius: 'var(--radius-full)' }} value={filterStudent} onChange={e => setFilterStudent(e.target.value)}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
        <TaskForm task={editingTask} onSave={() => { setShowForm(false); refresh(); }} onCancel={() => setShowForm(false)} />
      </Modal>

      <Modal open={!!showSubtaskForm} onClose={() => setShowSubtaskForm(null)} title="Add Subtask">
        <TaskForm defaults={{ parentTaskId: showSubtaskForm || undefined }} onSave={() => { setShowSubtaskForm(null); refresh(); }} onCancel={() => setShowSubtaskForm(null)} />
      </Modal>

      <ProjectManager open={showProjectManager} onClose={() => setShowProjectManager(false)} onRefresh={() => { db.projects.toArray().then(setProjects); refresh(); }} />
    </div>
  );
}

function TaskRow({
  task, onComplete, onEdit, onDelete, onDefer, onFocus, onTimer, onAddSubtask,
  projects, students, refreshKey, refresh,
}: {
  task: Task; onComplete: () => void; onEdit: () => void; onDelete: () => void;
  onDefer: (days: number) => void; onFocus: () => void; onTimer: () => void;
  onAddSubtask: () => void; projects: Project[]; students: Student[];
  refreshKey: number; refresh: () => void;
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
        className="task-row"
        style={{ opacity: isDone ? 0.5 : 1 }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <button className="btn-icon" onClick={onComplete} style={{ color: isDone ? 'var(--color-emerald)' : 'var(--text-muted)' }}>
          {isDone ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--color-emerald)" stroke="var(--color-emerald)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M8 12l2.5 2.5L16 9" stroke="white" strokeWidth="2.5" fill="none" /></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /></svg>
          )}
        </button>
        <div className="priority-dot" style={{ background: priorityConfig[task.priority].color }} />
        <div style={{ flex: 1, cursor: 'pointer', minWidth: 0 }} onClick={onEdit}>
          <div style={{ fontSize: 14, fontWeight: 500, textDecoration: isDone ? 'line-through' : 'none' }}>
            {task.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            {project && (
              <span className="badge" style={{ background: project.color + '15', color: project.color, fontSize: 11 }}>{project.name}</span>
            )}
            {student && <span className="badge" style={{ fontSize: 11 }}>{student.name}</span>}
            {task.contextTag && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{task.contextTag}</span>}
            {task.isRecurring && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>↻ recurring</span>}
            {subtasks.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {subtasks.filter(s => s.status === 'done').length}/{subtasks.length} subtasks
              </span>
            )}
          </div>
        </div>
        {task.dueDate && (
          <span style={{ fontSize: 12, color: task.dueDate < now() && !isDone ? 'var(--color-rose)' : 'var(--text-muted)', fontWeight: 500 }}>
            {formatDateShort(task.dueDate)}
          </span>
        )}
        {task.estimatedMinutes > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {formatMinutes(task.estimatedMinutes)}
          </span>
        )}
        <span className="badge" style={{
          background: statusConfig[task.status].color + '15',
          color: statusConfig[task.status].color,
          fontSize: 11,
        }}>
          {statusConfig[task.status].label}
        </span>

        {showActions && !isDone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button className="btn-icon" onClick={onTimer} title="Start timer" style={{ color: 'var(--color-accent)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            </button>
            <button className="btn-icon" onClick={onFocus} title="Focus mode" style={{ color: 'var(--color-accent)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>
            </button>
            <button className="btn-icon" onClick={() => onDefer(1)} title="Defer to tomorrow">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </button>
            <button className="btn-icon" onClick={onAddSubtask} title="Add subtask" style={{ fontSize: 10, fontWeight: 600 }}>+sub</button>
            <button className="btn-icon" onClick={onDelete} title="Delete" style={{ color: 'var(--color-rose)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        )}
      </div>

      {subtasks.length > 0 && (
        <div style={{ marginLeft: 44, marginTop: 4 }}>
          {subtasks.map(sub => (
            <div key={sub.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', fontSize: 13, borderLeft: '2px solid var(--border-color)',
              marginBottom: 2,
            }}>
              <button className="btn-icon" onClick={async () => {
                if (sub.status === 'done') { await uncompleteTaskById(sub.id); } else { await completeTaskById(sub.id); }
                refresh();
              }} style={{ color: sub.status === 'done' ? 'var(--color-emerald)' : 'var(--text-muted)', padding: 4 }}>
                {sub.status === 'done' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-emerald)" stroke="var(--color-emerald)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M8 12l2.5 2.5L16 9" stroke="white" strokeWidth="2.5" fill="none" /></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /></svg>
                )}
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
