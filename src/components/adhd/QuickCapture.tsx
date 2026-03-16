'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { useEscape } from '@/hooks/useKeyboard';
import { db } from '@/lib/db';
import { newId, now } from '@/lib/utils';
import type { Student, Project } from '@/types';

export default function QuickCapture() {
  const { captureOpen, setCaptureOpen, refresh } = useApp();
  const [content, setContent] = useState('');
  const [tag, setTag] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEscape(() => setCaptureOpen(false));

  useEffect(() => {
    if (captureOpen) {
      db.students.toArray().then(setStudents);
      db.projects.toArray().then(setProjects);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setContent('');
      setTag('');
    }
  }, [captureOpen]);

  if (!captureOpen) return null;

  const submit = async () => {
    if (!content.trim()) return;
    const [tagType, tagId] = tag.split(':');
    await db.captures.add({
      id: newId(),
      content: content.trim(),
      tags: tag ? [tag] : [],
      studentId: tagType === 'student' ? tagId : undefined,
      projectId: tagType === 'project' ? tagId : undefined,
      processed: false,
      createdAt: now(),
    });
    setContent('');
    setTag('');
    setCaptureOpen(false);
    refresh();
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setCaptureOpen(false); }}>
      <div className="modal-content" style={{ maxWidth: 500 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
          <span style={{ color: 'var(--color-accent)', fontSize: 18 }}>+</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>Quick Capture</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>Esc to close</span>
        </div>
        <textarea
          ref={inputRef}
          className="textarea"
          placeholder="What's on your mind? Task, note, idea..."
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
          }}
          rows={3}
        />
        <div className="flex items-center gap-3" style={{ marginTop: 12 }}>
          <select className="select" style={{ width: 'auto', minWidth: 160 }} value={tag} onChange={e => setTag(e.target.value)}>
            <option value="">No tag (→ Inbox)</option>
            <optgroup label="Students">
              {students.map(s => <option key={s.id} value={`student:${s.id}`}>{s.name}</option>)}
            </optgroup>
            <optgroup label="Projects">
              {projects.map(p => <option key={p.id} value={`project:${p.id}`}>{p.name}</option>)}
            </optgroup>
          </select>
          <div style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={() => setCaptureOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={submit}>
            Capture <span style={{ opacity: 0.6, fontSize: 11, marginLeft: 4 }}>⌘↵</span>
          </button>
        </div>
      </div>
    </div>
  );
}
