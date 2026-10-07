"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SearchEntry = { title: string; slug: string; excerpt: string; categories: string[]; body: string };

export function Search(): React.JSX.Element {
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/search-index.json")
      .then((response) => {
        if (!response.ok) throw new Error("Search index unavailable");
        return response.json() as Promise<SearchEntry[]>;
      })
      .then(setEntries)
      .catch(() => setError(true));
  }, []);

  const results = useMemo(() => {
    const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return entries
      .map((entry) => {
        const title = entry.title.toLocaleLowerCase();
        const haystack = `${entry.title} ${entry.categories.join(" ")} ${entry.excerpt} ${entry.body}`.toLocaleLowerCase();
        if (!words.every((word) => haystack.includes(word))) return null;
        const score = words.reduce((total, word) => total + (title.includes(word) ? 3 : 1), 0);
        return { entry, score };
      })
      .filter((result): result is { entry: SearchEntry; score: number } => result !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((result) => result.entry);
  }, [entries, query]);

  return (
    <div className="search-panel">
      <label htmlFor="site-search">Search the journal</label>
      <input
        id="site-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Try “meditation”, “Thailand”, or “inner peace”"
        autoComplete="off"
      />
      {error ? <p>Search could not be loaded. Please try again later.</p> : null}
      {query.trim() ? (
        <div className="search-results" aria-live="polite">
          <p className="result-count">{results.length} {results.length === 1 ? "result" : "results"}</p>
          {results.map((entry) => (
            <article key={entry.slug}>
              <p className="eyebrow">{entry.categories.join(" · ") || "Page"}</p>
              <h2><Link href={entry.slug}>{entry.title}</Link></h2>
              <p>{entry.excerpt}</p>
            </article>
          ))}
        </div>
      ) : <p className="search-hint">The search stays entirely in your browser and uses a small static index.</p>}
    </div>
  );
}
