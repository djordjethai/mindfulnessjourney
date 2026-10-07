import type { MetadataRoute } from "next";
import { getCategories, getPages, getPosts, getUsefulTags } from "@/lib/content";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = getPages().filter((page) => page.route !== "/");
  return [
    { url: absoluteUrl("/"), changeFrequency: "monthly", priority: 1 },
    ...getPosts().map((post) => ({ url: absoluteUrl(post.route), lastModified: post.modified || post.date, changeFrequency: "yearly" as const, priority: 0.8 })),
    ...pages.map((page) => ({ url: absoluteUrl(page.route), lastModified: page.modified || page.date, changeFrequency: "yearly" as const, priority: 0.6 })),
    ...getCategories().map((category) => ({ url: absoluteUrl(`/category/${category.slug}/`), changeFrequency: "monthly" as const, priority: 0.6 })),
    ...getUsefulTags().map((tag) => ({ url: absoluteUrl(`/tag/${tag.slug}/`), changeFrequency: "monthly" as const, priority: 0.4 })),
  ];
}
