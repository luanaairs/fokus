'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/db';
import { newId, now, formatDate } from '@/lib/utils';
import type { Student, StudentGroup, Note, Task, LessonPlan } from '@/types';
import Modal from '@/components/shared/Modal';
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

  if (selectedStudent) {
    return <StudentDetail student={selectedStudent} onBack={() => { setSelectedStudent(null); setActiveContext({}); }} />;
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1000 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700 }}>Students</h1>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setShowGroupForm(true)}>+ Group</button>
          <button className="btn-primary" onClick={() => { setEditingStudent(undefined); setShowForm(true); }}>+ Student</button>
        </div>
      </div>

      <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
        <input className="input" placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 240 }} />
        <select className="select" style={{ width: 'auto' }} value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
          <option value="">All groups</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="select" style={{ width: 'auto' }} value={filterTag} onChange={e => setFilterTag(e.target.value)}>
          <option value="">All tags</option>
          {allTags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="◉"
          title="No students yet"
          description="Add your first student to get started"
          action={{ label: '+ Add Student', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {filtered.map(s => (
            <div key={s.id} className="card" style={{ cursor: 'pointer' }} onClick={() => selectStudent(s)}>
              <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--color-accent-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: 14,
                }}>
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {s.grade} · {s.subject}
                  </div>
                </div>
              </div>
              {s.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {s.tags.map(tag => (
                    <span key={tag} className="badge" style={{ background: 'var(--bg-tertiary)', fontSize: 11 }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingStudent ? 'Edit Student' : 'Add Student'}>
        <StudentForm
          student={editingStudent}
          groups={groups}
          onSave={() => { setShowForm(false); refresh(); }}
          onCancel={() => setShowForm(false)}
        />
      </Modal>

      <Modal open={showGroupForm} onClose={() => setShowGroupForm(false)} title="New Group">
        <div className="flex flex-col gap-3">
          <input className="input" placeholder="Group name" value={groupName} onChange={e => setGroupName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveGroup(); }} />
          <div className="flex gap-3 justify-end">
            <button className="btn-ghost" onClick={() => setShowGroupForm(false)}>Cancel</button>
            <button className="btn-primary" onClick={saveGroup}>Create</button>
          </div>
        </div>
      </Modal>
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
      name: name.trim(),
      grade,
      subject,
      contactInfo,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      groupId: groupId || undefined,
      createdAt: student?.createdAt || now(),
      updatedAt: now(),
    };
    await db.students.put(data);
    onSave();
  };

  return (
    <div className="flex flex-col gap-3">
      <input className="input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} autoFocus />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <input className="input" placeholder="Grade / Level" value={grade} onChange={e => setGrade(e.target.value)} />
        <input className="input" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
      </div>
      <input className="input" placeholder="Contact info" value={contactInfo} onChange={e => setContactInfo(e.target.value)} />
      <input className="input" placeholder="Tags (comma-separated, e.g. struggling, advanced)" value={tags} onChange={e => setTags(e.target.value)} />
      <select className="select" value={groupId} onChange={e => setGroupId(e.target.value)}>
        <option value="">No group</option>
        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      <div className="flex gap-3 justify-end" style={{ marginTop: 8 }}>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={save}>{student ? 'Update' : 'Add'} Student</button>
      </div>
    </div>
  );
}
