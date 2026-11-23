import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <p>Smart Food Delivery Time Prediction, a university machine learning project.</p>
        <nav className="footer-links" aria-label="Footer">
          <Link href="/explore">Route explorer</Link>
          <Link href="/model">Model status</Link>
        </nav>
      </div>
    </footer>
  );
}
