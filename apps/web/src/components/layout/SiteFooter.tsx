import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <p>Smart Food Delivery Time Prediction, a university machine learning project.</p>
        <nav className="footer-links" aria-label="Footer">
          <Link href="/history">Prediction history</Link>
          <Link href="/explore">Route explorer</Link>
          <Link href="/technical/slides">Slides</Link>
        </nav>
      </div>
    </footer>
  );
}
