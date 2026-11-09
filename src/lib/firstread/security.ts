/**
 * Security and Read-Only Enforcement Policy for FirstRead Integration.
 * 
 * HARD CONSTRAINTS:
 * 1. Strict read-only access: ONLY HTTP GET is permitted.
 * 2. POST, PUT, PATCH, DELETE or any write method will immediately throw FirstReadSecurityError and fail closed.
 * 3. Only allowlisted FirstRead HTTPS endpoints can be queried.
 * 4. Zero credentials (no admin passwords, no application passwords, no cookies) are ever accepted or sent.
 */

export class FirstReadSecurityError extends Error {
  constructor(message: string) {
    super(`[FirstRead Read-Only Security Policy Violation] ${message}`);
    this.name = 'FirstReadSecurityError';
  }
}

export const FIRSTREAD_ORIGIN = 'https://firstread.co.uk';

/**
 * Explicit allowlist of permissible path patterns on FirstRead.
 * All queries must match one of these regex patterns.
 */
export const PERMITTED_PATH_PATTERNS: RegExp[] = [
  /^\/wp-json\/?$/,
  /^\/wp-json\/wp\/v2\/?$/,
  /^\/wp-json\/wp\/v2\/posts(?:\?.*)?$/,
  /^\/wp-json\/wp\/v2\/pages(?:\?.*)?$/,
  /^\/wp-json\/wp\/v2\/categories(?:\?.*)?$/,
  /^\/wp-json\/wp\/v2\/tags(?:\?.*)?$/,
  /^\/robots\.txt$/,
  /^\/(?:sitemap_index\.xml|post-sitemap\.xml|page-sitemap\.xml|category-sitemap\.xml|wp-sitemap\.xml)$/,
  /^\/[a-z0-9-]+\/?$/, // Public rendered articles or pages for HTML head tag inspection
];

/**
 * Validates that an outgoing request to FirstRead is strictly read-only and targets an allowlisted endpoint.
 * Fails closed if any write attempt, non-GET method, disallowed host, or credentials are detected.
 */
export function validateReadOnlyRequest(url: string | URL, init?: RequestInit): URL {
  const method = (init?.method || 'GET').toUpperCase();

  // Fail closed if any method other than GET is requested
  if (method !== 'GET') {
    throw new FirstReadSecurityError(
      `Forbidden HTTP method "${method}". The FirstRead integration is strictly read-only. Write operations (POST, PUT, PATCH, DELETE) are permanently blocked.`
    );
  }

  // Check for unauthorized mutating headers or credentials
  if (init?.headers) {
    const headers = init.headers as Record<string, string>;
    const lowerKeys = Object.keys(headers).map(k => k.toLowerCase());
    if (lowerKeys.includes('authorization') || lowerKeys.includes('cookie') || lowerKeys.includes('x-wp-nonce')) {
      throw new FirstReadSecurityError(
        'Credentials, authorization headers, or WordPress nonces must never be sent to FirstRead.'
      );
    }
  }

  const parsedUrl = typeof url === 'string' ? new URL(url, FIRSTREAD_ORIGIN) : url;

  // Enforce HTTPS and target origin
  if (parsedUrl.origin !== FIRSTREAD_ORIGIN && parsedUrl.origin !== 'http://firstread.co.uk') {
    throw new FirstReadSecurityError(
      `Invalid target origin "${parsedUrl.origin}". Only "${FIRSTREAD_ORIGIN}" is permitted.`
    );
  }

  // Force HTTPS if protocol was specified as HTTP
  if (parsedUrl.protocol === 'http:') {
    parsedUrl.protocol = 'https:';
  }

  // Validate against path allowlist
  const pathWithSearch = parsedUrl.pathname + parsedUrl.search;
  const isAllowed = PERMITTED_PATH_PATTERNS.some(pattern => pattern.test(parsedUrl.pathname) || pattern.test(pathWithSearch));

  if (!isAllowed) {
    throw new FirstReadSecurityError(
      `Endpoint "${parsedUrl.pathname}" is not on the FirstRead read-only allowlist.`
    );
  }

  return parsedUrl;
}
