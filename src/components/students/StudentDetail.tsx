'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/db';
import {
  newId, now, formatDate, formatMinutes, priorityConfig,
  lessonStatusConfig, toDateInputValue, fromDateInput
} from '@/lib/utils';
import type { Student, Note, Task, LessonPlan, LessonStatus, Attachment } from '@/types';
import Modal from '@/components/shared/Modal';
import TaskForm from '@/components/tasks/TaskForm';

type Tab = 'notes' | 'tasks' | 'lessons' | 'progress';

export default function StudentDetail({ student, onBack }: { student: Student; onBack: () => void }) {
  const { refreshKey, refresh } = useApp();
  const [tab, setTab] = useState<Tab>('notes');
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lessons, setLessons] = useState<LessonPlan[]>([]);
  const [progressNotes, setProgressNotes] = useState<Note[]>([]);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LessonPlan | undefined>();
  const [noteContent, setNoteContent] = useState('');
  const [noteTags, setNoteTags] = useState('');
  const [isProgress, setIsProgress] = useState(false);

  useEffect(() => {
    db.notes.where('studentId').equals(student.id).toArray().then(all => {
      setNotes(all.filter(n => !n.isProgressNote).sort((a, b) => b.createdAt - a.createdAt));
      setProgressNotes(all.filter(n => n.isProgressNote).sort((a, b) => b.createdAt - a.createdAt));
    });
    db.tasks.where('studentId').equals(student.id).toArray().then(t =>
      setTasks(t.sort((a, b) => priorityConfig[a.priority].sortOrder - priorityConfig[b.priority].sortOrder))
    );
    db.lessonPlans.where('studentId').equals(student.id).toArray().then(l =>
      setLessons(l.sort((a, b) => b.date - a.date))
    );
  }, [student.id, refreshKey]);

  const saveNote = async () => {
    if (!noteContent.trim()) return;
    await db.notes.add({
      id: newId(),
      content: noteContent.trim(),
      tags: noteTags.split(',').map(t => t.trim()).filter(Boolean),
      studentId: student.id,
      isProgressNote: isProgress,
      createdAt: now(),
      updatedAt: now(),
    });
    setNoteContent('');
    setNoteTags('');
    setIsProgress(false);
    setShowNoteForm(false);
    refresh();
  };

  const cloneLesson = (lesson: LessonPlan) => {
    setEditingLesson({
      ...lesson,
      id: newId(),
      title: `${lesson.title} (copy)`,
      status: 'draft',
      createdAt: now(),
      updatedAt: now(),
    });
    setShowLessonForm(true);
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'notes', label: 'Notes', count: notes.length },
    { id: 'tasks', label: 'Tasks', count: tasks.filter(t => t.status !== 'done').length },
    { id: 'lessons', label: 'Lessons', count: lessons.length },
    { id: 'progress', label: 'Progress', count: progressNotes.length },
  ];

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1000 }}>
      <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 16, fontSize: 13 }}>← Back to Students</button>

      <div className="flex items-center gap-4" style={{ marginBottom: 24 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'var(--color-accent-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: 20,
        }}>
          {student.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>{student.name}</h1>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {student.grade} · {student.subject}
            {student.contactInfo && ` · ${student.contactInfo}`}
          </div>
        </div>
        <div className="flex flex-wrap gap-1" style={{ marginLeft: 'auto' }}>
          {student.tags.map(tag => (
            <span key={tag} className="badge" style={{ background: 'var(--bg-tertiary)' }}>{tag}</span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1" style={{ marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            className={tab === t.id ? 'btn-primary' : 'btn-ghost'}
            style={{ fontSize: 13, padding: '6px 14px' }}
            onClick={() => setTab(t.id)}
          >
            {t.label} <span style={{ opacity: 0.6, marginLeft: 4 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'notes' && (
        <div>
          <button className="btn-primary" style={{ marginBottom: 12, fontSize: 13 }} onClick={() => { setIsProgress(false); setShowNoteForm(true); }}>
            + Add Note
          </button>
          {notes.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No notes yet.</p>}
          <div className="flex flex-col gap-2">
            {notes.map(n => (
              <div key={n.id} className="card" style={{ padding: '12px 14px' }}>
                <pre style={{ fontFamily: 'var(--font-body)', fontSize: 14, whiteSpace: 'pre-wrap', marginBottom: 6 }}>{n.content}</pre>
                <div className="flex items-center gap-2" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>{formatDate(n.createdAt)}</span>
                  {n.tags.map(t => <span key={t} className="badge" style={{ background: 'var(--bg-tertiary)' }}>{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <div>
          <button className="btn-primary" style={{ marginBottom: 12, fontSize: 13 }} onClick={() => setShowTaskForm(true)}>
            + Add Task
          </button>
          <div className="flex flex-col gap-2">
            {tasks.map(t => (
              <div key={t.id} className="flex items-center gap-3 card" style={{ padding: '10px 14px' }}>
                <button className="btn-icon" onClick={async () => {
                  await db.tasks.update(t.id, { status: t.status === 'done' ? 'todo' : 'done', completedAt: t.status === 'done' ? undefined : now() });
                  refresh();
                }} style={{ color: t.status === 'done' ? 'var(--color-emerald)' : 'var(--text-muted)' }}>
                  {t.status === 'done' ? '✓' : '○'}
                </button>
                <span style={{ color: priorityConfig[t.priority].color, fontSize: 10 }}>●</span>
                <span style={{ flex: 1, fontSize: 14, textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</span>
                {t.estimatedMinutes > 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatMinutes(t.estimatedMinutes)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'lessons' && (
        <div>
          <button className="btn-primary" style={{ marginBottom: 12, fontSize: 13 }} onClick={() => { setEditingLesson(undefined); setShowLessonForm(true); }}>
            + New Lesson Plan
          </button>
          {lessons.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No lesson plans yet.</p>}
          <div className="flex flex-col gap-3">
            {lessons.map(l => (
              <div key={l.id} className="card">
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <h3 style={{ fontWeight: 600, fontSize: 15 }}>{l.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="badge" style={{
                      background: lessonStatusConfig[l.status].color + '22',
                      color: lessonStatusConfig[l.status].color,
                    }}>{lessonStatusConfig[l.status].label}</span>
                    <button className="btn-icon" style={{ fontSize: 11 }} onClick={() => cloneLesson(l)}>Clone</button>
                    <button className="btn-icon" style={{ fontSize: 11 }} onClick={() => { setEditingLesson(l); setShowLessonForm(true); }}>Edit</button>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{formatDate(l.date)}</div>
                {l.objectives && <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Objectives:</strong> {l.objectives}</div>}
                {l.activities && <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Activities:</strong> {l.activities}</div>}
                {l.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2" style={{ marginTop: 4 }}>
                    {l.attachments.map((a, i) => (
                      <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="badge" style={{ background: 'var(--bg-tertiary)', cursor: 'pointer' }}>
                        📎 {a.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'progress' && (
        <div>
          <button className="btn-primary" style={{ marginBottom: 12, fontSize: 13 }} onClick={() => { setIsProgress(true); setShowNoteForm(true); }}>
            + Add Progress Note
          </button>
          {progressNotes.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No progress notes yet.</p>}
          <div style={{ position: 'relative', paddingLeft: 20 }}>
            <div style={{ position: 'absolute', left: 6, top: 0, bottom: 0, width: 2, background: 'var(--border-color)' }} />
            {progressNotes.map(n => (
              <div key={n.id} style={{ position: 'relative', marginBottom: 16 }}>
                <div style={{
                  position: 'absolute', left: -17, top: 6,
                  width: 10, height: 10, borderRadius: '50%',
                  background: 'var(--color-accent)',
                }} />
                <div className="card" style={{ marginLeft: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{formatDate(n.createdAt)}</div>
                  <pre style={{ fontFamily: 'var(--font-body)', fontSize: 14, whiteSpace: 'pre-wrap' }}>{n.content}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Note Form Modal */}
      <Modal open={showNoteForm} onClose={() => setShowNoteForm(false)} title={isProgress ? 'Progress Note' : 'Add Note'}>
        <div className="flex flex-col gap-3">
          <textarea className="textarea" rows={4} placeholder="Write your note (Markdown supported)" value={noteContent} onChange={e => setNoteContent(e.target.value)} autoFocus />
          {!isProgress && <input className="input" placeholder="Tags (comma-separated)" value={noteTags} onChange={e => setNoteTags(e.target.value)} />}
          <div className="flex gap-3 justify-end">
            <button className="btn-ghost" onClick={() => setShowNoteForm(false)}>Cancel</button>
            <button className="btn-primary" onClick={saveNote}>Save Note</button>
          </div>
        </div>
      </Modal>

      {/* Task Form Modal */}
      <Modal open={showTaskForm} onClose={() => setShowTaskForm(false)} title="Add Task for Student" wide>
        <TaskForm
          defaults={{ studentId: student.id, contextTag: student.name }}
          onSave={() => { setShowTaskForm(false); refresh(); }}
          onCancel={() => setShowTaskForm(false)}
        />
      </Modal>

      {/* Lesson Plan Form Modal */}
      <Modal open={showLessonForm} onClose={() => setShowLessonForm(false)} title={editingLesson?.id ? 'Edit Lesson Plan' : 'New Lesson Plan'} wide>
        <LessonForm
          lesson={editingLesson}
          studentId={student.id}
          onSave={() => { setShowLessonForm(false); refresh(); }}
          onCancel={() => setShowLessonForm(false)}
        />
      </Modal>
    </div>
  );
}

function LessonForm({ lesson, studentId, onSave, onCancel }: {
  lesson?: LessonPlan; studentId: string; onSave: () => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState(lesson?.title || '');
  const [date, setDate] = useState(toDateInputValue(lesson?.date || now()));
  const [objectives, setObjectives] = useState(lesson?.objectives || '');
  const [materials, setMaterials] = useState(lesson?.materials || '');
  const [activities, setActivities] = useState(lesson?.activities || '');
  const [notes, setNotes] = useState(lesson?.notes || '');
  const [status, setStatus] = useState<LessonStatus>(lesson?.status || 'draft');
  const [attachments, setAttachments] = useState<Attachment[]>(lesson?.attachments || []);
  const [newAttachName, setNewAttachName] = useState('');
  const [newAttachUrl, setNewAttachUrl] = useState('');

  const addAttachment = () => {
    if (!newAttachName || !newAttachUrl) return;
    setAttachments([...attachments, { name: newAttachName, url: newAttachUrl }]);
    setNewAttachName('');
    setNewAttachUrl('');
  };

  const save = async () => {
    if (!title.trim()) return;
    const data: LessonPlan = {
      id: lesson?.id || newId(),
      title: title.trim(),
      studentId,
      date: fromDateInput(date) || now(),
      objectives,
      materials,
      activities,
      notes,
      status,
      attachments,
      createdAt: lesson?.createdAt || now(),
      updatedAt: now(),
    };
    await db.lessonPlans.put(data);
    onSave();
  };

  return (
    <div className="flex flex-col gap-3">
      <input className="input" placeholder="Lesson title" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Date</label>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Status</label>
          <select className="select" value={status} onChange={e => setStatus(e.target.value as LessonStatus)}>
            <option value="draft">Draft</option>
            <option value="planned">Planned</option>
            <option value="delivered">Delivered</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </div>
      </div>
      <textarea className="textarea" placeholder="Objectives" value={objectives} onChange={e => setObjectives(e.target.value)} rows={2} />
      <textarea className="textarea" placeholder="Materials" value={materials} onChange={e => setMaterials(e.target.value)} rows={2} />
      <textarea className="textarea" placeholder="Activities" value={activities} onChange={e => setActivities(e.target.value)} rows={3} />
      <textarea className="textarea" placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />

      <div>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Attachments</label>
        {attachments.map((a, i) => (
          <div key={i} className="flex items-center gap-2" style={{ marginBottom: 4, fontSize: 13 }}>
            <span>📎 {a.name}</span>
            <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', fontSize: 12 }}>Open</a>
            <button className="btn-icon" onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} style={{ color: 'var(--color-rose)', fontSize: 11 }}>✕</button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input className="input" placeholder="Name" value={newAttachName} onChange={e => setNewAttachName(e.target.value)} style={{ flex: 1 }} />
          <input className="input" placeholder="URL" value={newAttachUrl} onChange={e => setNewAttachUrl(e.target.value)} style={{ flex: 2 }} />
          <button className="btn-ghost" onClick={addAttachment} style={{ fontSize: 12 }}>Add</button>
        </div>
      </div>

      <div className="flex gap-3 justify-end" style={{ marginTop: 8 }}>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={save}>{lesson ? 'Update' : 'Create'} Lesson</button>
      </div>
    </div>
  );
}
