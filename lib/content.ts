import { cache } from "react";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Category, ContentItem } from "@/lib/types";

const contentRoot = path.join(process.cwd(), "content");

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function readCollection(directory: "posts" | "pages"): ContentItem[] {
  const folder = path.join(contentRoot, directory);
  return readdirSync(folder)
    .filter((file) => file.endsWith(".json"))
    .map((file) => readJson<ContentItem>(path.join(folder, file)));
}

export const getPosts = cache((): ContentItem[] =>
  readCollection("posts").sort((a, b) => b.date.localeCompare(a.date)),
);

export const getPages = cache((): ContentItem[] => readCollection("pages"));

export const getCategories = cache((): Category[] =>
  readJson<Category[]>(path.join(contentRoot, "categories.json")),
);

export function getRootContent(): ContentItem[] {
  return [...getPosts(), ...getPages().filter((page) => page.route !== "/")];
}

export function getContentBySlug(slug: string): ContentItem | undefined {
  return getRootContent().find((item) => item.slug === slug);
}

export function getCategory(slug: string): Category | undefined {
  return getCategories().find((category) => category.slug === slug);
}

export function getPostsByCategory(slug: string): ContentItem[] {
  return getPosts().filter((post) => post.categorySlugs.includes(slug));
}

export function getUsefulTags(): Array<{ name: string; slug: string; count: number }> {
  const tags = new Map<string, { name: string; slug: string; count: number }>();
  for (const post of getPosts()) {
    post.tagSlugs.forEach((slug, index) => {
      const current = tags.get(slug);
      tags.set(slug, {
        name: post.tags[index] || slug,
        slug,
        count: (current?.count || 0) + 1,
      });
    });
  }
  return [...tags.values()].filter((tag) => tag.count >= 4).sort((a, b) => b.count - a.count);
}

export function getPostsByTag(slug: string): ContentItem[] {
  return getPosts().filter((post) => post.tagSlugs.includes(slug));
}

export function getAdjacentPosts(slug: string): { previous?: ContentItem; next?: ContentItem } {
  const posts = [...getPosts()].reverse();
  const index = posts.findIndex((post) => post.slug === slug);
  return {
    previous: index > 0 ? posts[index - 1] : undefined,
    next: index >= 0 && index < posts.length - 1 ? posts[index + 1] : undefined,
  };
}
