'use client';

import React, { useState, useCallback, useRef } from 'react';
import { AppProvider, useApp } from '@/lib/context';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import Dashboard from '@/components/dashboard/Dashboard';
import TaskList from '@/components/tasks/TaskList';
import StudentManager from '@/components/students/StudentManager';
import WritingProjects from '@/components/writing/WritingProjects';
import EisenhowerMatrix from '@/components/priorities/EisenhowerMatrix';
import Inbox from '@/components/adhd/Inbox';
import ParkingLot from '@/components/adhd/ParkingLot';
import RoutineManager from '@/components/routines/RoutineManager';
import RoutineNudge from '@/components/routines/RoutineNudge';
import SettingsPage from '@/components/settings/SettingsPage';
import QuickCapture from '@/components/adhd/QuickCapture';
import FocusMode from '@/components/adhd/FocusMode';
import SessionPlanner from '@/components/adhd/SessionPlanner';
import SwitchWarning from '@/components/adhd/SwitchWarning';
import WeeklyReview from '@/components/adhd/WeeklyReview';
import PomodoroMode from '@/components/adhd/PomodoroMode';
import TaskRoulette from '@/components/adhd/TaskRoulette';
import PerfectionChallenge from '@/components/adhd/PerfectionChallenge';
import TransitionPrompt from '@/components/adhd/TransitionPrompt';
import WeeklyReviewWizard from '@/components/adhd/WeeklyReviewWizard';
import { useKeyboard } from '@/hooks/useKeyboard';
import { exportAllData } from '@/lib/db';

function AppShell() {
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { setCaptureOpen, timerTaskId, setSwitchWarning, setFocusMode, setFocusTaskId } = useApp();

  // New feature state
  const [pomodoroOpen, setPomodoroOpen] = useState(false);
  const [pomodoroTaskId, setPomodoroTaskId] = useState<string | undefined>();
  const [rouletteOpen, setRouletteOpen] = useState(false);
  const [perfectionOpen, setPerfectionOpen] = useState(false);
  const [perfectionTaskId, setPerfectionTaskId] = useState('');
  const [weeklyReviewWizardOpen, setWeeklyReviewWizardOpen] = useState(false);
  const [transition, setTransition] = useState<{ from: string; to: string } | null>(null);
  const previousModule = useRef(currentModule);

  const handleCapture = useCallback(() => setCaptureOpen(true), [setCaptureOpen]);
  useKeyboard('k', handleCapture);

  const navigate = useCallback((module: string) => {
    setSidebarOpen(false);
    if (timerTaskId && module !== currentModule) {
      setSwitchWarning({
        show: true,
        taskTitle: 'current task',
        onContinue: () => {
          previousModule.current = currentModule;
          setTransition({ from: currentModule, to: module });
          setCurrentModule(module);
        },
      });
    } else if (module !== currentModule) {
      previousModule.current = currentModule;
      setTransition({ from: currentModule, to: module });
      setCurrentModule(module);
    }
  }, [timerTaskId, currentModule, setSwitchWarning]);

  const handleExport = async () => {
    const data = await exportAllData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fokus-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useKeyboard('e', handleExport);

  const renderModule = () => {
    switch (currentModule) {
      case 'dashboard': return <Dashboard
        onNavigate={navigate}
        onOpenPomodoro={(taskId?: string) => { setPomodoroTaskId(taskId); setPomodoroOpen(true); }}
        onOpenRoulette={() => setRouletteOpen(true)}
        onOpenPerfection={(taskId: string) => { setPerfectionTaskId(taskId); setPerfectionOpen(true); }}
        onOpenWeeklyReview={() => setWeeklyReviewWizardOpen(true)}
      />;
      case 'tasks': return <TaskList />;
      case 'routines': return <RoutineManager />;
      case 'students': return <StudentManager />;
      case 'writing': return <WritingProjects />;
      case 'priorities': return <EisenhowerMatrix />;
      case 'inbox': return <Inbox />;
      case 'parking': return <ParkingLot />;
      case 'settings': return <SettingsPage />;
      default: return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <div className="flex" style={{ height: '100vh', overflow: 'hidden' }}>
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <div className={`app-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <Sidebar
          currentModule={currentModule}
          onNavigate={navigate}
          onOpenPomodoro={() => { setPomodoroTaskId(undefined); setPomodoroOpen(true); }}
          onOpenRoulette={() => setRouletteOpen(true)}
        />
      </div>
      <div className="flex flex-col" style={{ flex: 1, overflow: 'hidden' }}>
        <TopBar onMenuToggle={() => setSidebarOpen(o => !o)} />
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {renderModule()}
        </main>
      </div>
      <QuickCapture />
      <FocusMode />
      <SessionPlanner />
      <SwitchWarning />
      <WeeklyReview />
      <RoutineNudge onStartRoutine={() => setCurrentModule('routines')} />
      <PomodoroMode open={pomodoroOpen} onClose={() => setPomodoroOpen(false)} taskId={pomodoroTaskId} />
      <TaskRoulette
        open={rouletteOpen}
        onClose={() => setRouletteOpen(false)}
        onSelectTask={(task) => { setFocusTaskId(task.id); setFocusMode(true); }}
      />
      <PerfectionChallenge open={perfectionOpen} onClose={() => setPerfectionOpen(false)} taskId={perfectionTaskId} />
      <WeeklyReviewWizard open={weeklyReviewWizardOpen} onClose={() => setWeeklyReviewWizardOpen(false)} />
      {transition && (
        <TransitionPrompt
          from={transition.from}
          to={transition.to}
          onComplete={() => setTransition(null)}
        />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
