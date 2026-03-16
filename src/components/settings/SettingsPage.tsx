'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '@/lib/context';
import { db, getSettings, updateSettings, exportAllData, importAllData } from '@/lib/db';
import { formatMinutes } from '@/lib/utils';
import type { AppSettings } from '@/types';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

export default function SettingsPage() {
  const { refresh, theme, toggleTheme, syncStatus } = useApp();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [dailyCapacity, setDailyCapacity] = useState(420);
  const [endOfDayTime, setEndOfDayTime] = useState('17:00');
  const [weeklyReviewDay, setWeeklyReviewDay] = useState(5);
  const [saved, setSaved] = useState(false);

  // Backup state
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [backupStatus, setBackupStatus] = useState<'idle' | 'exporting' | 'importing' | 'done' | 'error'>('idle');
  const [backupMessage, setBackupMessage] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  useEffect(() => {
    getSettings().then(s => {
      setSettings(s);
      setDailyCapacity(s.dailyCapacityMinutes || 420);
      setEndOfDayTime(s.endOfDayTime || '17:00');
      setWeeklyReviewDay(s.weeklyReviewDay);
    });
  }, []);

  const saveSettings = async () => {
    await updateSettings({
      dailyCapacityMinutes: dailyCapacity,
      endOfDayTime,
      weeklyReviewDay,
    });
    setSaved(true);
    refresh();
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = async () => {
    setBackupStatus('exporting');
    try {
      const data = await exportAllData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fokus-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupStatus('done');
      setBackupMessage('Backup exported successfully.');
    } catch {
      setBackupStatus('error');
      setBackupMessage('Failed to export backup.');
    }
  };

  const handleImport = async (file: File) => {
    setBackupStatus('importing');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.exportedAt && !parsed.students && !parsed.tasks) {
        throw new Error('Invalid backup file');
      }
      const { counts } = await importAllData(text, importMode);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      setBackupStatus('done');
      setBackupMessage(`Imported ${total} records across ${Object.keys(counts).length} tables.`);
      refresh();
    } catch (e) {
      setBackupStatus('error');
      setBackupMessage(e instanceof Error ? e.message : 'Failed to import backup.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (importMode === 'replace') {
      setPendingFile(file);
    } else {
      handleImport(file);
    }
  };

  const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const capacityOptions = [180, 240, 300, 360, 420, 480, 540, 600];

  return (
    <div className="page-content" style={{ padding: '32px 36px', maxWidth: 700 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 24 }}>Settings</h1>

      {/* Appearance */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border-light)' }}>
          Appearance
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Theme</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Switch between light and dark mode</div>
          </div>
          <button className="btn-secondary" onClick={toggleTheme} style={{ fontSize: 13, minWidth: 100 }}>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </section>

      {/* Schedule & Capacity */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border-light)' }}>
          Schedule
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Daily capacity</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>How many hours of focused work per day</div>
            </div>
            <select className="select" style={{ width: 'auto' }} value={dailyCapacity} onChange={e => setDailyCapacity(Number(e.target.value))}>
              {capacityOptions.map(m => (
                <option key={m} value={m}>{formatMinutes(m)}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>End-of-day review time</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>When to prompt the daily review</div>
            </div>
            <input type="time" className="input" style={{ width: 'auto' }} value={endOfDayTime} onChange={e => setEndOfDayTime(e.target.value)} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Weekly review day</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>When to show the weekly review prompt</div>
            </div>
            <select className="select" style={{ width: 'auto' }} value={weeklyReviewDay} onChange={e => setWeeklyReviewDay(Number(e.target.value))}>
              {dayLabels.map((label, i) => (
                <option key={i} value={i}>{label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            {saved && <span style={{ fontSize: 12, color: 'var(--color-emerald)', alignSelf: 'center' }}>Saved!</span>}
            <button className="btn-primary" onClick={saveSettings} style={{ fontSize: 13 }}>Save changes</button>
          </div>
        </div>
      </section>

      {/* Sync */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border-light)' }}>
          Sync
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Cloud sync status</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Data syncs automatically when connected</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 12, fontWeight: 500,
              color: syncStatus === 'synced' ? 'var(--color-emerald)' :
                     syncStatus === 'error' ? 'var(--color-rose)' :
                     syncStatus === 'offline' ? 'var(--text-muted)' :
                     syncStatus === 'syncing' ? 'var(--color-sky)' : 'var(--text-muted)',
            }}>
              {syncStatus === 'synced' ? 'Connected' :
               syncStatus === 'syncing' ? 'Syncing...' :
               syncStatus === 'error' ? 'Error' :
               syncStatus === 'offline' ? 'Offline' : 'Local only'}
            </span>
            <button className="btn-ghost" onClick={() => {
              import('@/lib/sync').then(({ pushToCloud }) => pushToCloud());
            }} style={{ fontSize: 12 }}>
              Sync now
            </button>
          </div>
        </div>
      </section>

      {/* Backup & Restore */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border-light)' }}>
          Backup & Restore
        </h2>

        {/* Export */}
        <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Export backup</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Download all data as a JSON file</div>
            </div>
            <button className="btn-secondary" onClick={handleExport} disabled={backupStatus === 'exporting'} style={{ fontSize: 13 }}>
              {backupStatus === 'exporting' ? 'Exporting...' : 'Download backup'}
            </button>
          </div>
        </div>

        {/* Import */}
        <div style={{ padding: '16px 0' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Restore from backup</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Import data from a previously exported JSON file</div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer',
              padding: '6px 12px', borderRadius: 'var(--radius-sm)',
              background: importMode === 'merge' ? 'var(--color-accent-light)' : 'transparent',
              border: importMode === 'merge' ? '1px solid var(--color-accent)' : '1px solid var(--border-color)',
            }}>
              <input type="radio" name="importMode" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} style={{ accentColor: 'var(--color-accent)' }} />
              Merge
            </label>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer',
              padding: '6px 12px', borderRadius: 'var(--radius-sm)',
              background: importMode === 'replace' ? 'var(--color-rose-light)' : 'transparent',
              border: importMode === 'replace' ? '1px solid var(--color-rose)' : '1px solid var(--border-color)',
            }}>
              <input type="radio" name="importMode" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} style={{ accentColor: 'var(--color-rose)' }} />
              Replace all
            </label>
          </div>
          <p style={{ fontSize: 11, color: importMode === 'replace' ? 'var(--color-rose)' : 'var(--text-muted)', marginBottom: 12 }}>
            {importMode === 'merge'
              ? 'Merge adds imported data alongside existing data. Duplicate IDs are overwritten.'
              : 'Replace deletes all current data before importing. This cannot be undone.'}
          </p>

          <input ref={fileRef} type="file" accept=".json" onChange={handleFileChange} style={{ display: 'none' }} />
          <button className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={backupStatus === 'importing'} style={{ fontSize: 13 }}>
            {backupStatus === 'importing' ? 'Importing...' : 'Choose backup file'}
          </button>
        </div>

        {backupMessage && (
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, marginTop: 8,
            background: backupStatus === 'error' ? 'var(--color-rose-light)' : 'var(--color-emerald-light)',
            color: backupStatus === 'error' ? 'var(--color-rose)' : 'var(--color-emerald)',
          }}>
            {backupMessage}
          </div>
        )}
      </section>

      {/* About */}
      <section>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border-light)' }}>
          About
        </h2>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>
          <p><strong style={{ color: 'var(--text-primary)' }}>fokus</strong> — Teacher Productivity OS</p>
          <p>A personal productivity and teaching command center, designed for ADHD minds.</p>
          <p>Data is stored locally in your browser. Cloud sync available when configured.</p>
        </div>
      </section>

      {/* Replace-all confirmation */}
      <ConfirmDialog
        open={!!pendingFile}
        title="Replace All Data"
        message="This will delete ALL current data and replace it with the backup file. This cannot be undone. Are you sure?"
        confirmLabel="Replace All"
        onConfirm={() => {
          if (pendingFile) handleImport(pendingFile);
          setPendingFile(null);
        }}
        onCancel={() => {
          setPendingFile(null);
          if (fileRef.current) fileRef.current.value = '';
        }}
      />
    </div>
  );
}
