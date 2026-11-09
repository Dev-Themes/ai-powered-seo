import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || 'http://localhost:3000'),
  robots: {
    index: false,
    follow: false
  },
  title: {
    default: 'FirstRead SEO Dashboard',
    template: '%s | FirstRead SEO'
  },
  description: 'AI-Powered SEO monitoring and recommendations for FirstRead (https://firstread.co.uk)'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body>
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
