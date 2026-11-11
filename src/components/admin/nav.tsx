'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Target,
  FileEdit,
  BookOpen,
  ShieldCheck,
  History,
  Settings
} from 'lucide-react';

const links = [
  ['', 'Overview & Agents', LayoutDashboard],
  ['strategy', 'SEO Strategy', Target],
  ['content', 'Content & QA', FileEdit],
  ['posts', 'WordPress Articles', BookOpen],
  ['technical', 'Technical Health', ShieldCheck],
  ['history', 'Audit History', History],
  ['settings', 'Settings & Security', Settings]
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <aside className="admin-nav">
      <span className="eyebrow">FIRSTREAD AI SEO</span>
      {links.map(([slug, label, Icon]) => {
        const href = '/admin' + (slug ? '/' + slug : '');
        const isActive = path === href;
        return (
          <Link
            key={slug}
            href={href}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </aside>
  );
}
