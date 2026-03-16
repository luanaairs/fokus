'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { newId, now } from '@/lib/utils';
import type { Project } from '@/types';
import Modal from '@/components/shared/Modal';

const PROJECT_COLORS = ['#A2383B', '#2d936c', '#6197E8', '#E2A716', '#CD9196', '#1abc9c', '#e74c3c', '#34495e'];

interface Props {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export default function ProjectManager({ open, onClose, onRefresh }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<Project | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    loadProjects();
  }, [open]);

  const loadProjects = async () => {
    const projs = await db.projects.toArray();
    setProjects(projs.sort((a, b) => b.createdAt - a.createdAt));
    const counts: Record<string, number> = {};
    for (const p of projs) {
      counts[p.id] = await db.tasks.where('projectId').equals(p.id).count();
    }
    setTaskCounts(counts);
  };

  const deleteProject = async (id: string) => {
    // Unlink tasks from this project
    const tasks = await db.tasks.where('projectId').equals(id).toArray();
    await Promise.all(tasks.map(t => db.tasks.update(t.id, { projectId: undefined })));
    await db.projects.delete(id);
    await loadProjects();
    onRefresh();
  };

  return (
    <Modal open={open} onClose={onClose} title="Manage Projects" wide>
      <div style={{ marginBottom: 16 }}>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>+ New Project</button>
      </div>

      {projects.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 24 }}>
          No projects yet. Create one to organize your tasks.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {projects.map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ width: 12, height: 12, borderRadius: 4, background: p.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                {p.description && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.description}</div>}
              </div>
              <span className="badge" style={{ fontSize: 11 }}>
                {taskCounts[p.id] || 0} tasks
              </span>
              <span className="badge" style={{ fontSize: 11, background: p.isTeaching ? 'var(--color-accent-light)' : 'var(--bg-badge)', color: p.isTeaching ? 'var(--color-accent)' : 'var(--text-secondary)' }}>
                {p.isTeaching ? 'Teaching' : 'Personal'}
              </span>
              <button className="btn-icon" onClick={() => { setEditing(p); setShowForm(true); }} style={{ fontSize: 12 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              </button>
              <button className="btn-icon" onClick={() => deleteProject(p.id)} style={{ color: 'var(--color-rose)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ProjectForm
          project={editing}
          onSave={() => { setShowForm(false); loadProjects(); onRefresh(); }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </Modal>
  );
}

function ProjectForm({ project, onSave, onCancel }: {
  project: Project | null; onSave: () => void; onCancel: () => void;
}) {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [color, setColor] = useState(project?.color || PROJECT_COLORS[0]);
  const [isTeaching, setIsTeaching] = useState(project?.isTeaching ?? false);

  const save = async () => {
    if (!name.trim()) return;
    const data: Project = {
      id: project?.id || newId(),
      name: name.trim(),
      description,
      color,
      isTeaching,
      createdAt: project?.createdAt || now(),
      updatedAt: now(),
    };
    await db.projects.put(data);
    onSave();
  };

  return (
    <div style={{
      marginTop: 16, padding: 20, background: 'var(--bg-card)',
      border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
    }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 12 }}>
        {project ? 'Edit Project' : 'New Project'}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input className="input" placeholder="Project name" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <input className="input" placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Color</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {PROJECT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: c,
                  border: color === c ? '3px solid var(--text-primary)' : '2px solid transparent',
                  cursor: 'pointer', transition: 'border 0.15s ease',
                }}
              />
            ))}
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={isTeaching} onChange={e => setIsTeaching(e.target.checked)} style={{ accentColor: 'var(--color-accent)', width: 16, height: 16 }} />
          Teaching-related project
        </label>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={save}>{project ? 'Update' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}
