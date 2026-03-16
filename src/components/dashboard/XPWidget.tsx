'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { getUserXP, getLevelFromXP, getXPForNextLevel, getXPForCurrentLevel } from '@/lib/db';
import type { UserXP } from '@/types';

const ACHIEVEMENTS: Record<string, { name: string; desc: string; icon: string }> = {
  first_task: { name: 'First Steps', desc: 'Complete your first task', icon: '🌱' },
  ten_tasks: { name: 'Getting Started', desc: 'Complete 10 tasks', icon: '🔥' },
  fifty_tasks: { name: 'Momentum', desc: 'Complete 50 tasks', icon: '⚡' },
  hundred_tasks: { name: 'Centurion', desc: 'Complete 100 tasks', icon: '💯' },
  first_routine: { name: 'Routine Builder', desc: 'Complete a routine', icon: '🔄' },
  ten_routines: { name: 'Creature of Habit', desc: 'Complete 10 routines', icon: '🏗️' },
  first_pomodoro: { name: 'Tomato Timer', desc: 'Complete a pomodoro', icon: '🍅' },
  twenty_pomodoros: { name: 'Focus Machine', desc: 'Complete 20 pomodoros', icon: '🎯' },
  streak_3: { name: '3-Day Streak', desc: '3 days in a row', icon: '🔥' },
  streak_7: { name: 'Week Warrior', desc: '7-day streak', icon: '⭐' },
  streak_30: { name: 'Monthly Master', desc: '30-day streak', icon: '👑' },
  level_5: { name: 'Level Up', desc: 'Reach level 5', icon: '🏆' },
  level_10: { name: 'Double Digits', desc: 'Reach level 10', icon: '💎' },
  zero_inbox: { name: 'Inbox Zero', desc: 'Clear your inbox', icon: '📭' },
  weekly_review: { name: 'Reflector', desc: 'Complete a weekly review', icon: '📋' },
};

export default function XPWidget() {
  const { refreshKey } = useApp();
  const [xp, setXP] = useState<UserXP | null>(null);

  useEffect(() => {
    getUserXP().then(setXP);
  }, [refreshKey]);

  if (!xp) return null;

  const level = xp.level;
  const currentLevelXP = getXPForCurrentLevel(level);
  const nextLevelXP = getXPForNextLevel(level);
  const levelProgress = nextLevelXP > currentLevelXP
    ? ((xp.totalXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100
    : 100;

  const recentAchievements = xp.achievements.slice(-3).reverse();

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>Level {level}</h3>
        <span style={{
          fontSize: 13, fontWeight: 600, color: 'var(--color-accent)',
          fontFamily: 'var(--font-mono)',
        }}>
          {xp.totalXP} XP
        </span>
      </div>

      {/* XP Progress bar */}
      <div style={{ marginBottom: 14 }}>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{
            width: `${Math.min(100, levelProgress)}%`,
            background: 'linear-gradient(90deg, var(--color-accent), var(--color-amber))',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          <span>Lvl {level}</span>
          <span>{nextLevelXP - xp.totalXP} XP to level {level + 1}</span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
        marginBottom: recentAchievements.length > 0 ? 14 : 0,
      }}>
        <div style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{xp.tasksCompleted}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>tasks</div>
        </div>
        <div style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{xp.currentStreak}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>streak</div>
        </div>
        <div style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{Math.round(xp.focusMinutes)}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>focus min</div>
        </div>
      </div>

      {/* Recent achievements */}
      {recentAchievements.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Achievements
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {recentAchievements.map(id => {
              const ach = ACHIEVEMENTS[id];
              if (!ach) return null;
              return (
                <div key={id} title={`${ach.name}: ${ach.desc}`} style={{
                  padding: '4px 10px', background: 'var(--color-amber-light)',
                  borderRadius: 'var(--radius-full)', fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span>{ach.icon}</span>
                  <span style={{ fontWeight: 500, color: 'var(--color-amber)' }}>{ach.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export { ACHIEVEMENTS };
