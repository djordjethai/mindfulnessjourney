import Link from "next/link";
import { EmailLink, SocialLinks } from "@/components/SocialLinks";

export function Footer(): React.JSX.Element {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div>
          <p className="footer-title">Mindfulness Journey</p>
          <p>A Very Personal Story</p>
          <div className="footer-contact"><EmailLink /><SocialLinks /></div>
        </div>
        <div className="footer-links">
          <Link href="/privacy-policy/">Privacy</Link>
          <Link href="/contact-us/">Contact</Link>
          <Link href="/search/">Search</Link>
        </div>
        <p className="copyright">© {new Date().getFullYear()} Mindfulness Journey</p>
      </div>
    </footer>
  );
}
