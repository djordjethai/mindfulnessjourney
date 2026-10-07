import Link from "next/link";
import { ContactDetails } from "@/components/ContactDetails";
import type { ContentItem } from "@/lib/types";

const dateFormatter = new Intl.DateTimeFormat("en", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

export function ArticleLayout({
  item,
  previous,
  next,
}: {
  item: ContentItem;
  previous?: ContentItem;
  next?: ContentItem;
}): React.JSX.Element {
  const isPost = item.type === "post";
  return (
    <main>
      <header className="article-hero shell reading-width">
        {isPost && item.categories.length ? (
          <div className="eyebrow article-categories">
            {item.categories.map((category, index) => (
              <span key={item.categorySlugs[index] || category}>
                {index > 0 ? " · " : ""}
                <Link href={`/category/${item.categorySlugs[index]}/`}>{category}</Link>
              </span>
            ))}
          </div>
        ) : null}
        <h1>{item.title}</h1>
        {isPost ? (
          <p className="article-date">
            <time dateTime={item.date}>{dateFormatter.format(new Date(item.date))}</time>
            {item.author ? ` · ${item.author}` : ""}
          </p>
        ) : null}
      </header>

      {item.featuredImage ? (
        <figure className="featured-image shell wide-reading-width">
          <img src={item.featuredImage} alt={item.featuredImageAlt || item.title} />
        </figure>
      ) : null}

      <div className="article-body shell reading-width" dangerouslySetInnerHTML={{ __html: item.contentHtml }} />

      {item.slug === "contact-us" ? <ContactDetails /> : null}

      {isPost && item.tags.length ? (
        <div className="article-tags shell reading-width" aria-label="Article topics">
          {item.tags.map((tag, index) => (
            <span className="tag" key={`${item.tagSlugs[index]}-${tag}`}>{tag}</span>
          ))}
        </div>
      ) : null}

      {isPost && (previous || next) ? (
        <nav className="post-navigation shell wide-reading-width" aria-label="More stories">
          {previous ? (
            <Link href={previous.route}>
              <small>Previous story</small>
              <span>{previous.title}</span>
            </Link>
          ) : <span />}
          {next ? (
            <Link className="next" href={next.route}>
              <small>Next story</small>
              <span>{next.title}</span>
            </Link>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}
