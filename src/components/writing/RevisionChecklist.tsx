'use client';

import React, { useState } from 'react';
import { db } from '@/lib/db';
import { newId, now } from '@/lib/utils';
import type { WritingProject, RevisionItem } from '@/types';

interface Props {
  project: WritingProject;
  onRefresh: () => void;
}

const DEFAULT_CHECKLIST: { label: string }[] = [
  { label: 'Structure & flow — Does it read logically from start to end?' },
  { label: 'Opening — Does it hook the reader?' },
  { label: 'Ending — Does it land?' },
  { label: 'Voice & tone — Is it consistent throughout?' },
  { label: 'Redundancy — Cut anything that doesn\'t earn its place' },
  { label: 'Dialogue / quotes — Do they feel natural?' },
  { label: 'Grammar & punctuation pass' },
  { label: 'Read aloud — Does it sound right?' },
  { label: 'Formatting — Headers, spacing, consistency' },
  { label: 'Final proofread' },
];

export default function RevisionChecklist({ project, onRefresh }: Props) {
  const [items, setItems] = useState<RevisionItem[]>(project.revisionChecklist || []);
  const [newLabel, setNewLabel] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const persist = async (updated: RevisionItem[]) => {
    setItems(updated);
    await db.writingProjects.update(project.id, { revisionChecklist: updated, updatedAt: now() } as any);
    onRefresh();
  };

  const loadDefaults = async () => {
    const defaults = DEFAULT_CHECKLIST.map((d, i) => ({
      id: newId(),
      label: d.label,
      checked: false,
      sortOrder: i,
    }));
    await persist(defaults);
  };

  const toggle = async (id: string) => {
    await persist(items.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  };

  const addItem = async () => {
    if (!newLabel.trim()) return;
    const item: RevisionItem = { id: newId(), label: newLabel.trim(), checked: false };
    await persist([...items, item]);
    setNewLabel('');
  };

  const removeItem = async (id: string) => {
    await persist(items.filter(i => i.id !== id));
  };

  const saveNote = async (id: string) => {
    await persist(items.map(i => i.id === id ? { ...i, notes: noteText || undefined } : i));
    setEditingNoteId(null);
  };

  const checkedCount = items.filter(i => i.checked).length;
  const progress = items.length > 0 ? (checkedCount / items.length) * 100 : 0;

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>Revision Checklist</h3>
        {items.length > 0 && (
          <span style={{ fontSize: 12, color: checkedCount === items.length ? 'var(--color-emerald)' : 'var(--text-muted)' }}>
            {checkedCount}/{items.length}
          </span>
        )}
      </div>

      {items.length > 0 && (
        <>
          <div className="progress-bar" style={{ marginBottom: 14 }}>
            <div className="progress-bar-fill" style={{
              width: `${progress}%`,
              background: checkedCount === items.length ? 'var(--color-emerald)' : 'var(--color-sky)',
            }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
            {items.map(item => (
              <div key={item.id}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)',
                }}>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => toggle(item.id)}
                    style={{ accentColor: 'var(--color-emerald)', cursor: 'pointer' }}
                  />
                  <span style={{
                    flex: 1, fontSize: 13,
                    textDecoration: item.checked ? 'line-through' : 'none',
                    opacity: item.checked ? 0.5 : 1,
                    cursor: 'pointer',
                  }} onClick={() => {
                    setEditingNoteId(editingNoteId === item.id ? null : item.id);
                    setNoteText(item.notes || '');
                  }}>
                    {item.label}
                  </span>
                  {item.notes && editingNoteId !== item.id && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }} title={item.notes}>📝</span>
                  )}
                  <button className="btn-icon" onClick={() => removeItem(item.id)} style={{ padding: 2, color: 'var(--text-muted)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>

                {editingNoteId === item.id && (
                  <div style={{ padding: '8px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderTop: 'none', borderRadius: '0 0 var(--radius-sm) var(--radius-sm)' }}>
                    <textarea className="textarea" value={noteText} onChange={e => setNoteText(e.target.value)}
                      placeholder="Notes for this item..." rows={2} style={{ fontSize: 12, marginBottom: 6 }} />
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn-ghost" onClick={() => setEditingNoteId(null)} style={{ fontSize: 11, padding: '4px 8px' }}>Cancel</button>
                      <button className="btn-primary" onClick={() => saveNote(item.id)} style={{ fontSize: 11, padding: '4px 8px' }}>Save</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '16px 0', marginBottom: 14 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
            No checklist yet. Start from a template or add your own items.
          </p>
          <button className="btn-primary" onClick={loadDefaults} style={{ fontSize: 13 }}>
            Load Default Checklist
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          placeholder="Add revision item..."
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
          style={{ fontSize: 13 }}
        />
        <button className="btn-ghost" onClick={addItem} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>+ Add</button>
      </div>
    </div>
  );
}
