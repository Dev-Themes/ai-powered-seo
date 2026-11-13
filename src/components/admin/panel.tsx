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
            variant="ghost"
            size="sm"
            aria-label="Sign out"
            onClick={async () => {
              try {
                const s = await api('session');
                await fetch('/api/auth', {
                  method: 'DELETE',
                  headers: { 'x-csrf-token': s.csrf }
                });
                router.push('/admin/login');
                router.refresh();
              } catch {
                setError('Unable to sign out. Try again.');
              }
            }}
          >
            <LogOut size={16} />
          </Button>
        </div>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      <FirstReadPanel initialSection={section} />
    </>
  );
}
