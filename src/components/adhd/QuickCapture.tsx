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
      <div className="modal-content" style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 'var(--radius-sm)',
            background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, flex: 1 }}>Quick Capture</h2>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '3px 8px', borderRadius: 'var(--radius-sm)' }}>Esc</span>
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
          style={{ marginBottom: 14 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select className="select" style={{ width: 'auto', minWidth: 180 }} value={tag} onChange={e => setTag(e.target.value)}>
            <option value="">No tag (goes to Inbox)</option>
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
            Capture
          </button>
        </div>
      </div>
    </div>
  );
}
