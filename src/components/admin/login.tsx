'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Login({ ready, initialError = '' }: { ready: boolean; initialError?: string }) {
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  return (
    <form
      className="login-card"
      method="post"
      action="/api/auth"
      onSubmit={async e => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const f = new FormData(e.currentTarget);
        try {
          const r = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: f.get('username'),
              password: f.get('password')
            })
          });
          const data = await r.json();
          if (!r.ok) throw new Error(data.error);
          router.push('/admin');
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Sign-in failed.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="eyebrow">FIRSTREAD SEO MONITOR · PRIVATE</span>
      <h1>FirstRead Dashboard</h1>
      <p>Sign in to monitor live WordPress SEO performance, audit health, and review AI recommendations.</p>
      {!ready && (
        <div className="notice">
          Admin access is not configured. Please ensure ADMIN_USERNAME and ADMIN_PASSWORD_HASH are defined in your environment.
        </div>
      )}
      <div className="field">
        <label htmlFor="username">Username</label>
        <input id="username" name="username" autoComplete="username" required maxLength={100} />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            maxLength={256}
            style={{ paddingRight: '42px' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px'
            }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      <Button disabled={!ready || busy} type="submit">
        {busy ? 'Signing in…' : 'Sign in securely →'}
      </Button>
    </form>
  );
}