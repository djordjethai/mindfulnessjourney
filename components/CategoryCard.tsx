import Link from "next/link";
import type { Category } from "@/lib/types";

const categoryNotes: Record<string, string> = {
  mindfulness: "Presence, compassion, resilience, and the everyday practice of paying attention.",
  procrastination: "Gentle, practical reflections on starting, focus, and meeting resistance.",
  yoga: "Movement, meditation, inner balance, and the lessons found through practice.",
};

export function CategoryCard({ category, count }: { category: Category; count: number }): React.JSX.Element {
  return (
    <Link className={`category-card category-${category.slug}`} href={`/category/${category.slug}/`}>
      <span className="category-mark" aria-hidden="true" />
      <h3>{category.name}</h3>
      <p>{categoryNotes[category.slug] || category.seoDescription}</p>
      <span className="category-count">{count} {count === 1 ? "story" : "stories"}</span>
    </Link>
  );
}
