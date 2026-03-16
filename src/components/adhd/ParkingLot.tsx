'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/db';
import { newId, now, formatDate } from '@/lib/utils';
import type { ParkingLotItem } from '@/types';
import EmptyState from '@/components/shared/EmptyState';

export default function ParkingLot() {
  const { refreshKey, refresh } = useApp();
  const [items, setItems] = useState<ParkingLotItem[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    db.parkingLot.where('processed').equals(0).toArray().then(i =>
      setItems(i.sort((a, b) => b.createdAt - a.createdAt))
    );
  }, [refreshKey]);

  const add = async () => {
    if (!input.trim()) return;
    await db.parkingLot.add({ id: newId(), content: input.trim(), processed: false, createdAt: now() });
    setInput('');
    refresh();
  };

  const moveToInbox = async (item: ParkingLotItem) => {
    await db.captures.add({ id: newId(), content: item.content, tags: [], processed: false, createdAt: now() });
    await db.parkingLot.update(item.id, { processed: true });
    refresh();
  };

  const dismiss = async (id: string) => {
    await db.parkingLot.update(id, { processed: true });
    refresh();
  };

  return (
    <div className="page-content" style={{ padding: '32px 36px', maxWidth: 700 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 4 }}>Parking Lot</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
        Stray thoughts captured mid-task. Triage or clear at end of session.
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <input
          className="input"
          placeholder="Quick thought..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
        />
        <button className="btn-primary" onClick={add}>Park it</button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon="💭" title="Parking lot is empty" description="Capture stray thoughts here during focus sessions" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(item => (
            <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
              <span style={{ flex: 1, fontSize: 14 }}>{item.content}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(item.createdAt)}</span>
              <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => moveToInbox(item)}>To Inbox</button>
              <button className="btn-icon" onClick={() => dismiss(item.id)} style={{ color: 'var(--text-muted)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
          <button className="btn-ghost" style={{ marginTop: 8, alignSelf: 'flex-start' }} onClick={async () => {
            await Promise.all(items.map(i => db.parkingLot.update(i.id, { processed: true })));
            refresh();
          }}>Clear all</button>
        </div>
      )}
    </div>
  );
}
