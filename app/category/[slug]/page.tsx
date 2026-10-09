import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { JsonLd } from "@/components/JsonLd";
import { getCategories, getCategory, getPostsByCategory } from "@/lib/content";
import { absoluteUrl, SITE_NAME, stripSeoVariables } from "@/lib/seo";
import { archiveStructuredData } from "@/lib/structured-data";

export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return getCategories().map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) return {};
  const title = stripSeoVariables(category.seoTitle, category.name);
  const description = category.seoDescription || `${category.name} stories from ${SITE_NAME}.`;
  const canonical = absoluteUrl(`/category/${slug}/`);
  return { title: { absolute: title }, description, alternates: { canonical }, openGraph: { title, description, url: canonical } };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }): Promise<React.JSX.Element> {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();
  const posts = getPostsByCategory(slug);
  const description = category.seoDescription || `${category.name} stories from ${SITE_NAME}.`;
  return (
    <main className="archive-page shell">
      <JsonLd data={archiveStructuredData({ title: category.name, description, route: `/category/${slug}/`, posts })} />
      <header className="archive-header reading-width">
        <p className="eyebrow">Journal theme</p>
        <h1>{category.name}</h1>
        {category.seoDescription ? <p>{category.seoDescription}</p> : null}
      </header>
      <div className="article-grid">{posts.map((post) => <ArticleCard article={post} key={post.id} />)}</div>
      {category.descriptionHtml ? <div className="archive-description reading-width" dangerouslySetInnerHTML={{ __html: category.descriptionHtml }} /> : null}
    </main>
  );
}
