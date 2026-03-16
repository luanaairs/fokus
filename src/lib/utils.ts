import { v4 as uuidv4 } from 'uuid';
import type { Priority, TaskStatus, LessonStatus, WritingStatus } from '@/types';

export function newId(): string {
  return uuidv4();
}

export function now(): number {
  return Date.now();
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

export function formatDateShort(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short'
  });
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit'
  });
}

export function todayStart(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function todayEnd(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function daysFromNow(n: number): number {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function toDateInputValue(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toISOString().split('T')[0];
}

export function fromDateInput(val: string): number | undefined {
  if (!val) return undefined;
  return new Date(val + 'T12:00:00').getTime();
}

export const priorityConfig: Record<Priority, { label: string; color: string; icon: string; sortOrder: number }> = {
  critical: { label: 'Critical', color: '#ef4444', icon: '🔴', sortOrder: 0 },
  high: { label: 'High', color: '#f97316', icon: '🟠', sortOrder: 1 },
  medium: { label: 'Medium', color: '#eab308', icon: '🟡', sortOrder: 2 },
  low: { label: 'Low', color: '#22c55e', icon: '🟢', sortOrder: 3 },
};

export const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
  todo: { label: 'To Do', color: '#94a3b8' },
  in_progress: { label: 'In Progress', color: '#3b82f6' },
  done: { label: 'Done', color: '#22c55e' },
  deferred: { label: 'Deferred', color: '#a78bfa' },
};

export const lessonStatusConfig: Record<LessonStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#94a3b8' },
  planned: { label: 'Planned', color: '#3b82f6' },
  delivered: { label: 'Delivered', color: '#22c55e' },
  reviewed: { label: 'Reviewed', color: '#a78bfa' },
};

export const writingStatusConfig: Record<WritingStatus, { label: string; color: string }> = {
  idea: { label: 'Idea', color: '#94a3b8' },
  drafting: { label: 'Drafting', color: '#3b82f6' },
  editing: { label: 'Editing', color: '#eab308' },
  submitted: { label: 'Submitted', color: '#f97316' },
  published: { label: 'Published', color: '#22c55e' },
  archived: { label: 'Archived', color: '#64748b' },
};

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
