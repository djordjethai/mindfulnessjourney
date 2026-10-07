import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/category/mindfulness/", label: "Mindfulness" },
  { href: "/category/procrastination/", label: "Procrastination" },
  { href: "/category/yoga/", label: "Yoga" },
  { href: "/tag/my-mindfulness-journey/", label: "My Journey" },
  { href: "/about-my-quest-to-better-life/", label: "About" },
];

export function Header(): React.JSX.Element {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="Mindfulness Journey home">
          <span>Mindfulness Journey</span>
          <small>A Very Personal Story</small>
        </Link>
        <nav aria-label="Main navigation">
          {links.map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
          <Link className="search-link" href="/search/" aria-label="Search the site">
            Search
          </Link>
        </nav>
      </div>
    </header>
  );
}
