'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTimerReturn {
  secondsLeft: number;
  isRunning: boolean;
  start: (durationSeconds: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  progress: number;
}

export function useTimer(onComplete?: () => void): UseTimerReturn {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [totalDuration, setTotalDuration] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback((durationSeconds: number) => {
    clearTimer();
    setTotalDuration(durationSeconds);
    setSecondsLeft(durationSeconds);
    setIsRunning(true);
  }, [clearTimer]);

  const pause = useCallback(() => {
    clearTimer();
    setIsRunning(false);
  }, [clearTimer]);

  const resume = useCallback(() => {
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    setIsRunning(false);
    setSecondsLeft(0);
    setTotalDuration(0);
  }, [clearTimer]);

  useEffect(() => {
    if (!isRunning || secondsLeft <= 0) {
      clearTimer();
      if (isRunning && secondsLeft <= 0 && totalDuration > 0) {
        setIsRunning(false);
        onCompleteRef.current?.();
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return clearTimer;
  }, [isRunning, secondsLeft, totalDuration, clearTimer]);

  const progress = totalDuration > 0 ? ((totalDuration - secondsLeft) / totalDuration) * 100 : 0;

  return { secondsLeft, isRunning, start, pause, resume, stop, progress };
}
