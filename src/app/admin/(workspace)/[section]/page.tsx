import { notFound } from 'next/navigation';
import { AdminPanel } from '@/components/admin/panel';

const VALID_SECTIONS = [
  'overview',
  'strategy',
  'content',
  'posts',
  'technical',
  'history',
  'settings',
  // Backward compatibility aliases
  'homepage',
  'articles',
  'recommendations',
  'google'
];

export default async function Section({
  params
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!VALID_SECTIONS.includes(section)) {
    notFound();
  }
  return <AdminPanel section={section} />;
}
