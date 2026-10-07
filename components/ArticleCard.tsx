import Link from "next/link";
import type { ContentItem } from "@/lib/types";

const dateFormatter = new Intl.DateTimeFormat("en", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

export function ArticleCard({ article }: { article: ContentItem }): React.JSX.Element {
  return (
    <article className="article-card">
      {article.featuredImage ? (
        <Link className="card-image" href={article.route} tabIndex={-1} aria-hidden="true">
          <img src={article.featuredImage} alt={article.featuredImageAlt || ""} loading="lazy" decoding="async" />
        </Link>
      ) : null}
      <div className="card-copy">
        <div className="eyebrow">
          {article.categories[0] || "Journal"} · {dateFormatter.format(new Date(article.date))}
        </div>
        <h3>
          <Link href={article.route}>{article.title}</Link>
        </h3>
        {article.excerpt ? <p>{article.excerpt}</p> : null}
        <Link className="text-link" href={article.route}>
          Read the story <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
