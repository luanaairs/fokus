'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/db';
import { newId, now, formatDate, toDateInputValue, fromDateInput, writingStatusConfig } from '@/lib/utils';
import type { WritingProject, WritingStatus, Note, Task } from '@/types';
import Modal from '@/components/shared/Modal';
import TaskForm from '@/components/tasks/TaskForm';
import EmptyState from '@/components/shared/EmptyState';

export default function WritingProjects() {
  const { refreshKey, refresh, setActiveContext } = useApp();
  const [projects, setProjects] = useState<WritingProject[]>([]);
  const [selected, setSelected] = useState<WritingProject | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WritingProject | undefined>();

  useEffect(() => {
    db.writingProjects.toArray().then(wps => setProjects(wps.sort((a, b) => b.updatedAt - a.updatedAt)));
  }, [refreshKey]);

  if (selected) {
    return <WritingDetail project={selected} onBack={() => { setSelected(null); setActiveContext({}); }} />;
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1000 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700 }}>Writing Projects</h1>
        <button className="btn-primary" onClick={() => { setEditing(undefined); setShowForm(true); }}>+ New Project</button>
      </div>

      {projects.length === 0 ? (
        <EmptyState icon="✎" title="No writing projects" description="Track your fiction, essays, articles, and more" action={{ label: '+ Create Project', onClick: () => setShowForm(true) }} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {projects.map(wp => {
            const pct = wp.wordCountGoal > 0 ? (wp.currentWordCount / wp.wordCountGoal) * 100 : 0;
            return (
              <div key={wp.id} className="card" style={{ cursor: 'pointer' }} onClick={() => { setSelected(wp); setActiveContext({ type: 'writing', id: wp.id, label: wp.title }); }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}>{wp.title}</h3>
                  <span className="badge" style={{
                    background: writingStatusConfig[wp.status].color + '22',
                    color: writingStatusConfig[wp.status].color,
                  }}>{writingStatusConfig[wp.status].label}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                  {wp.genre}{wp.deadline ? ` · Due ${formatDate(wp.deadline)}` : ''}
                </div>
                {wp.wordCountGoal > 0 && (
                  <div>
                    <div className="flex justify-between" style={{ fontSize: 12, marginBottom: 4, color: 'var(--text-muted)' }}>
                      <span>{wp.currentWordCount.toLocaleString()} words</span>
                      <span>{Math.round(pct)}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: 'var(--color-accent)' }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Writing Project' : 'New Writing Project'}>
        <WritingForm project={editing} onSave={() => { setShowForm(false); refresh(); }} onCancel={() => setShowForm(false)} />
      </Modal>
    </div>
  );
}

function WritingForm({ project, onSave, onCancel }: { project?: WritingProject; onSave: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(project?.title || '');
  const [genre, setGenre] = useState(project?.genre || '');
  const [status, setStatus] = useState<WritingStatus>(project?.status || 'idea');
  const [editorUrl, setEditorUrl] = useState(project?.editorUrl || '');
  const [deadline, setDeadline] = useState(toDateInputValue(project?.deadline));
  const [wordCountGoal, setWordCountGoal] = useState(project?.wordCountGoal || 0);

  const save = async () => {
    if (!title.trim()) return;
    const data: WritingProject = {
      id: project?.id || newId(),
      title: title.trim(),
      genre,
      status,
      editorUrl,
      deadline: fromDateInput(deadline),
      wordCountGoal,
      currentWordCount: project?.currentWordCount || 0,
      wordCountHistory: project?.wordCountHistory || [],
      createdAt: project?.createdAt || now(),
      updatedAt: now(),
    };
    await db.writingProjects.put(data);
    onSave();
  };

  return (
    <div className="flex flex-col gap-3">
      <input className="input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <input className="input" placeholder="Genre / Type" value={genre} onChange={e => setGenre(e.target.value)} />
        <select className="select" value={status} onChange={e => setStatus(e.target.value as WritingStatus)}>
          {Object.entries(writingStatusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <input className="input" placeholder="Editor URL (Google Docs, Scrivener, etc.)" value={editorUrl} onChange={e => setEditorUrl(e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Deadline</label>
          <input type="date" className="input" value={deadline} onChange={e => setDeadline(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Word count goal</label>
          <input type="number" className="input" value={wordCountGoal} onChange={e => setWordCountGoal(Number(e.target.value))} />
        </div>
      </div>
      <div className="flex gap-3 justify-end" style={{ marginTop: 8 }}>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={save}>{project ? 'Update' : 'Create'}</button>
      </div>
    </div>
  );
}

function WritingDetail({ project, onBack }: { project: WritingProject; onBack: () => void }) {
  const { refreshKey, refresh } = useApp();
  const [wp, setWp] = useState(project);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newWC, setNewWC] = useState(wp.currentWordCount);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [noteContent, setNoteContent] = useState('');

  useEffect(() => {
    db.writingProjects.get(project.id).then(p => { if (p) setWp(p); });
    db.notes.where('writingProjectId').equals(project.id).toArray().then(n => setNotes(n.sort((a, b) => b.createdAt - a.createdAt)));
    db.tasks.where('writingProjectId').equals(project.id).toArray().then(setTasks);
  }, [project.id, refreshKey]);

  const updateWordCount = async () => {
    const history = [...wp.wordCountHistory, { date: now(), count: newWC }];
    await db.writingProjects.update(wp.id, { currentWordCount: newWC, wordCountHistory: history, updatedAt: now() });
    refresh();
  };

  const saveNote = async () => {
    if (!noteContent.trim()) return;
    await db.notes.add({
      id: newId(), content: noteContent.trim(), tags: [],
      writingProjectId: wp.id, isProgressNote: false,
      createdAt: now(), updatedAt: now(),
    });
    setNoteContent('');
    setShowNoteForm(false);
    refresh();
  };

  const pct = wp.wordCountGoal > 0 ? (wp.currentWordCount / wp.wordCountGoal) * 100 : 0;

  // Calculate velocity
  const recentEntries = wp.wordCountHistory.slice(-7);
  let velocity = 0;
  if (recentEntries.length >= 2) {
    const diff = recentEntries[recentEntries.length - 1].count - recentEntries[0].count;
    const days = Math.max(1, (recentEntries[recentEntries.length - 1].date - recentEntries[0].date) / (1000 * 60 * 60 * 24));
    velocity = Math.round(diff / days);
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1000 }}>
      <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 16, fontSize: 13 }}>← Back to Writing</button>

      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700 }}>{wp.title}</h1>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
            {wp.genre} · {writingStatusConfig[wp.status].label}
            {wp.deadline ? ` · Due ${formatDate(wp.deadline)}` : ''}
          </div>
        </div>
        {wp.editorUrl && (
          <a href={wp.editorUrl} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ textDecoration: 'none' }}>
            Open in Editor ↗
          </a>
        )}
      </div>

      {/* Word Count Tracker */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Word Count</h3>
        <div className="flex items-center gap-4" style={{ marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="flex justify-between" style={{ fontSize: 13, marginBottom: 4 }}>
              <span>{wp.currentWordCount.toLocaleString()} / {wp.wordCountGoal.toLocaleString()}</span>
              <span>{Math.round(pct)}%</span>
            </div>
            <div className="progress-bar" style={{ height: 10 }}>
              <div className="progress-bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: 'var(--color-accent)' }} />
            </div>
          </div>
          {velocity > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
              ~{velocity}/day velocity
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input type="number" className="input" style={{ width: 140 }} value={newWC} onChange={e => setNewWC(Number(e.target.value))} />
          <button className="btn-primary" style={{ fontSize: 13 }} onClick={updateWordCount}>Update</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Notes & Research */}
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>Notes & Research</h3>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowNoteForm(true)}>+ Add</button>
          </div>
          <div className="flex flex-col gap-2">
            {notes.map(n => (
              <div key={n.id} className="card" style={{ padding: '10px 12px' }}>
                <pre style={{ fontFamily: 'var(--font-body)', fontSize: 13, whiteSpace: 'pre-wrap' }}>{n.content}</pre>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{formatDate(n.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Linked Tasks */}
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>Tasks</h3>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowTaskForm(true)}>+ Add</button>
          </div>
          <div className="flex flex-col gap-2">
            {tasks.map(t => (
              <div key={t.id} className="flex items-center gap-2 card" style={{ padding: '8px 12px' }}>
                <button className="btn-icon" onClick={async () => {
                  await db.tasks.update(t.id, { status: t.status === 'done' ? 'todo' : 'done', completedAt: t.status === 'done' ? undefined : now() });
                  refresh();
                }} style={{ color: t.status === 'done' ? 'var(--color-emerald)' : 'var(--text-muted)' }}>
                  {t.status === 'done' ? '✓' : '○'}
                </button>
                <span style={{ fontSize: 13, textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={showNoteForm} onClose={() => setShowNoteForm(false)} title="Add Note">
        <div className="flex flex-col gap-3">
          <textarea className="textarea" rows={4} placeholder="Research notes, references, ideas..." value={noteContent} onChange={e => setNoteContent(e.target.value)} autoFocus />
          <div className="flex gap-3 justify-end">
            <button className="btn-ghost" onClick={() => setShowNoteForm(false)}>Cancel</button>
            <button className="btn-primary" onClick={saveNote}>Save</button>
          </div>
        </div>
      </Modal>

      <Modal open={showTaskForm} onClose={() => setShowTaskForm(false)} title="Add Task" wide>
        <TaskForm
          defaults={{ writingProjectId: wp.id, contextTag: wp.title }}
          onSave={() => { setShowTaskForm(false); refresh(); }}
          onCancel={() => setShowTaskForm(false)}
        />
      </Modal>
    </div>
  );
}
