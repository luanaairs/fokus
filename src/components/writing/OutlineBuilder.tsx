'use client';

import React, { useState } from 'react';
import { db } from '@/lib/db';
import { newId, now } from '@/lib/utils';
import type { WritingProject, OutlineSection } from '@/types';

interface Props {
  project: WritingProject;
  onRefresh: () => void;
}

const STATUS_COLORS = {
  todo: 'var(--text-muted)',
  drafting: 'var(--color-sky)',
  done: 'var(--color-emerald)',
};

export default function OutlineBuilder({ project, onRefresh }: Props) {
  const [outline, setOutline] = useState<OutlineSection[]>(project.outline || []);
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editTargetWords, setEditTargetWords] = useState(0);

  const persist = async (sections: OutlineSection[]) => {
    setOutline(sections);
    await db.writingProjects.update(project.id, { outline: sections, updatedAt: now() } as any);
    onRefresh();
  };

  const addSection = async () => {
    if (!newTitle.trim()) return;
    const section: OutlineSection = {
      id: newId(),
      title: newTitle.trim(),
      status: 'todo',
      sortOrder: outline.length,
    };
    await persist([...outline, section]);
    setNewTitle('');
  };

  const removeSection = async (id: string) => {
    await persist(outline.filter(s => s.id !== id));
  };

  const toggleStatus = async (id: string) => {
    const next: Record<string, OutlineSection['status']> = {
      todo: 'drafting', drafting: 'done', done: 'todo',
    };
    await persist(outline.map(s => s.id === id ? { ...s, status: next[s.status] } : s));
  };

  const moveSection = async (id: string, direction: -1 | 1) => {
    const idx = outline.findIndex(s => s.id === id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= outline.length) return;
    const arr = [...outline];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    arr.forEach((s, i) => s.sortOrder = i);
    await persist(arr);
  };

  const startEdit = (section: OutlineSection) => {
    setEditingId(section.id);
    setEditTitle(section.title);
    setEditNotes(section.notes || '');
    setEditTargetWords(section.targetWords || 0);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await persist(outline.map(s => s.id === editingId ? {
      ...s,
      title: editTitle.trim() || s.title,
      notes: editNotes || undefined,
      targetWords: editTargetWords || undefined,
    } : s));
    setEditingId(null);
  };

  const totalTarget = outline.reduce((s, sec) => s + (sec.targetWords || 0), 0);
  const doneCount = outline.filter(s => s.status === 'done').length;

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>Outline</h3>
        {outline.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {doneCount}/{outline.length} sections
            {totalTarget > 0 && ` · ${totalTarget.toLocaleString()} target words`}
          </span>
        )}
      </div>

      {outline.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
          {outline.map((section, idx) => (
            <div key={section.id}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)',
                borderLeft: `3px solid ${STATUS_COLORS[section.status]}`,
              }}>
                <button
                  className="btn-icon"
                  onClick={() => toggleStatus(section.id)}
                  style={{ padding: 2, color: STATUS_COLORS[section.status] }}
                  title={section.status}
                >
                  {section.status === 'done' ? '✓' : section.status === 'drafting' ? '▶' : '○'}
                </button>

                <span style={{
                  flex: 1, fontSize: 13, fontWeight: 500,
                  textDecoration: section.status === 'done' ? 'line-through' : 'none',
                  opacity: section.status === 'done' ? 0.6 : 1,
                  cursor: 'pointer',
                }} onClick={() => startEdit(section)}>
                  {section.title}
                </span>

                {section.targetWords && section.targetWords > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {(section.currentWords || 0).toLocaleString()}/{section.targetWords.toLocaleString()}
                  </span>
                )}

                <div style={{ display: 'flex', gap: 2 }}>
                  <button className="btn-icon" onClick={() => moveSection(section.id, -1)} disabled={idx === 0}
                    style={{ padding: 2, fontSize: 10, opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
                  <button className="btn-icon" onClick={() => moveSection(section.id, 1)} disabled={idx === outline.length - 1}
                    style={{ padding: 2, fontSize: 10, opacity: idx === outline.length - 1 ? 0.3 : 1 }}>↓</button>
                  <button className="btn-icon" onClick={() => removeSection(section.id)}
                    style={{ padding: 2, color: 'var(--color-rose)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              {/* Inline edit */}
              {editingId === section.id && (
                <div style={{
                  padding: '10px 12px', background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)', borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
                  marginTop: -2,
                }}>
                  <input className="input" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    placeholder="Section title" style={{ marginBottom: 8, fontSize: 13 }} />
                  <textarea className="textarea" value={editNotes} onChange={e => setEditNotes(e.target.value)}
                    placeholder="Notes for this section..." rows={2} style={{ marginBottom: 8, fontSize: 12 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Target words:</label>
                    <input type="number" className="input" value={editTargetWords || ''} onChange={e => setEditTargetWords(Number(e.target.value))}
                      style={{ width: 100, fontSize: 12 }} />
                    <div style={{ flex: 1 }} />
                    <button className="btn-ghost" onClick={() => setEditingId(null)} style={{ fontSize: 12 }}>Cancel</button>
                    <button className="btn-primary" onClick={saveEdit} style={{ fontSize: 12 }}>Save</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          placeholder="Add section (chapter, scene, part...)"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addSection(); }}
          style={{ fontSize: 13 }}
        />
        <button className="btn-primary" onClick={addSection} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>+ Add</button>
      </div>
    </div>
  );
}
