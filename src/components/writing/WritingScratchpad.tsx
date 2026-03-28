'use client';

import React, { useState, useRef } from 'react';
import { db } from '@/lib/db';
import { now } from '@/lib/utils';
import type { WritingProject } from '@/types';

interface Props {
  project: WritingProject;
  onRefresh: () => void;
}

export default function WritingScratchpad({ project, onRefresh }: Props) {
  const [text, setText] = useState(project.scratchpad || '');
  const [saved, setSaved] = useState(true);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (value: string) => {
    setText(value);
    setSaved(false);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      await db.writingProjects.update(project.id, { scratchpad: value, updatedAt: now() } as any);
      setSaved(true);
      onRefresh();
    }, 800);
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>Scratchpad</h3>
        <span style={{ fontSize: 11, color: saved ? 'var(--color-emerald)' : 'var(--text-muted)' }}>
          {saved ? 'Saved' : 'Saving...'}
        </span>
      </div>

      <textarea
        className="textarea"
        value={text}
        onChange={e => handleChange(e.target.value)}
        placeholder="Dump ideas, fragments, notes, research bits... anything that might be useful later."
        rows={8}
        style={{ fontSize: 13, lineHeight: 1.7, resize: 'vertical', marginBottom: 8 }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </span>
        {text.trim() && (
          <button className="btn-ghost" onClick={() => {
            navigator.clipboard?.writeText(text).catch(() => {});
          }} style={{ fontSize: 11, padding: '4px 8px' }}>
            Copy All
          </button>
        )}
      </div>
    </div>
  );
}
