'use client';

import DashboardV2 from '@/dashboard-v2/dashboard-view';
import { FirstReadPanel } from './firstread-panel';

export function AdminPanel({ section }: { section: string }) {
  if (section === 'history') {
    return <DashboardV2 initialTab="history" />;
  }
  if (section === 'overview' || section === 'brand') {
    return <DashboardV2 initialTab="overview" />;
  }
  return <FirstReadPanel initialSection={section} />;
}
