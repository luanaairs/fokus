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
  outline?: OutlineSection[];
  revisionChecklist?: RevisionItem[];
  scratchpad?: string;
  dailyWordGoal?: number;
  createdAt: number;
  updatedAt: number;
}

export interface WordCountEntry {
  date: number;
  count: number;
  sessionMinutes?: number; // for sprint tracking
  note?: string;
}

export interface OutlineSection {
  id: string;
  /** 'chapter' = top-level grouping; 'scene' / 'plot_point' = child items; absent = legacy flat section */
  type?: 'chapter' | 'scene' | 'plot_point';
  /** For scenes/plot_points: id of the parent chapter */
  parentId?: string;
  title: string;
  notes?: string;
  targetWords?: number;
  currentWords?: number;
  status: 'todo' | 'drafting' | 'done';
  sortOrder: number;
  /** Chapter-specific */
  chapterNumber?: number;
  color?: string;
  /** Scene / plot-point specific */
  storyDate?: string;  // free-text in-story date/time for chronological sorting
  pov?: string;        // point-of-view character
  location?: string;
}

export interface RevisionItem {
  id: string;
  label: string;
  checked: boolean;
  notes?: string;
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
  dailyCapacityMinutes?: number;
  endOfDayTime?: string; // "HH:MM" format
  transitionPrompts?: boolean; // show transition prompts when navigating modules
}

// --- Routine Module ---

export type RoutineType = 'fixed' | 'timed' | 'flexible' | 'weekly';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'custom';
export type RoutineItemType = 'step' | 'linked_task' | 'buffer' | 'divider';
export type RoutineItemStatus = 'pending' | 'active' | 'done' | 'skipped';

export interface Routine {
  id: string;
  name: string;
  type: RoutineType;
  timeOfDay: TimeOfDay;
  customLabel?: string;
  /** For weekly recurring: which days (0=Sun, 1=Mon, ..., 6=Sat) */
  weekDays?: number[];
  /** For timed routines, overall start time "HH:MM" */
  startTime?: string;
  isTemplate: boolean;
  isActive: boolean; // active for today
  createdAt: number;
  updatedAt: number;
}

export interface RoutineItem {
  id: string;
  routineId: string;
  type: RoutineItemType;
  title: string;
  notes?: string;
  /** Estimated duration in minutes */
  durationMinutes: number;
  /** For linked_task: the task id */
  linkedTaskId?: string;
  /** For timed routines: start time "HH:MM" */
  startTime?: string;
  /** Sort order within routine */
  sortOrder: number;
  createdAt: number;
}

export interface RoutineRun {
  id: string;
  routineId: string;
  date: string; // "YYYY-MM-DD"
  startedAt: number;
  completedAt?: number;
  /** Per-item status for this run */
  itemStates: RoutineRunItemState[];
}

export interface RoutineRunItemState {
  itemId: string;
  status: RoutineItemStatus;
  startedAt?: number;
  completedAt?: number;
  /** Elapsed seconds (for pause/resume tracking) */
  elapsedSeconds: number;
}

// --- Gamification ---

export interface UserXP {
  id: string; // always 'default'
  totalXP: number;
  level: number;
  tasksCompleted: number;
  routinesCompleted: number;
  focusMinutes: number;
  currentStreak: number;
  longestStreak: number;
  achievements: string[]; // achievement IDs
  updatedAt: number;
}

export interface PomodoroSession {
  id: string;
  taskId?: string;
  type: 'work' | 'short_break' | 'long_break';
  duration: number; // seconds
  completedAt: number;
}
