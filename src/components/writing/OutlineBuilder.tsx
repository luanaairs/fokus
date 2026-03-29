'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/db';
import { newId, now } from '@/lib/utils';
import type { WritingProject, OutlineSection } from '@/types';

interface Props {
  project: WritingProject;
  onRefresh: () => void;
}

type ItemStatus = 'todo' | 'drafting' | 'done';
type ItemType = 'chapter' | 'scene' | 'plot_point';
type ViewMode = 'structure' | 'timeline';

const STATUS_COLOR: Record<ItemStatus, string> = {
  todo: 'var(--text-muted)',
  drafting: 'var(--color-sky)',
  done: 'var(--color-emerald)',
};
const CHAPTER_PALETTE = [
  '#A2383B', '#6197E8', '#E2A716', '#CD9196', '#3da37a',
  '#b07ac9', '#e07b39', '#4db6c8',
];

interface AddState {
  chapterId: string | null; // null → adding a chapter
  type: 'scene' | 'plot_point';
  title: string;
  storyDate: string;
  pov: string;
  location: string;
}

interface EditState {
  id: string;
  title: string;
  notes: string;
  storyDate: string;
  pov: string;
  location: string;
  targetWords: number;
  currentWords: number;
  color: string;
  chapterNumber: number;
}

export default function OutlineBuilder({ project, onRefresh }: Props) {
  const [items, setItems] = useState<OutlineSection[]>(project.outline || []);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditState | null>(null);
  const [adding, setAdding] = useState<AddState | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('structure');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const migrated = useRef(false);

  // One-time migration: wrap legacy flat sections (no type) into a chapter
  useEffect(() => {
    if (migrated.current) return;
    migrated.current = true;
    const hasLegacy = items.length > 0 && items.every(i => !i.type);
    if (!hasLegacy) return;
    const chapterId = newId();
    const chapter: OutlineSection = {
      id: chapterId, type: 'chapter', title: 'Chapter 1',
      status: 'todo', sortOrder: 0, chapterNumber: 1,
    };
    const migrated2 = items.map((s, i) => ({
      ...s, type: 'scene' as const, parentId: chapterId, sortOrder: i,
    }));
    const next = [chapter, ...migrated2];
    setItems(next);
    db.writingProjects.update(project.id, { outline: next, updatedAt: now() } as any);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = async (updated: OutlineSection[]) => {
    setItems(updated);
    await db.writingProjects.update(project.id, { outline: updated, updatedAt: now() } as any);
    onRefresh();
  };

  const chapters = items.filter(i => i.type === 'chapter').sort((a, b) => a.sortOrder - b.sortOrder);
  const childrenOf = (chapterId: string) =>
    items.filter(i => i.parentId === chapterId).sort((a, b) => a.sortOrder - b.sortOrder);

  const stats = {
    chapters: chapters.length,
    scenes: items.filter(i => i.type === 'scene').length,
    plots: items.filter(i => i.type === 'plot_point').length,
    done: items.filter(i => i.type !== 'chapter' && i.status === 'done').length,
    totalTarget: items.reduce((s, i) => s + (i.targetWords || 0), 0),
  };

  /* ---- mutations ---- */
  const addChapter = async () => {
    if (!adding || !adding.title.trim()) return;
    const chapter: OutlineSection = {
      id: newId(), type: 'chapter',
      title: adding.title.trim(),
      status: 'todo',
      sortOrder: chapters.length,
      chapterNumber: chapters.length + 1,
    };
    await persist([...items, chapter]);
    setAdding(null);
  };

  const addChild = async () => {
    if (!adding || !adding.chapterId || !adding.title.trim()) return;
    const siblings = childrenOf(adding.chapterId);
    const child: OutlineSection = {
      id: newId(),
      type: adding.type,
      parentId: adding.chapterId,
      title: adding.title.trim(),
      status: 'todo',
      sortOrder: siblings.length,
      storyDate: adding.storyDate || undefined,
      pov: adding.pov || undefined,
      location: adding.location || undefined,
    };
    await persist([...items, child]);
    setAdding(null);
  };

  const removeItem = async (id: string) => {
    const childIds = new Set([id, ...items.filter(i => i.parentId === id).map(i => i.id)]);
    await persist(items.filter(i => !childIds.has(i.id)));
    setConfirmDeleteId(null);
  };

  const cycleStatus = async (id: string) => {
    const next: Record<ItemStatus, ItemStatus> = { todo: 'drafting', drafting: 'done', done: 'todo' };
    await persist(items.map(i => i.id === id ? { ...i, status: next[i.status] } : i));
  };

  const moveChapter = async (id: string, dir: -1 | 1) => {
    const idx = chapters.findIndex(c => c.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= chapters.length) return;
    const arr = [...chapters];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    const idxMap = Object.fromEntries(arr.map((c, i) => [c.id, i]));
    await persist(items.map(i => i.id in idxMap ? { ...i, sortOrder: idxMap[i.id] } : i));
  };

  const moveChild = async (id: string, parentId: string, dir: -1 | 1) => {
    const siblings = childrenOf(parentId);
    const idx = siblings.findIndex(s => s.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= siblings.length) return;
    const arr = [...siblings];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    const idxMap = Object.fromEntries(arr.map((s, i) => [s.id, i]));
    await persist(items.map(i => i.id in idxMap ? { ...i, sortOrder: idxMap[i.id] } : i));
  };

  const startEdit = (item: OutlineSection) => {
    setEditing({
      id: item.id, title: item.title, notes: item.notes || '',
      storyDate: item.storyDate || '', pov: item.pov || '', location: item.location || '',
      targetWords: item.targetWords || 0, currentWords: item.currentWords || 0,
      color: item.color || '', chapterNumber: item.chapterNumber || 0,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    await persist(items.map(i => i.id === editing.id ? {
      ...i,
      title: editing.title.trim() || i.title,
      notes: editing.notes || undefined,
      storyDate: editing.storyDate || undefined,
      pov: editing.pov || undefined,
      location: editing.location || undefined,
      targetWords: editing.targetWords || undefined,
      currentWords: editing.currentWords || undefined,
      color: editing.color || undefined,
      chapterNumber: editing.chapterNumber || undefined,
    } : i));
    setEditing(null);
  };

  // Timeline: all non-chapter items sorted by storyDate
  const timeline = items
    .filter(i => i.type === 'scene' || i.type === 'plot_point')
    .sort((a, b) => {
      if (!a.storyDate && !b.storyDate) return 0;
      if (!a.storyDate) return 1;
      if (!b.storyDate) return -1;
      return a.storyDate.localeCompare(b.storyDate);
    });

  const chapterColor = (chIdx: number, override?: string) =>
    override || CHAPTER_PALETTE[chIdx % CHAPTER_PALETTE.length];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>Outline</h3>
          {stats.chapters > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {stats.chapters} ch · {stats.scenes} scenes · {stats.plots} plot points
              {stats.done > 0 && ` · ${stats.done} done`}
              {stats.totalTarget > 0 && ` · ${stats.totalTarget.toLocaleString()} target words`}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{
            display: 'flex', background: 'var(--bg-input)', borderRadius: 'var(--radius-full)', padding: 2,
          }}>
            {(['structure', 'timeline'] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)} style={{
                padding: '5px 14px', fontSize: 11, borderRadius: 'var(--radius-full)', border: 'none',
                background: viewMode === m ? 'var(--bg-card)' : 'transparent',
                color: viewMode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer', fontWeight: viewMode === m ? 600 : 400,
                boxShadow: viewMode === m ? 'var(--shadow-sm)' : 'none',
              }}>
                {m === 'structure' ? 'Structure' : 'Timeline'}
              </button>
            ))}
          </div>
          <button className="btn-primary" style={{ fontSize: 12 }}
            onClick={() => setAdding({ chapterId: null, type: 'scene', title: '', storyDate: '', pov: '', location: '' })}>
            + Chapter
          </button>
        </div>
      </div>

      {/* Add chapter form */}
      {adding?.chapterId === null && (
        <div style={{
          padding: '14px 16px', background: 'var(--bg-card)',
          border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-accent)', marginBottom: 8 }}>
            New Chapter
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" value={adding.title} autoFocus
              onChange={e => setAdding({ ...adding, title: e.target.value })}
              placeholder="Chapter title" style={{ fontSize: 13 }}
              onKeyDown={e => { if (e.key === 'Enter') addChapter(); if (e.key === 'Escape') setAdding(null); }} />
            <button className="btn-ghost" onClick={() => setAdding(null)} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Cancel</button>
            <button className="btn-primary" onClick={addChapter} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Add</button>
          </div>
        </div>
      )}

      {/* STRUCTURE VIEW */}
      {viewMode === 'structure' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {chapters.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)', fontSize: 13,
              border: '2px dashed var(--border-light)', borderRadius: 'var(--radius-md)',
            }}>
              No chapters yet. Hit <strong>+ Chapter</strong> to start building your outline.
            </div>
          )}

          {chapters.map((chapter, chIdx) => {
            const children = childrenOf(chapter.id);
            const isCollapsed = collapsed.has(chapter.id);
            const color = chapterColor(chIdx, chapter.color);
            const doneSiblings = children.filter(c => c.status === 'done').length;
            const chapterWords = children.reduce((s, c) => s + (c.targetWords || 0), 0);

            return (
              <div key={chapter.id} style={{
                border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
              }}>
                {/* ── Chapter header ── */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                  background: 'var(--bg-card)', borderLeft: `4px solid ${color}`,
                }}>
                  <button className="btn-icon" onClick={() => setCollapsed(prev => {
                    const s = new Set(prev);
                    s.has(chapter.id) ? s.delete(chapter.id) : s.add(chapter.id);
                    return s;
                  })} style={{ padding: 2, fontSize: 10, color: 'var(--text-muted)', width: 18 }}>
                    {isCollapsed ? '▶' : '▼'}
                  </button>

                  <span style={{
                    fontSize: 10, fontWeight: 700, color, background: color + '22',
                    padding: '2px 8px', borderRadius: 'var(--radius-full)', whiteSpace: 'nowrap',
                  }}>
                    CH {chapter.chapterNumber ?? chIdx + 1}
                  </span>

                  <span style={{ flex: 1, fontSize: 14, fontFamily: 'var(--font-display)', cursor: 'pointer' }}
                    onClick={() => startEdit(chapter)}>
                    {chapter.title}
                  </span>

                  {children.length > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {doneSiblings}/{children.length}
                      {chapterWords > 0 && ` · ${chapterWords.toLocaleString()}w`}
                    </span>
                  )}

                  <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' }}
                    onClick={() => setAdding({ chapterId: chapter.id, type: 'scene', title: '', storyDate: '', pov: '', location: '' })}>
                    + Scene
                  </button>
                  <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' }}
                    onClick={() => setAdding({ chapterId: chapter.id, type: 'plot_point', title: '', storyDate: '', pov: '', location: '' })}>
                    + Plot
                  </button>

                  <div style={{ display: 'flex', gap: 2 }}>
                    <button className="btn-icon" onClick={() => moveChapter(chapter.id, -1)} disabled={chIdx === 0}
                      style={{ padding: 2, fontSize: 10, opacity: chIdx === 0 ? 0.3 : 1 }}>↑</button>
                    <button className="btn-icon" onClick={() => moveChapter(chapter.id, 1)} disabled={chIdx === chapters.length - 1}
                      style={{ padding: 2, fontSize: 10, opacity: chIdx === chapters.length - 1 ? 0.3 : 1 }}>↓</button>
                    <button className="btn-icon" onClick={() => startEdit(chapter)} style={{ padding: 2 }} title="Edit">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button className="btn-icon" onClick={() => setConfirmDeleteId(chapter.id)}
                      style={{ padding: 2, color: 'var(--color-rose)' }} title="Delete chapter">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>

                {/* ── Edit chapter ── */}
                {editing?.id === chapter.id && (
                  <div style={{ padding: '12px 16px', background: 'var(--bg-input)', borderTop: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8, marginBottom: 8 }}>
                      <input className="input" value={editing.title} style={{ fontSize: 13 }}
                        onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="Chapter title" />
                      <input type="number" className="input" value={editing.chapterNumber || ''} style={{ fontSize: 13 }}
                        onChange={e => setEditing({ ...editing, chapterNumber: Number(e.target.value) })} placeholder="No." />
                    </div>
                    <textarea className="textarea" value={editing.notes} rows={2} style={{ marginBottom: 10, fontSize: 12 }}
                      onChange={e => setEditing({ ...editing, notes: e.target.value })}
                      placeholder="Chapter summary / notes..." />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Color:</span>
                      {CHAPTER_PALETTE.map(c => (
                        <button key={c} onClick={() => setEditing({ ...editing, color: c })} style={{
                          width: 18, height: 18, borderRadius: '50%', background: c, border: 'none',
                          cursor: 'pointer', outline: editing.color === c ? '2px solid var(--text-primary)' : 'none',
                          outlineOffset: 2, flexShrink: 0,
                        }} />
                      ))}
                      <div style={{ flex: 1 }} />
                      <button className="btn-ghost" onClick={() => setEditing(null)} style={{ fontSize: 12 }}>Cancel</button>
                      <button className="btn-primary" onClick={saveEdit} style={{ fontSize: 12 }}>Save</button>
                    </div>
                  </div>
                )}

                {/* ── Add scene / plot form ── */}
                {adding?.chapterId === chapter.id && (
                  <AddItemForm adding={adding} onChange={setAdding} onAdd={addChild} onCancel={() => setAdding(null)} />
                )}

                {/* ── Children ── */}
                {!isCollapsed && children.length > 0 && (
                  <div>
                    {children.map((child, cIdx) => (
                      <div key={child.id} style={{ borderLeft: `4px solid ${color}33` }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '8px 14px 8px 20px',
                          borderTop: '1px solid var(--border-light)',
                          background: 'var(--bg-app)',
                        }}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 14, textAlign: 'center', flexShrink: 0 }}>
                            {child.type === 'plot_point' ? '◆' : '●'}
                          </span>

                          <button className="btn-icon" onClick={() => cycleStatus(child.id)}
                            style={{ padding: 2, color: STATUS_COLOR[child.status], fontSize: 11, flexShrink: 0 }}
                            title={`Status: ${child.status}`}>
                            {child.status === 'done' ? '✓' : child.status === 'drafting' ? '▶' : '○'}
                          </button>

                          <span style={{
                            flex: 1, fontSize: 13, cursor: 'pointer',
                            textDecoration: child.status === 'done' ? 'line-through' : 'none',
                            opacity: child.status === 'done' ? 0.6 : 1,
                          }} onClick={() => startEdit(child)}>
                            {child.title}
                          </span>

                          {/* Metadata chips */}
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                            {child.storyDate && (
                              <Chip color="var(--color-sky)">📅 {child.storyDate}</Chip>
                            )}
                            {child.pov && (
                              <Chip color="var(--color-amber)">👁 {child.pov}</Chip>
                            )}
                            {child.location && (
                              <Chip color="var(--text-muted)">📍 {child.location}</Chip>
                            )}
                            {child.targetWords ? (
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                {(child.currentWords || 0).toLocaleString()}/{child.targetWords.toLocaleString()}w
                              </span>
                            ) : null}
                          </div>

                          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                            <button className="btn-icon" onClick={() => moveChild(child.id, chapter.id, -1)}
                              disabled={cIdx === 0} style={{ padding: 2, fontSize: 10, opacity: cIdx === 0 ? 0.3 : 1 }}>↑</button>
                            <button className="btn-icon" onClick={() => moveChild(child.id, chapter.id, 1)}
                              disabled={cIdx === children.length - 1}
                              style={{ padding: 2, fontSize: 10, opacity: cIdx === children.length - 1 ? 0.3 : 1 }}>↓</button>
                            <button className="btn-icon" onClick={() => startEdit(child)} style={{ padding: 2 }} title="Edit">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            </button>
                            <button className="btn-icon" onClick={() => setConfirmDeleteId(child.id)}
                              style={{ padding: 2, color: 'var(--color-rose)' }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                          </div>
                        </div>

                        {/* ── Edit scene/plot panel ── */}
                        {editing?.id === child.id && (
                          <div style={{
                            padding: '12px 20px', background: 'var(--bg-input)',
                            borderTop: '1px solid var(--border-light)',
                          }}>
                            <input className="input" value={editing.title} style={{ marginBottom: 8, fontSize: 13 }}
                              onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="Title" />
                            <textarea className="textarea" value={editing.notes} rows={2} style={{ marginBottom: 8, fontSize: 12 }}
                              onChange={e => setEditing({ ...editing, notes: e.target.value })}
                              placeholder="Scene summary, conflict, goal, outcome..." />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                              <div>
                                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                                  Story date / time
                                </label>
                                <input className="input" value={editing.storyDate} style={{ fontSize: 12 }}
                                  onChange={e => setEditing({ ...editing, storyDate: e.target.value })}
                                  placeholder="e.g. Day 3, Year 1, 1847-06-12" />
                              </div>
                              <div>
                                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                                  POV character
                                </label>
                                <input className="input" value={editing.pov} style={{ fontSize: 12 }}
                                  onChange={e => setEditing({ ...editing, pov: e.target.value })}
                                  placeholder="Who's perspective?" />
                              </div>
                              <div>
                                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                                  Location
                                </label>
                                <input className="input" value={editing.location} style={{ fontSize: 12 }}
                                  onChange={e => setEditing({ ...editing, location: e.target.value })}
                                  placeholder="Where does it take place?" />
                              </div>
                              <div>
                                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                                  Target words
                                </label>
                                <input type="number" className="input" value={editing.targetWords || ''} style={{ fontSize: 12 }}
                                  onChange={e => setEditing({ ...editing, targetWords: Number(e.target.value) })} />
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button className="btn-ghost" onClick={() => setEditing(null)} style={{ fontSize: 12 }}>Cancel</button>
                              <button className="btn-primary" onClick={saveEdit} style={{ fontSize: 12 }}>Save</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty chapter hint */}
                {!isCollapsed && children.length === 0 && !adding && (
                  <div style={{
                    padding: '12px 22px', fontSize: 12, color: 'var(--text-muted)',
                    borderTop: '1px solid var(--border-light)', background: 'var(--bg-app)',
                    fontStyle: 'italic',
                  }}>
                    No scenes yet — add a scene or plot point above.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TIMELINE VIEW */}
      {viewMode === 'timeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {timeline.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '40px 24px', color: 'var(--text-muted)', fontSize: 13,
              border: '2px dashed var(--border-light)', borderRadius: 'var(--radius-md)',
            }}>
              Add story dates to scenes to view them in timeline order.
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                Items sorted by story date. Items without a date appear at the bottom.
              </p>
              {timeline.map(item => {
                const chIdx = chapters.findIndex(c => c.id === item.parentId);
                const chapter = chapters[chIdx];
                const color = chapterColor(chIdx, chapter?.color);
                return (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                    background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)',
                    borderLeft: `3px solid ${STATUS_COLOR[item.status]}`,
                  }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 14, textAlign: 'center' }}>
                      {item.type === 'plot_point' ? '◆' : '●'}
                    </span>
                    <button className="btn-icon" onClick={() => cycleStatus(item.id)}
                      style={{ padding: 2, color: STATUS_COLOR[item.status], fontSize: 11 }}>
                      {item.status === 'done' ? '✓' : item.status === 'drafting' ? '▶' : '○'}
                    </button>
                    <span style={{ flex: 1, fontSize: 13 }}>{item.title}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {item.storyDate && <Chip color="var(--color-sky)">📅 {item.storyDate}</Chip>}
                      {item.pov && <Chip color="var(--color-amber)">👁 {item.pov}</Chip>}
                      {item.location && <Chip color="var(--text-muted)">📍 {item.location}</Chip>}
                      {chapter && (
                        <Chip color={color}>{chapter.title}</Chip>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Delete confirm */}
      {confirmDeleteId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div className="card" style={{ padding: 24, maxWidth: 360, width: '90%' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Delete this item?</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              {items.find(i => i.id === confirmDeleteId)?.type === 'chapter'
                ? 'This will also delete all scenes and plot points inside this chapter.'
                : 'This cannot be undone.'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button onClick={() => removeItem(confirmDeleteId)} style={{
                padding: '8px 18px', fontSize: 13, borderRadius: 'var(--radius-sm)',
                background: 'var(--color-rose)', color: '#fff', border: 'none', cursor: 'pointer',
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      fontSize: 10, color, background: color + '22',
      padding: '2px 6px', borderRadius: 'var(--radius-full)', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

function AddItemForm({ adding, onChange, onAdd, onCancel }: {
  adding: AddState;
  onChange: (a: AddState) => void;
  onAdd: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{
      padding: '12px 16px', background: 'var(--bg-input)',
      borderTop: '1px solid var(--border-light)',
    }}>
      {/* type toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {(['scene', 'plot_point'] as const).map(t => (
          <button key={t} onClick={() => onChange({ ...adding, type: t })} style={{
            padding: '4px 12px', fontSize: 11, borderRadius: 'var(--radius-full)', cursor: 'pointer',
            background: adding.type === t ? 'var(--color-accent)' : 'var(--bg-card)',
            color: adding.type === t ? '#fff' : 'var(--text-muted)',
            border: '1px solid var(--border-color)',
          }}>
            {t === 'scene' ? '● Scene' : '◆ Plot Point'}
          </button>
        ))}
      </div>
      <input className="input" value={adding.title} autoFocus style={{ marginBottom: 8, fontSize: 13 }}
        onChange={e => onChange({ ...adding, title: e.target.value })}
        placeholder={adding.type === 'scene' ? 'Scene title' : 'Plot point'}
        onKeyDown={e => { if (e.key === 'Enter') onAdd(); if (e.key === 'Escape') onCancel(); }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
        <input className="input" value={adding.storyDate} style={{ fontSize: 12 }}
          onChange={e => onChange({ ...adding, storyDate: e.target.value })}
          placeholder="Story date/time" />
        <input className="input" value={adding.pov} style={{ fontSize: 12 }}
          onChange={e => onChange({ ...adding, pov: e.target.value })}
          placeholder="POV character" />
        <input className="input" value={adding.location} style={{ fontSize: 12 }}
          onChange={e => onChange({ ...adding, location: e.target.value })}
          placeholder="Location" />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn-ghost" onClick={onCancel} style={{ fontSize: 12 }}>Cancel</button>
        <button className="btn-primary" onClick={onAdd} style={{ fontSize: 12 }}>
          Add {adding.type === 'scene' ? 'Scene' : 'Plot Point'}
        </button>
      </div>
    </div>
  );
}
