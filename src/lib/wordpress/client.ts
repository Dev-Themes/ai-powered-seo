import { validateReadOnlyRequest } from './security';
import type {
  WordPressPost,
  WordPressPage,
  WordPressCategory,
  WordPressTag,
  SiteInfo
} from './types';

// In-memory cache with 5-minute TTL to avoid excessive load on FirstRead
interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 5 * 60 * 1000;

// Politeness rate limiter: minimum 200ms between calls
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 200;

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Performs a verified read-only GET request to FirstRead.
 * Guaranteed to never mutate FirstRead.
 */
export async function readOnlyFetch(
  endpointOrUrl: string,
  options?: { bypassCache?: boolean; signal?: AbortSignal }
): Promise<Response> {
  // Validate request security and read-only policy
  const validatedUrl = validateReadOnlyRequest(endpointOrUrl, { method: 'GET' });

  await throttle();

  const headers: Record<string, string> = {
    'User-Agent': 'FirstRead-Autonomous-SEO-Engine/1.0 (read-only owner-authorised monitoring; +https://firstread.co.uk)',
    'Accept': 'application/json, text/html, application/xml, text/plain, */*'
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let currentUrl = validatedUrl;
      let redirectHops = 0;
      const MAX_REDIRECTS = 3;

      while (true) {
        const response = await fetch(currentUrl.toString(), {
          method: 'GET',
          headers,
          redirect: 'manual', // Never follow redirects blindly; validate every hop
          signal: options?.signal || AbortSignal.timeout(15000),
          cache: 'no-store'
        });

        // If redirect returned, strictly validate redirect destination against security allowlist
        if ([301, 302, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          if (!location) return response;

          redirectHops++;
          if (redirectHops > MAX_REDIRECTS) {
            throw new Error(`Exceeded maximum allowed redirect hops (${MAX_REDIRECTS}).`);
          }

          // Validate target URL against strict read-only security allowlist (fails closed on unapproved endpoints)
          const targetUrl = new URL(location, currentUrl);
          currentUrl = validateReadOnlyRequest(targetUrl, { method: 'GET' });
          continue;
        }

        if (response.status === 429 || (response.status >= 500 && response.status <= 504)) {
          if (attempt === 2) return response;
          // Exponential backoff for rate limits or server errors
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          break;
        }

        return response;
      }
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }

  throw new Error(`Failed to fetch from ${validatedUrl.toString()} after retries.`);
}

/**
 * Cached JSON helper
 */
async function fetchCachedJson<T>(endpoint: string, bypassCache = false): Promise<T> {
  const cacheKey = endpoint;
  if (!bypassCache) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.data as T;
    }
  }

  const res = await readOnlyFetch(endpoint);
  if (!res.ok) {
    throw new Error(`WordPress request to ${endpoint} failed with HTTP ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as T;
  cache.set(cacheKey, { data, cachedAt: Date.now() });
  return data;
}

/**
 * Fetches general site info from /wp-json/ and calculates totals
 */
export async function fetchSiteInfo(bypassCache = false): Promise<SiteInfo> {
  const root = await fetchCachedJson<{
    name: string;
    description: string;
    url: string;
    home: string;
    gmt_offset: string;
    timezone_string: string;
  }>('/wp-json/', bypassCache);

  // Check headers for total counts
  const postsHead = await readOnlyFetch('/wp-json/wp/v2/posts?per_page=1');
  const pagesHead = await readOnlyFetch('/wp-json/wp/v2/pages?per_page=1');
  const catsHead = await readOnlyFetch('/wp-json/wp/v2/categories?per_page=1');
  const tagsHead = await readOnlyFetch('/wp-json/wp/v2/tags?per_page=1');

  const totalPosts = Number(postsHead.headers.get('x-wp-total') || 0);
  const totalPages = Number(pagesHead.headers.get('x-wp-total') || 0);
  const totalCategories = Number(catsHead.headers.get('x-wp-total') || 0);
  const totalTags = Number(tagsHead.headers.get('x-wp-total') || 0);

  const serverHeader = postsHead.headers.get('server') || 'LiteSpeed';
  const xPoweredBy = postsHead.headers.get('x-powered-by') || 'PHP/WordPress';

  return {
    name: root.name || 'Firstread',
    description: root.description || '',
    url: root.url || 'http://firstread.co.uk',
    home: root.home || 'https://firstread.co.uk',
    gmt_offset: root.gmt_offset || '0',
    timezone_string: root.timezone_string || '',
    totalPosts,
    totalPages,
    totalCategories,
    totalTags,
    serverEngine: `${serverHeader} (${xPoweredBy})`,
    seoPlugin: 'Yoast SEO (active)'
  };
}

/**
 * Fetches a paginated page of published posts
 */
export async function fetchPublishedPosts(page = 1, perPage = 20): Promise<{
  posts: WordPressPost[];
  totalPosts: number;
  totalPages: number;
}> {
  const endpoint = `/wp-json/wp/v2/posts?status=publish&page=${page}&per_page=${perPage}&_fields=id,date,modified,slug,status,type,link,title,content,excerpt,author,featured_media,categories,tags,yoast_head,yoast_head_json`;
  const res = await readOnlyFetch(endpoint);
  
  if (!res.ok) {
    throw new Error(`Failed to fetch posts: HTTP ${res.status}`);
  }

  const totalPosts = Number(res.headers.get('x-wp-total') || 0);
  const totalPages = Number(res.headers.get('x-wp-totalpages') || 1);
  const posts = (await res.json()) as WordPressPost[];

  return { posts, totalPosts, totalPages };
}

/**
 * Fetches published posts up to a maximum number (for comprehensive audit)
 */
export async function fetchAllPosts(maxPosts = 500): Promise<WordPressPost[]> {
  const all: WordPressPost[] = [];
  const perPage = Math.min(maxPosts, 50);
  let page = 1;

  while (all.length < maxPosts) {
    const { posts, totalPages } = await fetchPublishedPosts(page, perPage);
    all.push(...posts);
    if (page >= totalPages || posts.length === 0) break;
    page++;
  }

  return all.slice(0, maxPosts);
}

/**
 * Fetches public pages
 */
export async function fetchPublicPages(): Promise<WordPressPage[]> {
  const endpoint = '/wp-json/wp/v2/pages?status=publish&per_page=50&_fields=id,date,modified,slug,status,link,title,content,yoast_head_json';
  const pages = await fetchCachedJson<WordPressPage[]>(endpoint);
  return pages;
}

/**
 * Fetches public categories
 */
export async function fetchCategories(): Promise<WordPressCategory[]> {
  return fetchCachedJson<WordPressCategory[]>('/wp-json/wp/v2/categories?per_page=100');
}

/**
 * Fetches public tags
 */
export async function fetchTags(): Promise<WordPressTag[]> {
  return fetchCachedJson<WordPressTag[]>('/wp-json/wp/v2/tags?per_page=100');
}

/**
 * Fetches robots.txt text
 */
export async function fetchRobotsTxt(): Promise<string> {
  const res = await readOnlyFetch('/robots.txt');
  if (!res.ok) throw new Error(`Robots.txt unavailable: HTTP ${res.status}`);
  return res.text();
}

/**
 * Fetches sitemap XML content
 */
export async function fetchSitemapXml(sitemapPath = '/sitemap_index.xml'): Promise<string> {
  const res = await readOnlyFetch(sitemapPath);
  if (!res.ok) throw new Error(`Sitemap unavailable: HTTP ${res.status}`);
  return res.text();
}

/**
 * Fetches public rendered HTML of a page on FirstRead for deep head tag inspection
 */
export async function fetchRenderedHtml(pathOrUrl = '/'): Promise<string> {
  const res = await readOnlyFetch(pathOrUrl);
  if (!res.ok) throw new Error(`Rendered HTML unavailable for ${pathOrUrl}: HTTP ${res.status}`);
  return res.text();
}
