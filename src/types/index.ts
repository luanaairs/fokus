export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'deferred';
export type LessonStatus = 'draft' | 'planned' | 'delivered' | 'reviewed';
export type WritingStatus = 'idea' | 'drafting' | 'editing' | 'submitted' | 'published' | 'archived';
export type RecurrenceType = 'daily' | 'weekly' | 'custom';
export type CaptureType = 'task' | 'note' | 'idea' | 'lesson_plan';

export interface Student {
  id: string;
  name: string;
  grade: string;
  subject: string;
  contactInfo: string;
  tags: string[];
  groupId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface StudentGroup {
  id: string;
  name: string;
  description: string;
  createdAt: number;
}

export interface Note {
  id: string;
  content: string;
  tags: string[];
  studentId?: string;
  projectId?: string;
  writingProjectId?: string;
  isProgressNote: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate?: number;
  priority: Priority;
  projectId?: string;
  studentId?: string;
  writingProjectId?: string;
  contextTag: string;
  estimatedMinutes: number;
  status: TaskStatus;
  parentTaskId?: string;
  isRecurring: boolean;
  recurrenceType?: RecurrenceType;
  recurrenceInterval?: number;
  completedAt?: number;
  deferredUntil?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  isTeaching: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface LessonPlan {
  id: string;
  title: string;
  studentId?: string;
  groupId?: string;
  date: number;
  objectives: string;
  materials: string;
  activities: string;
  notes: string;
  status: LessonStatus;
  attachments: Attachment[];
  createdAt: number;
  updatedAt: number;
}

export interface Attachment {
  name: string;
  url: string;
}

export interface WritingProject {
  id: string;
  title: string;
  genre: string;
  status: WritingStatus;
  editorUrl: string;
  deadline?: number;
  wordCountGoal: number;
  currentWordCount: number;
  wordCountHistory: WordCountEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface WordCountEntry {
  date: number;
  count: number;
}

export interface Capture {
  id: string;
  content: string;
  tags: string[];
  studentId?: string;
  projectId?: string;
  type?: CaptureType;
  processed: boolean;
  createdAt: number;
}

export interface FocusSession {
  id: string;
  taskId: string;
  startedAt: number;
  duration: number;
  completedAt?: number;
}

export interface ParkingLotItem {
  id: string;
  content: string;
  sessionId?: string;
  createdAt: number;
  processed: boolean;
}

export interface DailyStreak {
  id: string;
  date: string;
  tasksCompleted: number;
}

export interface AppSettings {
  id: string;
  theme: 'dark' | 'light';
  weeklyReviewDay: number;
  activeContextType?: 'student' | 'project' | 'writing';
  activeContextId?: string;
  timerRunning: boolean;
  timerTaskId?: string;
  timerEndTime?: number;
}
