'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/db';
import { newId, now, toDateInputValue, fromDateInput } from '@/lib/utils';
import type { Task, Priority, TaskStatus, RecurrenceType, Student, Project, WritingProject } from '@/types';

interface Props {
  task?: Task;
  defaults?: Partial<Task>;
  onSave: () => void;
  onCancel: () => void;
}

export default function TaskForm({ task, defaults, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(task?.title || defaults?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [dueDate, setDueDate] = useState(toDateInputValue(task?.dueDate || defaults?.dueDate));
  const [priority, setPriority] = useState<Priority>(task?.priority || defaults?.priority || 'medium');
  const [projectId, setProjectId] = useState(task?.projectId || defaults?.projectId || '');
  const [studentId, setStudentId] = useState(task?.studentId || defaults?.studentId || '');
  const [writingProjectId, setWritingProjectId] = useState(task?.writingProjectId || defaults?.writingProjectId || '');
  const [contextTag, setContextTag] = useState(task?.contextTag || defaults?.contextTag || '');
  const [estimatedMinutes, setEstimatedMinutes] = useState(task?.estimatedMinutes || 25);
  const [status, setStatus] = useState<TaskStatus>(task?.status || 'todo');
  const [isRecurring, setIsRecurring] = useState(task?.isRecurring || false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(task?.recurrenceType || 'weekly');
  const [parentTaskId] = useState(task?.parentTaskId || defaults?.parentTaskId || '');

  const [students, setStudents] = useState<Student[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [wps, setWps] = useState<WritingProject[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    db.students.toArray().then(setStudents);
    db.projects.toArray().then(setProjects);
    db.writingProjects.toArray().then(setWps);
    setTimeout(() => titleRef.current?.focus(), 50);
  }, []);

  const save = async () => {
    if (!title.trim()) return;
    const data: Task = {
      id: task?.id || newId(),
      title: title.trim(),
      description,
      dueDate: fromDateInput(dueDate),
      priority,
      projectId: projectId || undefined,
      studentId: studentId || undefined,
      writingProjectId: writingProjectId || undefined,
      contextTag,
      estimatedMinutes,
      status,
      parentTaskId: parentTaskId || undefined,
      isRecurring,
      recurrenceType: isRecurring ? recurrenceType : undefined,
      completedAt: task?.completedAt,
      deferredUntil: task?.deferredUntil,
      createdAt: task?.createdAt || now(),
      updatedAt: now(),
    };
    await db.tasks.put(data);
    onSave();
  };

  return (
    <div className="flex flex-col gap-3">
      <input ref={titleRef} className="input" placeholder="Task title" value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(); }} />

      <textarea className="textarea" placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} rows={2} />

      <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Due date</label>
          <input type="date" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Priority</label>
          <select className="select" value={priority} onChange={e => setPriority(e.target.value as Priority)}>
            <option value="critical">🔴 Critical</option>
            <option value="high">🟠 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>
        </div>
      </div>

      <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Estimated time</label>
          <select className="select" value={estimatedMinutes} onChange={e => setEstimatedMinutes(Number(e.target.value))}>
            {[5, 10, 15, 25, 30, 45, 60, 90, 120].map(m => (
              <option key={m} value={m}>{m}min</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Status</label>
          <select className="select" value={status} onChange={e => setStatus(e.target.value as TaskStatus)}>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
            <option value="deferred">Deferred</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Project</label>
          <select className="select" value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="">None</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Student</label>
          <select className="select" value={studentId} onChange={e => setStudentId(e.target.value)}>
            <option value="">None</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Writing</label>
          <select className="select" value={writingProjectId} onChange={e => setWritingProjectId(e.target.value)}>
            <option value="">None</option>
            {wps.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
          </select>
        </div>
      </div>

      <input className="input" placeholder="Context tag (e.g. subject, personal)" value={contextTag} onChange={e => setContextTag(e.target.value)} />

      <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
        <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)}
          style={{ accentColor: 'var(--color-accent)' }} />
        Recurring task
      </label>
      {isRecurring && (
        <select className="select" value={recurrenceType} onChange={e => setRecurrenceType(e.target.value as RecurrenceType)} style={{ width: 'auto' }}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="custom">Custom</option>
        </select>
      )}

      <div className="flex gap-3 justify-end" style={{ marginTop: 8 }}>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={save}>
          {task ? 'Update' : 'Create'} Task <span style={{ opacity: 0.6, fontSize: 11, marginLeft: 4 }}>⌘↵</span>
        </button>
      </div>
    </div>
  );
}
