import type { NextConfig } from 'next';

const development = process.env.NODE_ENV === 'development';
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://firstread.co.uk",
  "font-src 'self'",
  `connect-src 'self'${development ? ' ws://localhost:* ws://127.0.0.1:*' : ''} https://firstread.co.uk`,
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

const config: NextConfig = {
  poweredByHeader: false,
  distDir: '.next',
  outputFileTracingExcludes: {
    '/*': ['./.local/**/*', './docs/**/*', './tests/**/*']
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Content-Security-Policy', value: csp }
        ]
      }
    ];
  }
};

export default config;
