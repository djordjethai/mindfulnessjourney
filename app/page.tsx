import type { Metadata } from "next";
import Link from "next/link";
import { ArticleCard } from "@/components/ArticleCard";
import { CategoryCard } from "@/components/CategoryCard";
import { getCategories, getPages, getPosts, getPostsByCategory, getPostsByTag } from "@/lib/content";
import { SITE_NAME, SITE_SUBTITLE, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} — ${SITE_SUBTITLE}` },
  description: "Personal reflections on mindfulness, meditation, yoga, life in Thailand, and the journey toward inner peace.",
  alternates: { canonical: SITE_URL },
  openGraph: { title: SITE_NAME, description: SITE_SUBTITLE, url: SITE_URL },
};

export default function HomePage(): React.JSX.Element {
  const posts = getPosts();
  const categories = getCategories();
  const homepage = getPages().find((page) => page.route === "/");
  const journeyPosts = getPostsByTag("my-mindfulness-journey").slice(0, 3);

  return (
    <main>
      <section className="home-hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">A journal of attention, change, and everyday life</p>
            <h1>Mindfulness<br /><em>Journey</em></h1>
            <p className="hero-intro">{homepage?.excerpt?.replace(/^A Very Personal Story\s*/i, "") || "A very personal story about finding more presence, peace, and meaning in the life already here."}</p>
            <Link className="button" href="#latest">Read the latest stories</Link>
          </div>
          <div className="hero-art" aria-hidden="true">
            <span className="sun" />
            <span className="hill hill-back" />
            <span className="hill hill-front" />
            <span className="path" />
          </div>
        </div>
      </section>

      <section className="section shell" id="latest">
        <div className="section-heading">
          <div><p className="eyebrow">From the journal</p><h2>Latest reflections</h2></div>
          <p>Stories from Thailand, meditation practice, and the ongoing work of living with awareness.</p>
        </div>
        <div className="article-grid">
          {posts.slice(0, 6).map((post) => <ArticleCard article={post} key={post.id} />)}
        </div>
      </section>

      <section className="section category-section">
        <div className="shell">
          <div className="section-heading compact"><div><p className="eyebrow">Explore by theme</p><h2>Ways into the journey</h2></div></div>
          <div className="category-grid">
            {categories.map((category) => (
              <CategoryCard category={category} count={getPostsByCategory(category.slug).length} key={category.slug} />
            ))}
          </div>
        </div>
      </section>

      {journeyPosts.length ? (
        <section className="section shell journey-section">
          <div className="journey-intro">
            <p className="eyebrow">My Journey</p>
            <h2>Learning to see life differently</h2>
            <p>Personal chapters about change, Thailand, retreat, uncertainty, and what each experience revealed.</p>
            <Link className="text-link" href="/tag/my-mindfulness-journey/">Follow the journey <span aria-hidden="true">→</span></Link>
          </div>
          <div className="journey-list">
            {journeyPosts.map((post, index) => (
              <Link href={post.route} key={post.id}><span>0{index + 1}</span><strong>{post.title}</strong><span aria-hidden="true">↗</span></Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
