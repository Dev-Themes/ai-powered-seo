'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  Globe,
  FileText,
  ShieldCheck,
  Sparkles,
  History,
  SearchCheck,
  Settings
} from 'lucide-react';

const links = [
  ['', 'Overview', LayoutDashboard],
  ['posts', 'WordPress Articles', BookOpen],
  ['homepage', 'Homepage SEO', Globe],
  ['articles', 'Articles SEO', FileText],
  ['technical', 'Technical SEO', ShieldCheck],
  ['recommendations', 'AI Recommendations', Sparkles],
  ['history', 'Audit History', History],
  ['google', 'Google Integrations', SearchCheck],
  ['settings', 'Settings', Settings]
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <aside className="admin-nav">
      <span className="eyebrow">FIRSTREAD SEO MONITOR</span>
      {links.map(([slug, label, Icon]) => (
        <Link
          key={slug}
          href={'/admin' + (slug ? '/' + slug : '')}
          aria-current={path === '/admin' + (slug ? '/' + slug : '') ? 'page' : undefined}
        >
          <Icon size={16} />
          {label}
        </Link>
      ))}
    </aside>
  );
}
