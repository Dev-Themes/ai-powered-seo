'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShieldCheck,
  Globe,
  FileText,
  Sparkles,
  History,
  SearchCheck,
  Settings
} from 'lucide-react';

const links = [
  ['', 'Overview', LayoutDashboard],
  ['technical', 'Technical SEO', ShieldCheck],
  ['homepage', 'Homepage SEO', Globe],
  ['articles', 'Article SEO', FileText],
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
