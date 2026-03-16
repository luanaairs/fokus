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
    await db.parkingLot.add({
      id: newId(),
      content: input.trim(),
      processed: false,
      createdAt: now(),
    });
    setInput('');
    refresh();
  };

  const moveToInbox = async (item: ParkingLotItem) => {
    await db.captures.add({
      id: newId(),
      content: item.content,
      tags: [],
      processed: false,
      createdAt: now(),
    });
    await db.parkingLot.update(item.id, { processed: true });
    refresh();
  };

  const dismiss = async (id: string) => {
    await db.parkingLot.update(id, { processed: true });
    refresh();
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 700 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Parking Lot</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        Stray thoughts captured mid-task. Triage or clear at end of session.
      </p>

      <div className="flex gap-2" style={{ marginBottom: 20 }}>
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
        <EmptyState icon="▧" title="Parking lot is empty" description="Capture stray thoughts here during focus sessions" />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(item => (
            <div key={item.id} className="card flex items-center gap-3" style={{ padding: '10px 14px' }}>
              <span style={{ flex: 1, fontSize: 14 }}>{item.content}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(item.createdAt)}</span>
              <button className="btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => moveToInbox(item)}>→ Inbox</button>
              <button className="btn-icon" onClick={() => dismiss(item.id)} style={{ color: 'var(--text-muted)', fontSize: 12 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <button
          className="btn-ghost"
          style={{ marginTop: 16, fontSize: 13 }}
          onClick={async () => {
            await Promise.all(items.map(i => db.parkingLot.update(i.id, { processed: true })));
            refresh();
          }}
        >
          Clear all
        </button>
      )}
    </div>
  );
}
