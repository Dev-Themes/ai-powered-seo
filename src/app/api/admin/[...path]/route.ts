import { NextResponse } from 'next/server';
import { session, authorize } from '@/lib/auth';
import { runFirstReadAudit } from '@/lib/firstread/audit';
import { generateFirstReadRecommendations } from '@/lib/firstread/ai';
import { getFirstReadGoogleStatus } from '@/lib/firstread/google-interfaces';
import { fetchSiteInfo, fetchPublishedPosts, fetchCategories } from '@/lib/firstread/client';
import {
  saveAuditReport,
  saveRecommendationsReport,
  listReports,
  getReportById,
  getLatestAuditReport,
  getLatestRecommendationsReport,
  getApprovals,
  setApproval
} from '@/lib/firstread/storage';
import { boundedJson } from '@/lib/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function formatError(e: unknown) {
  if (e instanceof Error && ['UNAUTHORIZED', 'FORBIDDEN'].includes(e.message)) {
    return NextResponse.json(
      { error: 'Unauthorised request.' },
      { status: e.message === 'UNAUTHORIZED' ? 401 : 403 }
    );
  }
  return NextResponse.json(
    { error: e instanceof Error ? e.message : 'Operation unavailable.' },
    { status: 500 }
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const s = await session();
    if (!s) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const p = (await params).path;
    let data: unknown;

    if (p[0] === 'session') {
      data = { csrf: s.csrf };
    } else if (p[0] === 'firstread' || p[0] === 'reports') {
      const sub = p[0] === 'reports' ? 'reports' : p[1];
      const param = p[0] === 'reports' ? p[1] : p[2];

      if (sub === 'posts') {
        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '10', 10)));
        const [postsData, categories] = await Promise.all([
          fetchPublishedPosts(page, perPage),
          fetchCategories().catch(() => [])
        ]);
        data = {
          ...postsData,
          page,
          perPage,
          categories
        };
      } else if (sub === 'info') {
        data = await fetchSiteInfo();
      } else if (sub === 'audit') {
        const latest = await getLatestAuditReport();
        data = latest || (await runFirstReadAudit(500));
      } else if (sub === 'recommend') {
        const latest = await getLatestRecommendationsReport();
        if (latest) {
          data = latest;
        } else {
          const audit = (await getLatestAuditReport()) || (await runFirstReadAudit(500));
          data = await generateFirstReadRecommendations(audit);
        }
      } else if (sub === 'reports' && param) {
        data = await getReportById(param);
        if (!data) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      } else if (sub === 'reports') {
        data = await listReports();
      } else if (sub === 'approvals') {
        data = { approvedIds: await getApprovals() };
      } else if (sub === 'google') {
        data = getFirstReadGoogleStatus();
      } else {
        data = await fetchSiteInfo();
      }
    } else {
      return NextResponse.json({ error: 'Endpoint not found or legacy route removed' }, { status: 404 });
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, no-store' }
    });
  } catch (e) {
    return formatError(e);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    await authorize(request);
    const p = (await params).path;

    if (p[0] === 'firstread') {
      const action = p[1];

      if (action === 'audit') {
        const audit = await runFirstReadAudit(500);
        const stored = await saveAuditReport(audit);
        return NextResponse.json(stored);
      }

      if (action === 'recommend') {
        const audit = (await getLatestAuditReport()) || (await runFirstReadAudit(500));
        const recs = await generateFirstReadRecommendations(audit);
        const stored = await saveRecommendationsReport(recs);
        return NextResponse.json(stored);
      }

      if (action === 'approve') {
        const body = (await boundedJson(request)) as { id: string; approved: boolean };
        if (!body.id || typeof body.approved !== 'boolean') {
          return NextResponse.json({ error: 'Invalid approval payload' }, { status: 400 });
        }
        const updated = await setApproval(body.id, body.approved);
        return NextResponse.json({
          ok: true,
          approvedIds: updated,
          note: 'Approval status saved internally. No changes made to FirstRead.'
        });
      }

      // Any other action targeting firstread is forbidden
      return NextResponse.json(
        { error: 'Forbidden. Write operations to FirstRead are permanently blocked.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Legacy publishing and write operations have been safely removed.' },
      { status: 404 }
    );
  } catch (e) {
    return formatError(e);
  }
}
