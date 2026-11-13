'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Zap,
  History,
  SlidersHorizontal
} from 'lucide-react';

const links = [
  ['', 'Autonomous Engine', Zap],
  ['history', 'Cron Job History', History],
  ['google', 'Google Integrations', SlidersHorizontal]
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <aside className="admin-nav">
      <span className="eyebrow">AUTONOMOUS SEO</span>
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
