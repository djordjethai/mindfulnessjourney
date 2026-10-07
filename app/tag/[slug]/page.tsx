import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { getPostsByTag, getUsefulTags } from "@/lib/content";
import { absoluteUrl } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return getUsefulTags().map((tag) => ({ slug: tag.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tag = getUsefulTags().find((candidate) => candidate.slug === slug);
  if (!tag) return {};
  const canonical = absoluteUrl(`/tag/${slug}/`);
  return { title: tag.name, description: `Stories about ${tag.name} from Mindfulness Journey.`, alternates: { canonical } };
}

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }): Promise<React.JSX.Element> {
  const { slug } = await params;
  const tag = getUsefulTags().find((candidate) => candidate.slug === slug);
  if (!tag) notFound();
  const posts = getPostsByTag(slug);
  return (
    <main className="archive-page shell">
      <header className="archive-header reading-width"><p className="eyebrow">A thread through the journal</p><h1>{tag.name}</h1><p>{tag.count} stories</p></header>
      <div className="article-grid">{posts.map((post) => <ArticleCard article={post} key={post.id} />)}</div>
    </main>
  );
}
