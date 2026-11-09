import { notFound } from 'next/navigation';
import { AdminPanel } from '@/components/admin/panel';

export default async function Section({
  params
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!['overview', 'posts', 'homepage', 'articles', 'technical', 'recommendations', 'history', 'google', 'settings'].includes(section)) {
    notFound();
  }
  return <AdminPanel section={section} />;
}
