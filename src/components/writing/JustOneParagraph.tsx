'use client';

import React, { useState, useEffect, useRef } from 'react';
import { formatTimer } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  sectionTitle?: string;
}

const DURATION = 10 * 60; // 10 minutes

export default function JustOneParagraph({ open, onClose, sectionTitle }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [text, setText] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) {
      setSecondsLeft(DURATION);
      setIsRunning(false);
      setStarted(false);
      setText('');
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [open]);

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsRunning(false);
          try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = 520; osc.type = 'sine';
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
            osc.start(); osc.stop(ctx.currentTime + 0.8);
          } catch {}
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning]);

  const start = () => {
    setStarted(true);
    setIsRunning(true);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  if (!open) return null;

  const progress = (DURATION - secondsLeft) / DURATION;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const timeUp = secondsLeft === 0;

  return (
    <div className="focus-overlay">
      <button onClick={onClose} className="btn-secondary" style={{
        position: 'absolute', top: 28, right: 28,
      }}>
        Close
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%', maxWidth: 600 }}>
        <div style={{
          fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em',
          color: 'var(--color-amber)', background: 'var(--color-amber-light, rgba(226,167,22,0.15))',
          padding: '6px 20px', borderRadius: 'var(--radius-full)',
        }}>
          Just One Paragraph
        </div>

        {!started ? (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 8 }}>
              Just write one paragraph.
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 8 }}>
              That&apos;s it. 10 minutes. One paragraph. You can do this.
            </p>
            {sectionTitle && (
              <p style={{ color: 'var(--color-sky)', fontSize: 13, marginBottom: 20 }}>
                Focus: {sectionTitle}
              </p>
            )}
            <button className="btn-primary" onClick={start} style={{ padding: '14px 40px', fontSize: 16 }}>
              Let&apos;s Go
            </button>
          </div>
        ) : (
          <>
            {/* Timer bar */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 4, background: 'var(--bg-input)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  background: timeUp ? 'var(--color-emerald)' : 'var(--color-amber)',
                  width: `${progress * 100}%`,
                  transition: 'width 1s linear',
                }} />
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 14,
                color: timeUp ? 'var(--color-emerald)' : secondsLeft < 60 ? 'var(--color-rose)' : 'var(--text-muted)',
              }}>
                {timeUp ? 'Done!' : formatTimer(secondsLeft)}
              </span>
            </div>

            <textarea
              ref={textareaRef}
              className="textarea"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Start writing... just one paragraph. Don't think, just type."
              style={{
                width: '100%', minHeight: 200, fontSize: 16, lineHeight: 1.8,
                resize: 'vertical', background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {wordCount} {wordCount === 1 ? 'word' : 'words'}
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                {isRunning ? (
                  <button className="btn-ghost" onClick={() => { if (intervalRef.current) clearInterval(intervalRef.current); setIsRunning(false); }}>
                    Pause
                  </button>
                ) : !timeUp ? (
                  <button className="btn-ghost" onClick={() => setIsRunning(true)}>Resume</button>
                ) : null}
                <button className="btn-primary" onClick={() => {
                  if (text.trim()) navigator.clipboard?.writeText(text).catch(() => {});
                  onClose();
                }}>
                  {text.trim() ? 'Copy & Close' : 'Close'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
