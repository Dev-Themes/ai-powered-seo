import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container page not-found">
      <span className="eyebrow">404 · NOT FOUND</span>
      <h1>Page Not Found</h1>
      <p className="lede">The requested page does not exist on this dashboard.</p>
      <Link href="/admin" className="button button-primary">
        Return to FirstRead Dashboard →
      </Link>
    </div>
  );
}