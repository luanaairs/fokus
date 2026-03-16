'use client';

import React, { useRef, useState } from 'react';
import { useApp } from '@/lib/context';
import { exportAllData, importAllData } from '@/lib/db';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function BackupRestore({ open, onClose }: Props) {
  const { refresh } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [status, setStatus] = useState<'idle' | 'exporting' | 'importing' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleExport = async () => {
    setStatus('exporting');
    try {
      const data = await exportAllData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fokus-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('done');
      setMessage('Backup exported successfully.');
    } catch {
      setStatus('error');
      setMessage('Failed to export backup.');
    }
  };

  const handleImport = async (file: File) => {
    setStatus('importing');
    try {
      const text = await file.text();
      // Basic validation
      const parsed = JSON.parse(text);
      if (!parsed.exportedAt && !parsed.students && !parsed.tasks) {
        throw new Error('Invalid backup file');
      }
      const { counts } = await importAllData(text, mode);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      setStatus('done');
      setMessage(`Imported ${total} records across ${Object.keys(counts).length} tables.`);
      refresh();
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Failed to import backup.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (mode === 'replace') {
      setPendingFile(file);
    } else {
      handleImport(file);
    }
  };

  const reset = () => {
    setStatus('idle');
    setMessage('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Backup & Restore">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Export */}
        <div style={{ padding: 20, background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>Export Backup</h3>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Download all your data as a JSON file. Includes students, tasks, projects, notes, and all other data.
          </p>
          <button className="btn-primary" onClick={handleExport} disabled={status === 'exporting'} style={{ fontSize: 13 }}>
            {status === 'exporting' ? 'Exporting...' : 'Download Backup'}
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 10 }}>⌘E</span>
        </div>

        {/* Import */}
        <div style={{ padding: 20, background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-sky)" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>Restore from Backup</h3>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Import data from a previously exported JSON backup file.
          </p>

          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer',
              padding: '6px 12px', borderRadius: 'var(--radius-sm)',
              background: mode === 'merge' ? 'var(--color-accent-light)' : 'transparent',
              border: mode === 'merge' ? '1px solid var(--color-accent)' : '1px solid var(--border-color)',
            }}>
              <input type="radio" name="importMode" checked={mode === 'merge'} onChange={() => setMode('merge')} style={{ accentColor: 'var(--color-accent)' }} />
              Merge
            </label>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer',
              padding: '6px 12px', borderRadius: 'var(--radius-sm)',
              background: mode === 'replace' ? 'var(--color-rose-light)' : 'transparent',
              border: mode === 'replace' ? '1px solid var(--color-rose)' : '1px solid var(--border-color)',
            }}>
              <input type="radio" name="importMode" checked={mode === 'replace'} onChange={() => setMode('replace')} style={{ accentColor: 'var(--color-rose)' }} />
              Replace all
            </label>
          </div>
          <p style={{ fontSize: 11, color: mode === 'replace' ? 'var(--color-rose)' : 'var(--text-muted)', marginBottom: 12 }}>
            {mode === 'merge'
              ? 'Merge adds imported data alongside existing data. Duplicate IDs are overwritten.'
              : 'Replace deletes all current data before importing. This cannot be undone.'}
          </p>

          <input ref={fileRef} type="file" accept=".json" onChange={handleFileChange} style={{ display: 'none' }} />
          <button className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={status === 'importing'} style={{ fontSize: 13 }}>
            {status === 'importing' ? 'Importing...' : 'Choose Backup File'}
          </button>
        </div>

        {/* Status message */}
        {message && (
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13,
            background: status === 'error' ? 'var(--color-rose-light)' : 'var(--color-emerald-light)',
            color: status === 'error' ? 'var(--color-rose)' : 'var(--color-emerald)',
          }}>
            {message}
          </div>
        )}
      </div>

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
    </Modal>
  );
}
