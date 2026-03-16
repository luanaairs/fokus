'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { AppSettings } from '@/types';
import { db, getSettings, updateSettings } from '@/lib/db';

interface ActiveContext {
  type?: 'student' | 'project' | 'writing';
  id?: string;
  label?: string;
}

interface AppContextType {
  settings: AppSettings | null;
  activeContext: ActiveContext;
  setActiveContext: (ctx: ActiveContext) => void;
  captureOpen: boolean;
  setCaptureOpen: (open: boolean) => void;
  focusMode: boolean;
  setFocusMode: (on: boolean) => void;
  focusTaskId: string | null;
  setFocusTaskId: (id: string | null) => void;
  sessionPlannerOpen: boolean;
  setSessionPlannerOpen: (open: boolean) => void;
  refreshKey: number;
  refresh: () => void;
  timerTaskId: string | null;
  setTimerTaskId: (id: string | null) => void;
  timerDuration: number;
  setTimerDuration: (d: number) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  switchWarning: { show: boolean; taskTitle: string; onContinue: () => void } | null;
  setSwitchWarning: (w: { show: boolean; taskTitle: string; onContinue: () => void } | null) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = useState<AppSettings | null>(null);
  const [activeContext, setActiveContext] = useState<ActiveContext>({});
  const [captureOpen, setCaptureOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [sessionPlannerOpen, setSessionPlannerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [timerTaskId, setTimerTaskId] = useState<string | null>(null);
  const [timerDuration, setTimerDuration] = useState(0);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [switchWarning, setSwitchWarning] = useState<{ show: boolean; taskTitle: string; onContinue: () => void } | null>(null);

  useEffect(() => {
    getSettings().then(s => {
      setSettingsState(s);
      setTheme(s.theme);
    });
  }, []);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const toggleTheme = useCallback(async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    await updateSettings({ theme: next });
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <AppContext.Provider value={{
      settings, activeContext, setActiveContext,
      captureOpen, setCaptureOpen,
      focusMode, setFocusMode,
      focusTaskId, setFocusTaskId,
      sessionPlannerOpen, setSessionPlannerOpen,
      refreshKey, refresh,
      timerTaskId, setTimerTaskId,
      timerDuration, setTimerDuration,
      theme, toggleTheme,
      switchWarning, setSwitchWarning,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
