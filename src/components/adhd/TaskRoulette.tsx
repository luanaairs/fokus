'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/db';
import { priorityConfig } from '@/lib/utils';
import type { Task } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectTask: (task: Task) => void;
}

const SPIN_COLORS = [
  '#A2383B', '#6197E8', '#E2A716', '#CD9196', '#2d936c', '#8B5CF6',
  '#A2383B', '#6197E8', '#E2A716', '#CD9196', '#2d936c', '#8B5CF6',
];

export default function TaskRoulette({ open, onClose, onSelectTask }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      db.tasks.toArray().then(all => {
        const active = all.filter(t =>
          (t.status === 'todo' || t.status === 'in_progress') &&
          (!t.deferredUntil || t.deferredUntil <= Date.now())
        );
        // Take up to 8 tasks, prioritized
        const sorted = active.sort((a, b) =>
          priorityConfig[a.priority].sortOrder - priorityConfig[b.priority].sortOrder
        );
        setTasks(sorted.slice(0, 8));
        setSelectedIndex(null);
        setRotation(0);
      });
    }
  }, [open]);

  const spin = () => {
    if (tasks.length === 0 || spinning) return;
    setSpinning(true);
    setSelectedIndex(null);

    const winner = Math.floor(Math.random() * tasks.length);
    const segmentAngle = 360 / tasks.length;
    // Spin multiple full rotations + land on winner
    const extraRotations = 5 + Math.floor(Math.random() * 3);
    const targetAngle = extraRotations * 360 + (360 - winner * segmentAngle - segmentAngle / 2);

    setRotation(prev => prev + targetAngle);

    spinTimeoutRef.current = setTimeout(() => {
      setSpinning(false);
      setSelectedIndex(winner);
    }, 3500);
  };

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
    };
  }, []);

  if (!open) return null;

  const segmentAngle = tasks.length > 0 ? 360 / tasks.length : 360;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && !spinning) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: 520, textAlign: 'center', padding: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 8 }}>
          Task Roulette
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
          Can&apos;t decide? Let the wheel choose for you.
        </p>

        {tasks.length === 0 ? (
          <div style={{ padding: '32px 0', color: 'var(--text-muted)' }}>
            <p>No active tasks to spin!</p>
            <button className="btn-ghost" onClick={onClose} style={{ marginTop: 16 }}>Close</button>
          </div>
        ) : (
          <>
            {/* Wheel */}
            <div style={{ position: 'relative', width: 280, height: 280, margin: '0 auto 24px' }}>
              {/* Pointer */}
              <div style={{
                position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                width: 0, height: 0,
                borderLeft: '10px solid transparent', borderRight: '10px solid transparent',
                borderTop: '16px solid var(--color-accent)',
                zIndex: 2,
              }} />

              <svg width="280" height="280" viewBox="0 0 280 280" style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? 'transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
              }}>
                {tasks.map((task, i) => {
                  const startAngle = i * segmentAngle;
                  const endAngle = startAngle + segmentAngle;
                  const startRad = (startAngle - 90) * Math.PI / 180;
                  const endRad = (endAngle - 90) * Math.PI / 180;
                  const r = 135;
                  const cx = 140, cy = 140;
                  const x1 = cx + r * Math.cos(startRad);
                  const y1 = cy + r * Math.sin(startRad);
                  const x2 = cx + r * Math.cos(endRad);
                  const y2 = cy + r * Math.sin(endRad);
                  const largeArc = segmentAngle > 180 ? 1 : 0;

                  const midAngle = ((startAngle + endAngle) / 2 - 90) * Math.PI / 180;
                  const textR = r * 0.6;
                  const tx = cx + textR * Math.cos(midAngle);
                  const ty = cy + textR * Math.sin(midAngle);
                  const textRotation = (startAngle + endAngle) / 2;

                  return (
                    <g key={task.id}>
                      <path
                        d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`}
                        fill={SPIN_COLORS[i % SPIN_COLORS.length]}
                        stroke="var(--bg-card)"
                        strokeWidth="2"
                        opacity={selectedIndex === i ? 1 : 0.85}
                      />
                      <text
                        x={tx} y={ty}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize={tasks.length > 6 ? 9 : 11}
                        fontWeight="600"
                        transform={`rotate(${textRotation}, ${tx}, ${ty})`}
                      >
                        {task.title.length > 14 ? task.title.slice(0, 12) + '..' : task.title}
                      </text>
                    </g>
                  );
                })}
                <circle cx="140" cy="140" r="20" fill="var(--bg-card)" stroke="var(--border-color)" strokeWidth="2" />
              </svg>
            </div>

            {/* Result */}
            {selectedIndex !== null && (
              <div style={{
                padding: '16px 20px', background: 'var(--color-accent-light)',
                borderRadius: 'var(--radius-md)', marginBottom: 16,
                animation: 'fadeIn 0.3s ease',
              }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>The wheel has spoken:</div>
                <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-accent)' }}>
                  {tasks[selectedIndex].title}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {selectedIndex !== null ? (
                <>
                  <button className="btn-ghost" onClick={spin}>Spin Again</button>
                  <button className="btn-primary" onClick={() => {
                    onSelectTask(tasks[selectedIndex!]);
                    onClose();
                  }}>
                    Let&apos;s Do It!
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-ghost" onClick={onClose}>Cancel</button>
                  <button className="btn-primary" onClick={spin} disabled={spinning} style={{ padding: '10px 28px' }}>
                    {spinning ? 'Spinning...' : 'Spin!'}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
