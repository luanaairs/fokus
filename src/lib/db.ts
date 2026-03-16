import Dexie, { type EntityTable } from 'dexie';
import type {
  Student, StudentGroup, Note, Task, Project,
  LessonPlan, WritingProject, Capture, FocusSession,
  ParkingLotItem, DailyStreak, AppSettings
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
  }
}

export const db = new FokusDB();

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
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}
