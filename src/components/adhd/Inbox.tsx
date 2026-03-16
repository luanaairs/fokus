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
      id: newId(),
      content: c.content,
      tags: c.tags,
      studentId: c.studentId,
      projectId: c.projectId,
      isProgressNote: false,
      createdAt: c.createdAt,
      updatedAt: now(),
    });
    await db.captures.update(c.id, { processed: true });
    refresh();
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 800 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700 }}>Inbox</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>Triage your captures — convert to tasks, notes, or dismiss</p>
        </div>
        <button className="btn-primary" onClick={() => setCaptureOpen(true)}>+ Capture</button>
      </div>

      {captures.length === 0 ? (
        <EmptyState icon="↓" title="Inbox zero!" description="All captures have been processed" />
      ) : (
        <div className="flex flex-col gap-3">
          {captures.map(c => (
            <div key={c.id} className="card" style={{ padding: '14px 16px' }}>
              <pre style={{ fontFamily: 'var(--font-body)', fontSize: 14, whiteSpace: 'pre-wrap', marginBottom: 8 }}>{c.content}</pre>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>{formatDate(c.createdAt)}</span>
                  {c.tags.map(t => <span key={t} className="badge" style={{ background: 'var(--bg-tertiary)' }}>{t}</span>)}
                </div>
                <div className="flex gap-2">
                  <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setConverting({ capture: c, type: 'task' })}>
                    → Task
                  </button>
                  <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => convertToNote(c)}>
                    → Note
                  </button>
                  <button className="btn-icon" onClick={() => dismiss(c.id)} style={{ fontSize: 12, color: 'var(--text-muted)' }}>✕</button>
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
