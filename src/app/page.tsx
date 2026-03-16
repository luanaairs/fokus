'use client';

import React, { useState, useCallback } from 'react';
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
import QuickCapture from '@/components/adhd/QuickCapture';
import FocusMode from '@/components/adhd/FocusMode';
import SessionPlanner from '@/components/adhd/SessionPlanner';
import SwitchWarning from '@/components/adhd/SwitchWarning';
import WeeklyReview from '@/components/adhd/WeeklyReview';
import BackupRestore from '@/components/shared/BackupRestore';
import { useKeyboard } from '@/hooks/useKeyboard';
import { exportAllData } from '@/lib/db';

function AppShell() {
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [showBackup, setShowBackup] = useState(false);
  const { setCaptureOpen, timerTaskId, setSwitchWarning } = useApp();

  const handleCapture = useCallback(() => setCaptureOpen(true), [setCaptureOpen]);
  useKeyboard('k', handleCapture);

  const navigate = useCallback((module: string) => {
    if (timerTaskId && module !== currentModule) {
      setSwitchWarning({
        show: true,
        taskTitle: 'current task',
        onContinue: () => setCurrentModule(module),
      });
    } else {
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
      case 'dashboard': return <Dashboard onNavigate={navigate} />;
      case 'tasks': return <TaskList />;
      case 'students': return <StudentManager />;
      case 'writing': return <WritingProjects />;
      case 'priorities': return <EisenhowerMatrix />;
      case 'inbox': return <Inbox />;
      case 'parking': return <ParkingLot />;
      default: return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <div className="flex" style={{ height: '100vh', overflow: 'hidden' }}>
      <Sidebar currentModule={currentModule} onNavigate={navigate} onBackup={() => setShowBackup(true)} />
      <div className="flex flex-col" style={{ flex: 1, overflow: 'hidden' }}>
        <TopBar />
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {renderModule()}
        </main>
      </div>
      <QuickCapture />
      <FocusMode />
      <SessionPlanner />
      <SwitchWarning />
      <WeeklyReview />
      <BackupRestore open={showBackup} onClose={() => setShowBackup(false)} />
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
