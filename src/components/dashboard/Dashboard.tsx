'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/lib/context';
import { db, completeTaskById } from '@/lib/db';
import {
  formatMinutes, formatDateShort,
  todayStart, todayEnd, daysFromNow, priorityConfig, now
} from '@/lib/utils';
import type { Task, Project, WritingProject, Routine, RoutineItem } from '@/types';
import DailyTodoList from '@/components/dashboard/DailyTodoList';
import DailyReflection from '@/components/dashboard/DailyReflection';

interface QuoteSlide {
  lines: string[];
  attribution: string;
  crossedAttribution?: string;
  imageSrc?: string; // path to character image in /public
}

const QUOTES: QuoteSlide[] = [
  {
    lines: [
      'If you want to make the world a better place,',
      'Take a look at yourself and make a change.',
      'Hooo',
    ],
    crossedAttribution: 'MICHAEL JACKSON',
    attribution: 'BATMAN',
    imageSrc: '/quotes/batman.png',
  },
];

function QuoteBanner() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [fadeClass, setFadeClass] = useState<'in' | 'out'>('in');

  const nextSlide = useCallback(() => {
    if (QUOTES.length <= 1) return;
    setFadeClass('out');
    setTimeout(() => {
      setActiveIndex(i => (i + 1) % QUOTES.length);
      setFadeClass('in');
    }, 400);
  }, []);

  useEffect(() => {
    if (QUOTES.length <= 1) return;
    const interval = setInterval(nextSlide, 10000);
    return () => clearInterval(interval);
  }, [nextSlide]);

  const slide = QUOTES[activeIndex];

  return (
    <div style={{
      position: 'relative',
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
      marginBottom: 28,
      minHeight: 180,
      background: 'linear-gradient(135deg, #1a1206 0%, #3d2008 25%, #5c3a1a 50%, #2a1a0a 75%, #0f0d1a 100%)',
      boxShadow: 'var(--shadow-lg)',
    }}>
      {/* Atmospheric overlay — warm cloudy glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 30% 80%, rgba(180, 120, 60, 0.35) 0%, transparent 60%), radial-gradient(ellipse at 70% 20%, rgba(40, 20, 60, 0.4) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        minHeight: 180,
        padding: '32px 40px',
        opacity: fadeClass === 'in' ? 1 : 0,
        transition: 'opacity 0.4s ease',
      }}>
        {/* Quote text — left side */}
        <div style={{ flex: 1, zIndex: 1 }}>
          <div style={{ marginBottom: 16 }}>
            {slide.lines.map((line, i) => (
              <p key={i} style={{
                fontFamily: 'var(--font-display)',
                fontSize: i === slide.lines.length - 1 ? 20 : 17,
                color: '#f0e8d8',
                lineHeight: 1.7,
                letterSpacing: '0.03em',
                textAlign: 'center',
                textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}>
                {i === 0 ? '\u201C' : ''}{line}{i === slide.lines.length - 1 ? '\u201D' : ''}
              </p>
            ))}
          </div>
          <div style={{ textAlign: 'center' }}>
            {slide.crossedAttribution && (
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                color: 'rgba(240, 232, 216, 0.5)',
                textDecoration: 'line-through',
                letterSpacing: '0.1em',
                marginRight: 10,
              }}>
                ~ {slide.crossedAttribution}
              </span>
            )}
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 14,
              color: 'rgba(240, 232, 216, 0.85)',
              letterSpacing: '0.12em',
            }}>
              - {slide.attribution}
            </span>
          </div>
        </div>

        {/* Character image — right side, overlapping top */}
        <div style={{
          position: 'absolute',
          right: 32,
          bottom: 0,
          top: -24,
          width: 160,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          {slide.imageSrc && (
            <img
              src={slide.imageSrc}
              alt=""
              style={{
                maxHeight: '110%',
                width: 'auto',
                objectFit: 'contain',
                filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))',
              }}
            />
          )}
        </div>
      </div>

      {/* Carousel dots */}
      {QUOTES.length > 1 && (
        <div style={{
          position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 8,
        }}>
          {QUOTES.map((_, i) => (
            <button
              key={i}
              onClick={() => { setFadeClass('out'); setTimeout(() => { setActiveIndex(i); setFadeClass('in'); }, 400); }}
              style={{
                width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: i === activeIndex ? 'rgba(240, 232, 216, 0.9)' : 'rgba(240, 232, 216, 0.3)',
                transition: 'background 0.3s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

import XPWidget from '@/components/dashboard/XPWidget';
import DoomPileDetector from '@/components/adhd/DoomPileDetector';

interface DashboardProps {
  onNavigate: (m: string) => void;
  onOpenPomodoro?: (taskId?: string) => void;
  onOpenRoulette?: () => void;
  onOpenPerfection?: (taskId: string) => void;
  onOpenWeeklyReview?: () => void;
}

export default function Dashboard({ onNavigate, onOpenPomodoro, onOpenRoulette, onOpenPerfection, onOpenWeeklyReview }: DashboardProps) {
  const { refreshKey, refresh, setFocusMode, setFocusTaskId, setCaptureOpen } = useApp();
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [completedToday, setCompletedToday] = useState<Task[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [topThree, setTopThree] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTaskCounts, setProjectTaskCounts] = useState<Record<string, { done: number; total: number }>>({});
  const [writingProjects, setWritingProjects] = useState<WritingProject[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [totalDone, setTotalDone] = useState(0);
  const [todayRoutines, setTodayRoutines] = useState<{ routine: Routine; itemCount: number; totalMinutes: number }[]>([]);

  useEffect(() => {
    const start = todayStart();
    const end = todayEnd();
    const weekEnd = daysFromNow(7);

    Promise.all([
      db.tasks.toArray(),
      db.captures.toArray().then(all => all.filter(c => !c.processed).length),
      db.dailyStreaks.orderBy('date').reverse().limit(30).toArray(),
      db.projects.toArray(),
      db.writingProjects.where('status').anyOf('drafting', 'editing').toArray(),
      db.routines.toArray(),
      db.routineItems.toArray(),
    ]).then(([tasks, inbox, streaks, projs, wps, allRoutines, allRoutineItems]) => {
      // Today's routines
      const dayOfWeek = new Date().getDay();
      const activeRoutines = allRoutines.filter(r =>
        r.isActive || (r.type === 'weekly' && r.weekDays?.includes(dayOfWeek))
      );
      const routineData = activeRoutines.map(r => {
        const items = allRoutineItems.filter(i => i.routineId === r.id && i.type !== 'divider');
        return {
          routine: r,
          itemCount: items.length,
          totalMinutes: items.reduce((s, i) => s + i.durationMinutes, 0),
        };
      });
      setTodayRoutines(routineData);
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
      setTotalTasks(tasks.length);
      setTotalDone(tasks.filter(t => t.status === 'done').length);

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

      let s = 0;
      const todayStr = new Date().toISOString().split('T')[0];
      const streakDates = streaks.map(st => st.date);
      if (done.length > 0 || streakDates.includes(todayStr)) s++;
      const d = new Date();
      d.setDate(d.getDate() - 1);
      while (streakDates.includes(d.toISOString().split('T')[0])) {
        s++;
        d.setDate(d.getDate() - 1);
      }
      setStreak(s);

      const counts: Record<string, { done: number; total: number }> = {};
      for (const p of projs) {
        const pt = tasks.filter(t => t.projectId === p.id);
        counts[p.id] = { done: pt.filter(t => t.status === 'done').length, total: pt.length };
      }
      setProjectTaskCounts(counts);
    });
  }, [refreshKey]);

  const focusTask = (t: Task) => { setFocusTaskId(t.id); setFocusMode(true); };

  const completeTask = async (t: Task) => {
    await completeTaskById(t.id);
    refresh();
  };

  const totalTimeToday = todayTasks.reduce((s, t) => s + (t.estimatedMinutes || 0), 0);
  const overdueTasks = todayTasks.filter(t => t.dueDate && t.dueDate < now()).length;

  return (
    <div className="page-content" style={{ padding: '32px 36px', maxWidth: 1200 }}>
      {/* Header */}
      <div className="dash-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, marginBottom: 4 }}>
            Let&apos;s eat the fucking frog!
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => setCaptureOpen(true)}>
            + Capture
          </button>
          <button className="btn-ghost" onClick={() => onOpenPomodoro?.()}>
            🍅 Pomodoro
          </button>
          <button className="btn-ghost" onClick={() => onOpenRoulette?.()}>
            🎰 Roulette
          </button>
          <button className="btn-ghost" onClick={() => onOpenWeeklyReview?.()}>
            📋 Review
          </button>
        </div>
      </div>

      {/* Quote Banner */}
      <QuoteBanner />

      {/* Stat Cards Row */}
      <div className="stat-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <div className="stat-card-accent">
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.85, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Today&apos;s Tasks</div>
          <div style={{ fontSize: 40, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{todayTasks.length}</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>{formatMinutes(totalTimeToday)} estimated</div>
        </div>

        <div className="stat-card">
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completed Today</div>
          <div style={{ fontSize: 40, fontFamily: 'var(--font-display)', lineHeight: 1, color: 'var(--color-emerald)' }}>{completedToday.length}</div>
          <div style={{ fontSize: 12, color: 'var(--color-emerald)', marginTop: 6, fontWeight: 500 }}>
            {completedToday.length > 0 ? 'Keep going!' : 'Let\'s start!'}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Streak</div>
          <div style={{ fontSize: 40, fontFamily: 'var(--font-display)', lineHeight: 1, color: 'var(--color-amber)' }}>{streak}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{streak === 1 ? 'day' : 'days'} in a row</div>
        </div>

        <div className="stat-card" style={{ cursor: inboxCount > 0 ? 'pointer' : 'default' }} onClick={() => inboxCount > 0 && onNavigate('inbox')}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inbox</div>
          <div style={{ fontSize: 40, fontFamily: 'var(--font-display)', lineHeight: 1, color: inboxCount > 0 ? 'var(--color-accent)' : 'var(--text-muted)' }}>{inboxCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            {inboxCount > 0 ? 'items to triage' : 'all clear'}
          </div>
        </div>
      </div>

      {/* Daily Plan */}
      <div style={{ marginBottom: 24 }}>
        <DailyTodoList onFocusTask={(taskId) => {
          setFocusTaskId(taskId);
          setFocusMode(true);
        }} />
      </div>

      {/* Main Content Grid */}
      <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Today's Focus - Top 3 */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>Today&apos;s Focus</h2>
            <span className="badge" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>Top 3</span>
          </div>
          {topThree.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ display: 'inline' }}><circle cx="12" cy="12" r="10" /><path d="M8 15h8M9 9h.01M15 9h.01" /></svg>
              </div>
              <p style={{ fontSize: 14 }}>No tasks yet. Add some to get started.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topThree.map((t, i) => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)',
                  borderLeft: `4px solid ${priorityConfig[t.priority].color}`,
                }}>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--text-muted)',
                    width: 28, textAlign: 'center', lineHeight: 1,
                  }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{t.title}</div>
                    {t.estimatedMinutes > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatMinutes(t.estimatedMinutes)}</span>
                    )}
                  </div>
                  <button className="btn-icon" onClick={() => onOpenPerfection?.(t.id)} title="15min Challenge" style={{ color: 'var(--color-amber)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                  </button>
                  <button className="btn-icon" onClick={() => focusTask(t)} title="Focus" style={{ color: 'var(--color-accent)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                  <button className="btn-icon" onClick={() => completeTask(t)} title="Complete" style={{ color: 'var(--color-emerald)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Done Pile */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>Done Pile</h2>
            <span className="badge" style={{ background: 'var(--color-emerald-light)', color: 'var(--color-emerald)' }}>
              {completedToday.length} completed
            </span>
          </div>
          {completedToday.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: 14 }}>Nothing yet - let&apos;s get started!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
              {completedToday.map(t => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-emerald-light)',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-emerald)" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'line-through', opacity: 0.8 }}>
                    {t.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lower Grid */}
      <div className="grid-main-side" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Today's Tasks Full List */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Today</h2>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {todayTasks.length} tasks · {formatMinutes(totalTimeToday)}
            </span>
          </div>
          {todayTasks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>Clear day ahead!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {todayTasks.map(t => (
                <div key={t.id} className="task-row">
                  <button className="btn-icon" onClick={() => completeTask(t)} style={{ color: 'var(--text-muted)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg>
                  </button>
                  <div className="priority-dot" style={{ background: priorityConfig[t.priority].color }} />
                  <span style={{ flex: 1, fontSize: 14 }}>{t.title}</span>
                  {t.contextTag && <span className="badge" style={{ fontSize: 11 }}>{t.contextTag}</span>}
                  {t.estimatedMinutes > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{formatMinutes(t.estimatedMinutes)}</span>
                  )}
                  <button className="btn-icon" onClick={() => focusTask(t)} style={{ color: 'var(--color-accent)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* XP & Level */}
          <XPWidget />

          {/* Upcoming */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 12 }}>Upcoming</h3>
            {upcomingTasks.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nothing this week.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcomingTasks.slice(0, 6).map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <div className="priority-dot" style={{ background: priorityConfig[t.priority].color, width: 6, height: 6 }} />
                    <span style={{ flex: 1 }}>{t.title}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{t.dueDate ? formatDateShort(t.dueDate) : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today's Routines */}
          {todayRoutines.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>Routines</h3>
                <button className="btn-icon" onClick={() => onNavigate('routines')} style={{ fontSize: 12, color: 'var(--color-accent)' }}>
                  See all
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {todayRoutines.map(({ routine, itemCount, totalMinutes }) => (
                  <div key={routine.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
                    padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                  }} onClick={() => onNavigate('routines')}>
                    <span style={{ color: 'var(--color-accent)', fontSize: 14 }}>◉</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{routine.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {itemCount} steps · {formatMinutes(totalMinutes)}
                      </div>
                    </div>
                    <span className="badge" style={{ fontSize: 10 }}>{routine.timeOfDay}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>Projects</h3>
              <button className="btn-icon" onClick={() => onNavigate('tasks')} style={{ fontSize: 12, color: 'var(--color-accent)' }}>
                See all
              </button>
            </div>
            {projects.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No projects yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {projects.slice(0, 4).map(p => {
                  const c = projectTaskCounts[p.id] || { done: 0, total: 0 };
                  const pct = c.total > 0 ? (c.done / c.total) * 100 : 0;
                  return (
                    <div key={p.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 4, background: p.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontWeight: 500 }}>{p.name}</span>
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

          {/* Writing */}
          {writingProjects.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 12 }}>Writing</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {writingProjects.map(wp => {
                  const pct = wp.wordCountGoal > 0 ? (wp.currentWordCount / wp.wordCountGoal) * 100 : 0;
                  return (
                    <div key={wp.id}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                        <span style={{ fontWeight: 500 }}>{wp.title}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
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

          {/* Daily Reflection */}
          <DailyReflection completedCount={completedToday.length} totalPlanned={todayTasks.length} />

          {/* Doom Pile */}
          <DoomPileDetector onNavigateToTasks={() => onNavigate('tasks')} />
        </div>
      </div>
    </div>
  );
}
