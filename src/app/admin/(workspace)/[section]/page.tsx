import { notFound } from 'next/navigation';
import { AdminPanel } from '@/components/admin/panel';

export default async function Section({
  params
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!['overview', 'technical', 'homepage', 'articles', 'recommendations', 'history', 'google', 'settings'].includes(section)) {
    notFound();
  }
  return <AdminPanel section={section} />;
}
