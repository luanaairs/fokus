# fokus

A personal productivity and teaching OS — a single, cohesive app that serves as the command center for a teacher's professional and personal life. Designed for ADHD minds: reduced friction, minimised decision fatigue, right information at the right moment.

## Core Modules

- **Dashboard** — Today's focus, done pile, upcoming tasks, project progress, streaks
- **Student Manager** — Full student profiles, notes, tasks, lesson plans, progress tracking, groups
- **Task System** — Universal tasks with projects, priorities, subtasks, recurrence, multiple views (Today/Upcoming/Project/Student/Backlog)
- **Priorities** — Eisenhower matrix (Urgency × Importance), smart "Today's 3" suggestions
- **Writing Projects** — Track fiction, essays, articles with word count goals, velocity, linked notes & tasks
- **ADHD Features**:
  - Quick Capture (⌘K) — persistent capture from anywhere, routes to inbox
  - Inbox — triage captures into tasks or notes
  - Focus Mode — single task, timer ring, distraction-free
  - Session Planner — "How long do you have?" → auto-suggest task queue
  - Task Timer — countdown visible in top bar across all views
  - Parking Lot — mid-session scratchpad for stray thoughts
  - Switch Warning — confirms when navigating away from active timer
  - Weekly Review — Friday prompt showing completed, rolled over, upcoming
  - Streak tracking & done pile for motivation

## Tech Stack

- **Next.js 16** + React 19 + TypeScript
- **Tailwind CSS v4** for styling
- **Dexie.js** (IndexedDB) for local-first data
- Custom dark/light theme with jewel-toned accent palette
- Playfair Display + Source Sans 3 + JetBrains Mono typography

## Keyboard Shortcuts

- `⌘K` / `Ctrl+K` — Quick Capture
- `⌘E` / `Ctrl+E` — Export all data as JSON
- `Esc` — Close modals / exit focus mode

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

Deploy to Vercel:

```bash
npx vercel
```
