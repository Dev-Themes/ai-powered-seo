'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { api } from './api';
import { Button } from '@/components/ui/button';
import { FirstReadPanel } from './firstread-panel';

const titles: Record<string, string> = {
  overview: 'Autonomous AI SEO engine focused on brand keyword "firstread".',
  brand: 'Autonomous AI SEO engine focused on brand keyword "firstread".',
  history: 'Autonomous cron execution history & permanent snapshot reports.',
  google: 'Google Search Console, GA4 & Web Search Indexing API readiness.'
};

export function AdminPanel({ section }: { section: string }) {
  const [error, setError] = useState('');
  const router = useRouter();

  const title = titles[section] || 'FirstRead Autonomous AI SEO platform.';

  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">FIRSTREAD AI SEO / {section.toUpperCase()}</span>
          <h1>{title}</h1>
          <p>Autonomous engine monitoring live WordPress target: https://firstread.co.uk</p>
        </div>
        <div className="editor-actions">
          <Button
            variant="outline"
            size="sm"
            aria-label="Exit"
            className="text-xs h-8 px-3 gap-1.5 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
            onClick={async () => {
              try {
                let csrf = '';
                try {
                  const s = await api('session');
                  csrf = s?.csrf || '';
                } catch {}
                await fetch('/api/auth', {
                  method: 'DELETE',
                  headers: csrf ? { 'x-csrf-token': csrf } : {}
                });
              } catch (err) {
                console.error('Logout error:', err);
              }
              // Unconditionally redirect back to login page
              window.location.href = '/admin/login';
            }}
          >
            <LogOut size={14} />
            <span>Exit</span>
          </Button>
        </div>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      <FirstReadPanel initialSection={section} />
    </>
  );
}
