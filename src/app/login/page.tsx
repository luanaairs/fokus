'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Wrong password');
      setLoading(false);
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-app)',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
        textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'var(--color-accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: 26,
          fontFamily: 'var(--font-display)',
          margin: '0 auto 20px',
          boxShadow: '0 4px 16px rgba(224,122,95,0.3)',
        }}>
          f
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 32,
          marginBottom: 6,
        }}>
          fokus
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 32 }}>
          Enter your password to continue
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            style={{ textAlign: 'center', fontSize: 16, padding: '14px 20px' }}
          />
          {error && (
            <div style={{
              color: 'var(--color-rose)',
              fontSize: 13,
              padding: '8px 12px',
              background: 'var(--color-rose-light)',
              borderRadius: 'var(--radius-sm)',
            }}>
              {error}
            </div>
          )}
          <button
            className="btn-primary"
            type="submit"
            disabled={loading || !password}
            style={{ padding: '14px 20px', fontSize: 15, width: '100%' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
