'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { api } from './api';
import { Button } from '@/components/ui/button';
import { FirstReadPanel } from './firstread-panel';

const titles: Record<string, string> = {
  overview: 'Autonomous AI SEO engine & site vitals.',
  strategy: 'Keyword opportunities, cannibalisation checks & internal linking graph.',
  content: 'Content production, headline refinement & automated QA gates.',
  posts: 'Browse live published articles from FirstRead WordPress.',
  technical: 'Robots.txt, XML Sitemaps, protocols & schema validation.',
  history: 'Historical audit runs & monitoring snapshots.',
  settings: 'Autonomous platform configuration & security controls.',
  // Backward compatibility aliases
  homepage: 'Homepage SEO & semantic heading hierarchy.',
  articles: 'Article-level SEO audit & content metrics.',
  recommendations: 'AI-assisted SEO proposals & content opportunities.',
  google: 'Google Search Console & GA4 readiness status.'
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
