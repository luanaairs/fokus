'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/db';
import {
  getGreeting, formatDate, formatMinutes, formatDateShort,
  todayStart, todayEnd, daysFromNow, priorityConfig, statusConfig, now
} from '@/lib/utils';
import type { Task, Project, Capture, DailyStreak, WritingProject } from '@/types';
import EmptyState from '@/components/shared/EmptyState';

export default function Dashboard({ onNavigate }: { onNavigate: (m: string) => void }) {
  const { refreshKey, refresh, setFocusMode, setFocusTaskId, setTimerTaskId, setTimerDuration, setCaptureOpen } = useApp();
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [completedToday, setCompletedToday] = useState<Task[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [topThree, setTopThree] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTaskCounts, setProjectTaskCounts] = useState<Record<string, { done: number; total: number }>>({});
  const [writingProjects, setWritingProjects] = useState<WritingProject[]>([]);

  useEffect(() => {
    const start = todayStart();
    const end = todayEnd();
    const weekEnd = daysFromNow(7);

    Promise.all([
      db.tasks.toArray(),
      db.captures.where('processed').equals(0).count(),
      db.dailyStreaks.orderBy('date').reverse().limit(30).toArray(),
      db.projects.toArray(),
      db.writingProjects.where('status').anyOf('drafting', 'editing').toArray(),
    ]).then(([tasks, inbox, streaks, projs, wps]) => {
      const active = tasks.filter(t => t.status !== 'done' && t.status !== 'deferred');
      const today = active.filter(t => t.dueDate && t.dueDate >= start && t.dueDate <= end);
      const done = tasks.filter(t => t.status === 'done' && t.completedAt && t.completedAt >= start);
      const upcoming = active.filter(t => t.dueDate && t.dueDate > end && t.dueDate <= weekEnd);

      setTodayTasks(today.sort((a, b) => priorityConfig[a.priority].sortOrder - priorityConfig[b.priority].sortOrder));
      setCompletedToday(done);
      setUpcomingTasks(upcoming.sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0)));
      setInboxCount(inbox);
      setWritingProjects(wps);
      setProjects(projs);

      // Top 3
      const candidates = active.sort((a, b) => {
        const pa = priorityConfig[a.priority].sortOrder;
        const pb = priorityConfig[b.priority].sortOrder;
        if (pa !== pb) return pa - pb;
        if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return (a.estimatedMinutes || 99) - (b.estimatedMinutes || 99);
      });
      setTopThree(candidates.slice(0, 3));

      // Streak
      let s = 0;
      const today_str = new Date().toISOString().split('T')[0];
      const streakDates = streaks.map(st => st.date);
      if (done.length > 0 || streakDates.includes(today_str)) s++;
      let d = new Date();
      d.setDate(d.getDate() - 1);
      while (streakDates.includes(d.toISOString().split('T')[0])) {
        s++;
        d.setDate(d.getDate() - 1);
      }
      setStreak(s);

      // Project task counts
      const counts: Record<string, { done: number; total: number }> = {};
      for (const p of projs) {
        const pt = tasks.filter(t => t.projectId === p.id);
        counts[p.id] = { done: pt.filter(t => t.status === 'done').length, total: pt.length };
      }
      setProjectTaskCounts(counts);
    });
  }, [refreshKey]);

  const focusTask = (t: Task) => {
    setFocusTaskId(t.id);
    setFocusMode(true);
  };

  const completeTask = async (t: Task) => {
    await db.tasks.update(t.id, { status: 'done', completedAt: now() });
    refresh();
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700 }}>
            {getGreeting()}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 2 }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {streak > 0 && (
            <div className="card flex items-center gap-2" style={{ padding: '8px 14px' }}>
              <span style={{ color: 'var(--color-amber)', fontSize: 16 }}>🔥</span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{streak} day streak</span>
            </div>
          )}
          {inboxCount > 0 && (
            <button className="card flex items-center gap-2" style={{ padding: '8px 14px', cursor: 'pointer' }} onClick={() => onNavigate('inbox')}>
              <span style={{ color: 'var(--color-accent)' }}>↓</span>
              <span style={{ fontSize: 14 }}>{inboxCount} in inbox</span>
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Today's Top 3 */}
        <div className="card" style={{ gridColumn: topThree.length > 0 ? 'span 1' : 'span 2' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>
              Today&apos;s Focus
            </h2>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Top 3 highest-leverage</span>
          </div>
          {topThree.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No tasks yet. Add some to get started.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {topThree.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3" style={{
                  padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 8,
                  borderLeft: `3px solid ${priorityConfig[t.priority].color}`,
                }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-muted)', width: 24 }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{t.title}</div>
                    {t.estimatedMinutes > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatMinutes(t.estimatedMinutes)}</span>
                    )}
                  </div>
                  <button className="btn-icon" onClick={() => focusTask(t)} title="Focus">◎</button>
                  <button className="btn-icon" onClick={() => completeTask(t)} title="Complete">✓</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed Today */}
        <div className="card">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
            Done Pile
          </h2>
          {completedToday.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Nothing yet — let&apos;s get started!</p>
          ) : (
            <div className="flex flex-col gap-1" style={{ maxHeight: 200, overflowY: 'auto' }}>
              {completedToday.map(t => (
                <div key={t.id} className="flex items-center gap-2" style={{ padding: '6px 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--color-emerald)' }}>✓</span>
                  <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>{t.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Today's Tasks */}
        <div className="card">
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>Today</h2>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {todayTasks.length} tasks · {formatMinutes(todayTasks.reduce((s, t) => s + (t.estimatedMinutes || 0), 0))}
            </span>
          </div>
          {todayTasks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Clear day! Add tasks or check the backlog.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {todayTasks.map(t => (
                <div key={t.id} className="flex items-center gap-3" style={{
                  padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: 6,
                }}>
                  <button className="btn-icon" onClick={() => completeTask(t)} style={{ color: 'var(--text-muted)' }}>○</button>
                  <span style={{ color: priorityConfig[t.priority].color, fontSize: 10 }}>●</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{t.title}</span>
                  {t.contextTag && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.contextTag}</span>}
                  {t.estimatedMinutes > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatMinutes(t.estimatedMinutes)}</span>}
                  <button className="btn-icon" onClick={() => focusTask(t)} style={{ fontSize: 11 }}>◎</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: Projects + Upcoming */}
        <div className="flex flex-col gap-4">
          {/* Upcoming */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Upcoming</h3>
            {upcomingTasks.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nothing this week.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {upcomingTasks.slice(0, 8).map(t => (
                  <div key={t.id} className="flex items-center gap-2" style={{ fontSize: 12, padding: '4px 0' }}>
                    <span style={{ color: priorityConfig[t.priority].color }}>●</span>
                    <span style={{ flex: 1 }}>{t.title}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{t.dueDate ? formatDateShort(t.dueDate) : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Projects */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Projects</h3>
            {projects.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No projects yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {projects.slice(0, 5).map(p => {
                  const c = projectTaskCounts[p.id] || { done: 0, total: 0 };
                  const pct = c.total > 0 ? (c.done / c.total) * 100 : 0;
                  return (
                    <div key={p.id}>
                      <div className="flex items-center gap-2" style={{ fontSize: 13, marginBottom: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                        <span style={{ flex: 1 }}>{p.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{c.done}/{c.total}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-bar-fill" style={{ width: `${pct}%`, background: p.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Writing Projects */}
          {writingProjects.length > 0 && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Writing</h3>
              <div className="flex flex-col gap-2">
                {writingProjects.map(wp => {
                  const pct = wp.wordCountGoal > 0 ? (wp.currentWordCount / wp.wordCountGoal) * 100 : 0;
                  return (
                    <div key={wp.id}>
                      <div className="flex items-center justify-between" style={{ fontSize: 13, marginBottom: 4 }}>
                        <span>{wp.title}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                          {wp.currentWordCount.toLocaleString()}/{wp.wordCountGoal.toLocaleString()}
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: 'var(--color-accent)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
