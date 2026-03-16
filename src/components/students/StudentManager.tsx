'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/db';
import { newId, now } from '@/lib/utils';
import type { Student, StudentGroup } from '@/types';
import Modal from '@/components/shared/Modal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import EmptyState from '@/components/shared/EmptyState';
import StudentDetail from './StudentDetail';

export default function StudentManager() {
  const { refreshKey, refresh, setActiveContext } = useApp();
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | undefined>();
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'grade' | 'recent'>('name');
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'student' | 'group'; id: string; name: string } | null>(null);

  useEffect(() => {
    db.students.toArray().then(setStudents);
    db.studentGroups.toArray().then(setGroups);
  }, [refreshKey]);

  const allTags = [...new Set(students.flatMap(s => s.tags))];

  const filtered = students.filter(s => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterGroup && s.groupId !== filterGroup) return false;
    if (filterTag && !s.tags.includes(filterTag)) return false;
    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'grade': return (a.grade || '').localeCompare(b.grade || '');
      case 'recent': return b.createdAt - a.createdAt;
      default: return a.name.localeCompare(b.name);
    }
  });

  const selectStudent = (s: Student) => {
    setSelectedStudent(s);
    setActiveContext({ type: 'student', id: s.id, label: s.name });
  };

  const saveGroup = async () => {
    if (!groupName.trim()) return;
    await db.studentGroups.add({ id: newId(), name: groupName.trim(), description: '', createdAt: now() });
    setGroupName('');
    setShowGroupForm(false);
    refresh();
  };

  const deleteStudent = async (id: string) => {
    // Cascade delete related data
    const notes = await db.notes.where('studentId').equals(id).toArray();
    await db.notes.bulkDelete(notes.map(n => n.id));
    const tasks = await db.tasks.where('studentId').equals(id).toArray();
    await db.tasks.bulkDelete(tasks.map(t => t.id));
    const lessons = await db.lessonPlans.where('studentId').equals(id).toArray();
    await db.lessonPlans.bulkDelete(lessons.map(l => l.id));
    await db.students.delete(id);
    refresh();
  };

  const deleteGroup = async (id: string) => {
    // Unlink students from this group, then delete
    const groupStudents = await db.students.where('groupId').equals(id).toArray();
    for (const s of groupStudents) {
      await db.students.update(s.id, { groupId: undefined });
    }
    await db.studentGroups.delete(id);
    setFilterGroup('');
    refresh();
  };

  if (selectedStudent) {
    return <StudentDetail student={selectedStudent} onBack={() => { setSelectedStudent(null); setActiveContext({}); }} onDelete={() => { setConfirmDelete({ type: 'student', id: selectedStudent.id, name: selectedStudent.name }); }} />;
  }

  const colors = ['#A2383B', '#2d936c', '#6197E8', '#E2A716', '#CD9196', '#1abc9c'];

  return (
    <div className="page-content" style={{ padding: '32px 36px', maxWidth: 1000 }}>
      <div className="header-with-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32 }}>Students</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={() => setShowGroupForm(true)}>+ Group</button>
          <button className="btn-primary" onClick={() => { setEditingStudent(undefined); setShowForm(true); }}>+ Student</button>
        </div>
      </div>

      <div className="filter-bar" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input className="input" placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
        <select className="select" style={{ width: 'auto' }} value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
          <option value="">All groups</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="select" style={{ width: 'auto' }} value={filterTag} onChange={e => setFilterTag(e.target.value)}>
          <option value="">All tags</option>
          {allTags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="select" style={{ width: 'auto', marginLeft: 'auto' }} value={sortBy} onChange={e => setSortBy(e.target.value as 'name' | 'grade' | 'recent')}>
          <option value="name">Sort: Name</option>
          <option value="grade">Sort: Grade</option>
          <option value="recent">Sort: Newest</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="👤" title="No students yet" description="Add your first student to get started" action={{ label: '+ Add Student', onClick: () => setShowForm(true) }} />
      ) : (
        <div className="grid-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }}>
          {filtered.map((s, i) => (
            <div key={s.id} className="card" style={{ cursor: 'pointer', padding: 20 }} onClick={() => selectStudent(s)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 'var(--radius-md)',
                  background: colors[i % colors.length] + '18',
                  color: colors[i % colors.length],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontFamily: 'var(--font-display)',
                }}>
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.grade} · {s.subject}</div>
                </div>
              </div>
              {s.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {s.tags.map(tag => (
                    <span key={tag} className="badge" style={{ fontSize: 11 }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingStudent ? 'Edit Student' : 'Add Student'}>
        <StudentForm student={editingStudent} groups={groups} onSave={() => { setShowForm(false); refresh(); }} onCancel={() => setShowForm(false)} />
      </Modal>

      <Modal open={showGroupForm} onClose={() => setShowGroupForm(false)} title="Manage Groups">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groups.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              {groups.map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: 14 }}>{g.name}</span>
                  <button className="btn-icon" onClick={() => setConfirmDelete({ type: 'group', id: g.id, name: g.name })} style={{ color: 'var(--color-rose)', padding: 2 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <input className="input" placeholder="New group name" value={groupName} onChange={e => setGroupName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveGroup(); }} autoFocus />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => setShowGroupForm(false)}>Close</button>
            <button className="btn-primary" onClick={saveGroup}>Add Group</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.type === 'student' ? 'Delete Student' : 'Delete Group'}
        message={confirmDelete?.type === 'student'
          ? `Delete "${confirmDelete?.name}" and all their notes, tasks, and lesson plans? This cannot be undone.`
          : `Delete group "${confirmDelete?.name}"? Students in this group will be ungrouped.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDelete?.type === 'student') {
            deleteStudent(confirmDelete.id);
            setSelectedStudent(null);
            setActiveContext({});
          } else if (confirmDelete?.type === 'group') {
            deleteGroup(confirmDelete.id);
          }
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function StudentForm({ student, groups, onSave, onCancel }: {
  student?: Student; groups: StudentGroup[]; onSave: () => void; onCancel: () => void;
}) {
  const [name, setName] = useState(student?.name || '');
  const [grade, setGrade] = useState(student?.grade || '');
  const [subject, setSubject] = useState(student?.subject || '');
  const [contactInfo, setContactInfo] = useState(student?.contactInfo || '');
  const [tags, setTags] = useState(student?.tags.join(', ') || '');
  const [groupId, setGroupId] = useState(student?.groupId || '');

  const save = async () => {
    if (!name.trim()) return;
    const data: Student = {
      id: student?.id || newId(),
      name: name.trim(), grade, subject, contactInfo,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      groupId: groupId || undefined,
      createdAt: student?.createdAt || now(), updatedAt: now(),
    };
    await db.students.put(data);
    onSave();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input className="input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} autoFocus />
      <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <input className="input" placeholder="Grade / Level" value={grade} onChange={e => setGrade(e.target.value)} />
        <input className="input" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
      </div>
      <input className="input" placeholder="Contact info" value={contactInfo} onChange={e => setContactInfo(e.target.value)} />
      <input className="input" placeholder="Tags (comma-separated)" value={tags} onChange={e => setTags(e.target.value)} />
      <select className="select" value={groupId} onChange={e => setGroupId(e.target.value)}>
        <option value="">No group</option>
        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={save}>{student ? 'Update' : 'Add'} Student</button>
      </div>
    </div>
  );
}
