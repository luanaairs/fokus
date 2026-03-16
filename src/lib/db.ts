import Dexie, { type EntityTable } from 'dexie';
import type {
  Student, StudentGroup, Note, Task, Project,
  LessonPlan, WritingProject, Capture, FocusSession,
  ParkingLotItem, DailyStreak, AppSettings,
  Routine, RoutineItem, RoutineRun
} from '@/types';

class FokusDB extends Dexie {
  students!: EntityTable<Student, 'id'>;
  studentGroups!: EntityTable<StudentGroup, 'id'>;
  notes!: EntityTable<Note, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  projects!: EntityTable<Project, 'id'>;
  lessonPlans!: EntityTable<LessonPlan, 'id'>;
  writingProjects!: EntityTable<WritingProject, 'id'>;
  captures!: EntityTable<Capture, 'id'>;
  focusSessions!: EntityTable<FocusSession, 'id'>;
  parkingLot!: EntityTable<ParkingLotItem, 'id'>;
  dailyStreaks!: EntityTable<DailyStreak, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  routineItems!: EntityTable<RoutineItem, 'id'>;
  routineRuns!: EntityTable<RoutineRun, 'id'>;

  constructor() {
    super('fokus');
    this.version(1).stores({
      students: 'id, name, grade, subject, *tags, groupId, createdAt',
      studentGroups: 'id, name',
      notes: 'id, studentId, projectId, writingProjectId, isProgressNote, createdAt, *tags',
      tasks: 'id, status, priority, dueDate, projectId, studentId, writingProjectId, parentTaskId, createdAt',
      projects: 'id, name, isTeaching, createdAt',
      lessonPlans: 'id, studentId, groupId, status, date, createdAt',
      writingProjects: 'id, title, status, createdAt',
      captures: 'id, processed, createdAt',
      focusSessions: 'id, taskId, startedAt',
      parkingLot: 'id, processed, createdAt',
      dailyStreaks: 'id, date',
      settings: 'id',
    });
    this.version(2).stores({
      students: 'id, name, grade, subject, *tags, groupId, createdAt',
      studentGroups: 'id, name',
      notes: 'id, studentId, projectId, writingProjectId, isProgressNote, createdAt, *tags',
      tasks: 'id, status, priority, dueDate, projectId, studentId, writingProjectId, parentTaskId, createdAt',
      projects: 'id, name, isTeaching, createdAt',
      lessonPlans: 'id, studentId, groupId, status, date, createdAt',
      writingProjects: 'id, title, status, createdAt',
      captures: 'id, processed, createdAt',
      focusSessions: 'id, taskId, startedAt',
      parkingLot: 'id, processed, createdAt',
      dailyStreaks: 'id, date',
      settings: 'id',
      routines: 'id, type, timeOfDay, isActive, isTemplate, createdAt',
      routineItems: 'id, routineId, type, linkedTaskId, sortOrder, createdAt',
      routineRuns: 'id, routineId, date, startedAt',
    });
  }
}

// Lazy-init to avoid SSR issues — IndexedDB only exists in the browser
let _db: FokusDB | null = null;

function getDB(): FokusDB {
  if (!_db) {
    _db = new FokusDB();
  }
  return _db;
}

export const db: FokusDB = typeof window !== 'undefined'
  ? getDB()
  : (new Proxy({} as FokusDB, {
      get(_target, prop) {
        // During SSR, return a no-op proxy so imports don't crash
        if (prop === 'then') return undefined;
        return new Proxy(() => {}, {
          get: () => () => Promise.resolve([]),
          apply: () => Promise.resolve([]),
        });
      },
    }));

export async function getSettings(): Promise<AppSettings> {
  let settings = await db.settings.get('default');
  if (!settings) {
    settings = {
      id: 'default',
      theme: 'dark',
      weeklyReviewDay: 5,
      timerRunning: false,
    };
    await db.settings.put(settings);
  }
  return settings;
}

export async function updateSettings(updates: Partial<AppSettings>): Promise<void> {
  await db.settings.update('default', updates);
}

export async function recordStreak(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const existing = await db.dailyStreaks.where('date').equals(today).first();
  if (existing) {
    await db.dailyStreaks.update(existing.id, { tasksCompleted: existing.tasksCompleted + 1 });
  } else {
    await db.dailyStreaks.put({ id: today, date: today, tasksCompleted: 1 });
  }
}

export async function recordFocusSession(taskId: string, duration: number): Promise<void> {
  const { v4: uuidv4 } = await import('uuid');
  await db.focusSessions.add({
    id: uuidv4(),
    taskId,
    startedAt: Date.now() - duration * 1000,
    duration,
    completedAt: Date.now(),
  });
}

export async function handleRecurringTask(task: import('@/types').Task): Promise<void> {
  if (!task.isRecurring || !task.recurrenceType) return;
  const { v4: uuidv4 } = await import('uuid');

  let nextDue: number | undefined;
  const base = task.dueDate || Date.now();
  const day = 24 * 60 * 60 * 1000;

  switch (task.recurrenceType) {
    case 'daily':
      nextDue = base + day;
      break;
    case 'weekly':
      nextDue = base + 7 * day;
      break;
    case 'custom':
      nextDue = base + (task.recurrenceInterval || 7) * day;
      break;
  }

  await db.tasks.add({
    ...task,
    id: uuidv4(),
    status: 'todo',
    completedAt: undefined,
    deferredUntil: undefined,
    dueDate: nextDue,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function completeTaskById(id: string): Promise<void> {
  const task = await db.tasks.get(id);
  if (!task) return;
  await db.tasks.update(id, { status: 'done', completedAt: Date.now() });
  await recordStreak();
  if (task.isRecurring) {
    await handleRecurringTask(task);
  }
}

export async function uncompleteTaskById(id: string): Promise<void> {
  await db.tasks.update(id, { status: 'todo', completedAt: undefined });
}

export async function exportAllData(): Promise<string> {
  const data = {
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
    routines: await db.routines.toArray(),
    routineItems: await db.routineItems.toArray(),
    routineRuns: await db.routineRuns.toArray(),
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}

export async function importAllData(json: string, mode: 'merge' | 'replace'): Promise<{ counts: Record<string, number> }> {
  const data = JSON.parse(json);
  const tables = [
    'students', 'studentGroups', 'notes', 'tasks', 'projects',
    'lessonPlans', 'writingProjects', 'captures', 'focusSessions',
    'parkingLot', 'dailyStreaks',
    'routines', 'routineItems', 'routineRuns',
  ] as const;

  if (mode === 'replace') {
    for (const table of tables) {
      await (db[table] as unknown as { clear: () => Promise<void> }).clear();
    }
  }

  const counts: Record<string, number> = {};
  for (const table of tables) {
    const items = data[table];
    if (Array.isArray(items) && items.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db[table] as any).bulkPut(items);
      counts[table] = items.length;
    }
  }
  return { counts };
}
