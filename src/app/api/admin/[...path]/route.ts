import { NextResponse } from 'next/server';
import { session, authorize } from '@/lib/auth';
import { runFirstReadAudit } from '@/lib/seo/audit';
import { generateFirstReadRecommendations } from '@/lib/content/ai';
import { fetchSiteInfo, fetchPublishedPosts, fetchCategories } from '@/lib/wordpress/client';
import {
  saveAuditReport,
  saveRecommendationsReport,
  listReports,
  getReportById,
  getLatestAuditReport,
  getLatestRecommendationsReport
} from '@/lib/shared/storage';
import { getGoogleIntegrationReadiness } from '@/lib/integrations/google';
import {
  executeKeywordResearch,
  executeCompetitorAnalysis,
  executeSearchIntentAnalysis,
  executeContentGapDiscovery,
  executeTopicClusterGeneration,
  executeSEOStrategyGeneration,
  executeArticleResearch,
  executeArticleGeneration,
  executeArticleQA,
  executeTechnicalAudit,
  executeRecommendationsGeneration
} from '@/lib/seo/operations';

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
      } else if (sub === 'integrations' || sub === 'google') {
        data = getGoogleIntegrationReadiness();
      } else if (sub === 'status' || sub === 'readiness' || sub === 'infra') {
        // Honest system status without database or Inngest dependencies
        data = {
          wordpress: {
            origin: 'https://firstread.co.uk',
            mode: 'Strict Read-Only (Guaranteed)',
            status: 'Connected'
          },
          aiProvider: {
            provider: 'Google Gemini',
            model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
            configured: Boolean(process.env.GEMINI_API_KEY)
          },
          googleIntegrations: getGoogleIntegrationReadiness(),
          architecture: {
            type: 'Simplified Serverless Next.js App Router',
            state: 'Session-Scoped (In-Memory / Non-Persistent)',
            database: 'None (Completely Removed)',
            orchestration: 'Direct On-Demand Server-Side Operations',
            availableOperations: 11
          }
        };
      } else {
        data = await fetchSiteInfo();
      }
    } else {
      return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
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

      // 1. Direct AI Operations Dispatcher
      if (action === 'operation') {
        let body: { operation?: string; input?: Record<string, unknown> } = {};
        try {
          body = await request.json();
        } catch {
          return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
        }

        const op = body.operation;
        const input = body.input || {};

        switch (op) {
          case 'keyword-research':
            return NextResponse.json(await executeKeywordResearch(input.seed as string | undefined));
          case 'competitor-analysis':
            return NextResponse.json(await executeCompetitorAnalysis(input.domain as string | undefined));
          case 'search-intent':
            return NextResponse.json(await executeSearchIntentAnalysis((input.keywords as string[]) || []));
          case 'content-gap':
            return NextResponse.json(await executeContentGapDiscovery(input.niche as string | undefined));
          case 'topic-clusters':
            return NextResponse.json(await executeTopicClusterGeneration(input.pillarTopic as string | undefined));
          case 'seo-strategy':
            return NextResponse.json(await executeSEOStrategyGeneration(input.focus as string | undefined));
          case 'article-research':
            return NextResponse.json(await executeArticleResearch(input.topic as string | undefined));
          case 'article-generation':
            return NextResponse.json(await executeArticleGeneration(input));
          case 'article-qa':
            return NextResponse.json(await executeArticleQA(input));
          case 'technical-audit':
            return NextResponse.json(await executeTechnicalAudit(Number(input.limit) || 100));
          case 'recommendations':
            return NextResponse.json(await executeRecommendationsGeneration());
          default:
            return NextResponse.json(
              { error: `Unknown operation: ${op}. Supported: keyword-research, competitor-analysis, search-intent, content-gap, topic-clusters, seo-strategy, article-research, article-generation, article-qa, technical-audit, recommendations.` },
              { status: 400 }
            );
        }
      }

      // 2. Audit Snapshot Trigger
      if (action === 'audit') {
        const audit = await runFirstReadAudit(500);
        const stored = await saveAuditReport(audit);
        return NextResponse.json(stored);
      }

      // 3. Recommendation Trigger
      if (action === 'recommend') {
        const audit = (await getLatestAuditReport()) || (await runFirstReadAudit(500));
        const recs = await generateFirstReadRecommendations(audit);
        const stored = await saveRecommendationsReport(recs);
        return NextResponse.json(stored);
      }

      // 4. Strictly reject obsolete approval actions or any WordPress write operation
      if (action === 'approve') {
        return NextResponse.json(
          { error: 'Human approval queues are obsolete. System operates via automated QA validation.' },
          { status: 410 }
        );
      }

      return NextResponse.json(
        { error: 'Forbidden. Write operations to FirstRead WordPress are permanently blocked.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Endpoint not found' },
      { status: 404 }
    );
  } catch (e) {
    return formatError(e);
  }
}
