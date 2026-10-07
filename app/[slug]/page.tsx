import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleLayout } from "@/components/ArticleLayout";
import { getAdjacentPosts, getContentBySlug, getRootContent } from "@/lib/content";
import { contentMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return getRootContent().map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = getContentBySlug(slug);
  return item ? contentMetadata(item) : {};
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }): Promise<React.JSX.Element> {
  const { slug } = await params;
  const item = getContentBySlug(slug);
  if (!item) notFound();
  const adjacent = item.type === "post" ? getAdjacentPosts(item.slug) : {};
  return <ArticleLayout item={item} previous={adjacent.previous} next={adjacent.next} />;
}
