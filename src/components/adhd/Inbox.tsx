'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/db';
import { formatDate, newId, now } from '@/lib/utils';
import type { Capture } from '@/types';
import Modal from '@/components/shared/Modal';
import TaskForm from '@/components/tasks/TaskForm';
import EmptyState from '@/components/shared/EmptyState';

export default function Inbox() {
  const { refreshKey, refresh, setCaptureOpen } = useApp();
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [converting, setConverting] = useState<{ capture: Capture; type: 'task' | 'note' } | null>(null);

  useEffect(() => {
    db.captures.where('processed').equals(0).toArray().then(c =>
      setCaptures(c.sort((a, b) => b.createdAt - a.createdAt))
    );
  }, [refreshKey]);

  const dismiss = async (id: string) => {
    await db.captures.update(id, { processed: true });
    refresh();
  };

  const convertToNote = async (c: Capture) => {
    await db.notes.add({
      id: newId(), content: c.content, tags: c.tags,
      studentId: c.studentId, projectId: c.projectId,
      isProgressNote: false, createdAt: c.createdAt, updatedAt: now(),
    });
    await db.captures.update(c.id, { processed: true });
    refresh();
  };

  return (
    <div style={{ padding: '32px 36px', maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32 }}>Inbox</h1>
        <button className="btn-primary" onClick={() => setCaptureOpen(true)}>+ Capture</button>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>Triage your captures into tasks, notes, or dismiss them.</p>

      {captures.length === 0 ? (
        <EmptyState icon="✓" title="Inbox zero!" description="All captures have been processed" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {captures.map(c => (
            <div key={c.id} className="card" style={{ padding: '18px 20px' }}>
              <pre style={{ fontFamily: 'var(--font-body)', fontSize: 14, whiteSpace: 'pre-wrap', marginBottom: 12, lineHeight: 1.6 }}>{c.content}</pre>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>{formatDate(c.createdAt)}</span>
                  {c.tags.map(t => <span key={t} className="badge" style={{ fontSize: 11 }}>{t}</span>)}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => setConverting({ capture: c, type: 'task' })}>
                    Convert to Task
                  </button>
                  <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => convertToNote(c)}>
                    Save as Note
                  </button>
                  <button className="btn-icon" onClick={() => dismiss(c.id)} style={{ color: 'var(--text-muted)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {converting && (
        <Modal open={true} onClose={() => setConverting(null)} title="Convert to Task" wide>
          <TaskForm
            defaults={{
              title: converting.capture.content.split('\n')[0].slice(0, 80),
              description: converting.capture.content,
              studentId: converting.capture.studentId,
              projectId: converting.capture.projectId,
            }}
            onSave={async () => {
              await db.captures.update(converting.capture.id, { processed: true });
              setConverting(null);
              refresh();
            }}
            onCancel={() => setConverting(null)}
          />
        </Modal>
      )}
    </div>
  );
}
