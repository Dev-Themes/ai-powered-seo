import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'FirstRead SEO Monitor — Read-Only AI SEO Monitoring Dashboard';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background: '#090d16',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 80,
        color: '#f8fafc',
        fontFamily: 'sans-serif'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 40 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: '#0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 800,
            color: '#ffffff'
          }}
        >
          FR
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1, color: '#f8fafc' }}>
            FirstRead SEO Monitor
          </div>
          <div style={{ fontSize: 18, color: '#94a3b8', letterSpacing: 1 }}>
            STRICT READ-ONLY AUDITING & AI RECOMMENDATIONS
          </div>
        </div>
      </div>
      <div style={{ fontSize: 32, lineHeight: 1.4, color: '#cbd5e1', maxWidth: 900 }}>
        Continuous monitoring for https://firstread.co.uk
      </div>
      <div style={{ fontSize: 16, color: '#38bdf8', marginTop: 40, letterSpacing: 2 }}>
        TECHNICAL SEO · CONTENT AUDIT · SCHEMA · ACCESSIBILITY
      </div>
    </div>,
    size
  );
}
