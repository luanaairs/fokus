'use client';

import { db } from './db';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

type SyncListener = (status: SyncStatus) => void;

const listeners = new Set<SyncListener>();
let currentStatus: SyncStatus = 'idle';
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastSyncedAt = 0;

function setStatus(s: SyncStatus) {
  currentStatus = s;
  listeners.forEach(fn => fn(s));
}

export function onSyncStatus(fn: SyncListener): () => void {
  listeners.add(fn);
  fn(currentStatus);
  return () => listeners.delete(fn);
}

async function getAllLocalData() {
  return {
    students: await db.students.toArray(),
    studentGroups: await db.studentGroups.toArray(),
    notes: await db.notes.toArray(),
    tasks: await db.tasks.toArray(),
    projects: await db.projects.toArray(),
    lessonPlans: await db.lessonPlans.toArray(),
    writingProjects: await db.writingProjects.toArray(),
    captures: await db.captures.toArray(),
    focusSessions: await db.focusSessions.toArray(),
    parkingLot: await db.parkingLot.toArray(),
    dailyStreaks: await db.dailyStreaks.toArray(),
  };
}

// Push local data to cloud
export async function pushToCloud(): Promise<boolean> {
  try {
    setStatus('syncing');
    const data = await getAllLocalData();
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      setStatus('error');
      return false;
    }
    const result = await res.json();
    lastSyncedAt = result.syncedAt || Date.now();
    setStatus('synced');
    return true;
  } catch {
    setStatus(navigator.onLine ? 'error' : 'offline');
    return false;
  }
}

// Pull cloud data into IndexedDB
export async function pullFromCloud(): Promise<boolean> {
  try {
    setStatus('syncing');
    const res = await fetch('/api/sync');
    if (!res.ok) {
      // 500 means DATABASE_URL not set — not an error for the user
      if (res.status === 500) {
        setStatus('idle');
        return false;
      }
      setStatus('error');
      return false;
    }
    const data = await res.json();
    if (data.error) {
      setStatus('idle');
      return false;
    }

    // Merge cloud data into IndexedDB (cloud wins for existing IDs)
    const tables = [
      'students', 'studentGroups', 'notes', 'tasks', 'projects',
      'lessonPlans', 'writingProjects', 'captures', 'focusSessions',
      'parkingLot', 'dailyStreaks',
    ] as const;

    for (const table of tables) {
      const items = data[table];
      if (Array.isArray(items) && items.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db[table] as any).bulkPut(items);
      }
    }

    setStatus('synced');
    return true;
  } catch {
    setStatus(navigator.onLine ? 'error' : 'offline');
    return false;
  }
}

// Debounced push: call this after any data mutation
export function schedulePush(delayMs = 2000) {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushToCloud();
  }, delayMs);
}

// Initial sync on app load
export async function initSync(): Promise<void> {
  // Pull cloud data first, then merge local
  const pulled = await pullFromCloud();
  if (!pulled) {
    // No cloud data or no database — stay local-only
    setStatus('idle');
  }
}

export function getLastSyncedAt(): number {
  return lastSyncedAt;
}
