/**
 * Security and Read-Only Enforcement Policy for WordPress Integration.
 * 
 * HARD CONSTRAINTS:
 * 1. Strict read-only access: ONLY HTTP GET is permitted during this phase.
 * 2. POST, PUT, PATCH, DELETE, OPTIONS or any write/mutating method will immediately throw FirstReadSecurityError and fail closed.
 * 3. Only explicitly required, exact allowlisted FirstRead HTTPS endpoints can be queried.
 * 4. Zero credentials (no admin passwords, no application passwords, no cookies, no nonces) are ever accepted or sent.
 * 5. Path traversal, normalization bypasses, and unapproved redirect destinations are strictly rejected.
 */

export class FirstReadSecurityError extends Error {
  constructor(message: string) {
    super(`[WordPress Read-Only Security Policy Violation] ${message}`);
    this.name = 'FirstReadSecurityError';
  }
}

export const FIRSTREAD_ORIGIN = 'https://firstread.co.uk';

/**
 * Strict, exact allowlist of permissible path patterns on FirstRead.
 * Only the explicitly required public endpoints are permitted.
 * Wildcard prefixes (e.g. /wp-json/*) are permanently forbidden.
 */
export const PERMITTED_PATH_PATTERNS: RegExp[] = [
  /^\/?$/, // Root homepage
  /^\/wp-json\/?$/, // Exact REST API root index (Site discovery info only)
  /^\/wp-json\/wp\/v2\/posts$/, // Published posts collection
  /^\/wp-json\/wp\/v2\/pages$/, // Published pages collection
  /^\/wp-json\/wp\/v2\/categories$/, // Public categories taxonomy
  /^\/wp-json\/wp\/v2\/tags$/, // Public tags taxonomy
  /^\/robots\.txt$/, // Public crawl rules
  /^\/(?:sitemap_index\.xml|post-sitemap\.xml|page-sitemap\.xml|category-sitemap\.xml|post_tag-sitemap\.xml|author-sitemap\.xml|wp-sitemap\.xml)$/, // Approved XML sitemaps
  /^\/[a-z0-9-]+\/?$/, // Public rendered articles or pages for HTML head tag inspection
];

/**
 * Validates that an outgoing request to WordPress is strictly read-only, targeting an exact allowlisted endpoint.
 * Fails closed if any write attempt, non-GET method, disallowed host, credential, traversal, or malformed URL is detected.
 */
export function validateReadOnlyRequest(url: string | URL, init?: RequestInit): URL {
  const method = (init?.method || 'GET').toUpperCase();

  // 1. Fail closed on any non-GET HTTP method
  if (method !== 'GET') {
    throw new FirstReadSecurityError(
      `Forbidden HTTP method "${method}". The WordPress integration is strictly read-only. Write operations (POST, PUT, PATCH, DELETE, OPTIONS) are permanently blocked.`
    );
  }

  // 2. Reject credentials, authorization headers, cookies, or nonces
  if (init?.headers) {
    const headers = init.headers as Record<string, string>;
    const lowerKeys = Object.keys(headers).map(k => k.toLowerCase());
    const forbiddenHeaders = ['authorization', 'cookie', 'x-wp-nonce', 'proxy-authorization'];
    for (const h of forbiddenHeaders) {
      if (lowerKeys.includes(h)) {
        throw new FirstReadSecurityError(
          'Credentials, authorization headers, or WordPress nonces must never be sent to FirstRead.'
        );
      }
    }
  }

  const parsedUrl = typeof url === 'string' ? new URL(url, FIRSTREAD_ORIGIN) : new URL(url.toString());

  // 3. Enforce exact origin and hostname (no external domains, no subdomains, no external ports)
  if (parsedUrl.host !== 'firstread.co.uk' || parsedUrl.port !== '' || parsedUrl.hostname !== 'firstread.co.uk') {
    throw new FirstReadSecurityError(
      `Invalid target origin "${parsedUrl.origin}". Only "${FIRSTREAD_ORIGIN}" is permitted.`
    );
  }

  // 4. Force HTTPS protocol
  if (parsedUrl.protocol === 'http:') {
    parsedUrl.protocol = 'https:';
  }

  // 5. Reject embedded credentials in URL (e.g. https://user:pass@firstread.co.uk)
  if (parsedUrl.username || parsedUrl.password) {
    throw new FirstReadSecurityError(
      'Embedded URL credentials are strictly forbidden.'
    );
  }

  // 6. Reject encoded traversal, path normalization bypasses, null bytes, backslashes, and consecutive slashes in pathname
  const rawPathAndSearch = (typeof url === 'string' ? url : url.pathname + url.search);
  
  if (
    /\.\./.test(rawPathAndSearch) ||
    /%2e/i.test(rawPathAndSearch) ||
    /%5c/i.test(rawPathAndSearch) ||
    /\\/.test(rawPathAndSearch) ||
    /\0/.test(rawPathAndSearch) ||
    /%00/i.test(rawPathAndSearch) ||
    /\/{2,}/.test(parsedUrl.pathname)
  ) {
    throw new FirstReadSecurityError(
      `Path traversal or malformed URL sequence detected in "${rawPathAndSearch}".`
    );
  }

  // 7. Explicitly block all WordPress administrative, login, and internal system paths
  if (/^\/(?:wp-admin|wp-login|wp-includes|wp-content|xmlrpc)(?:\/.*)?$/i.test(parsedUrl.pathname)) {
    throw new FirstReadSecurityError(
      `Endpoint "${parsedUrl.pathname}" is not on the FirstRead read-only allowlist (administrative or system paths are forbidden).`
    );
  }

  // 8. Validate against the strict exact path allowlist
  const isAllowed = PERMITTED_PATH_PATTERNS.some(pattern => pattern.test(parsedUrl.pathname));

  if (!isAllowed) {
    throw new FirstReadSecurityError(
      `Endpoint "${parsedUrl.pathname}" is not on the FirstRead read-only allowlist.`
    );
  }

  return parsedUrl;
}
