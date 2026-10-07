import type { Metadata } from "next";
import type { ContentItem } from "@/lib/types";

export const SITE_NAME = "Mindfulness Journey";
export const SITE_SUBTITLE = "A Very Personal Story";
export const SITE_URL = "https://georgemposi.com";

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, SITE_URL).toString();
}

export function stripSeoVariables(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const expanded = value
    .replaceAll("%title%", fallback)
    .replaceAll("%term%", fallback)
    .replaceAll("%category%", fallback)
    .replaceAll("%sitename%", SITE_NAME)
    .replaceAll("%sep%", "–")
    .replaceAll("%page%", "")
    .replace(/\s+/g, " ")
    .trim();
  return expanded || fallback;
}

export function contentMetadata(item: ContentItem): Metadata {
  const title = stripSeoVariables(item.seoTitle, item.title);
  const description = item.seoDescription || item.excerpt || SITE_SUBTITLE;
  const canonical = item.canonical || absoluteUrl(item.route);
  const image = item.featuredImage ? absoluteUrl(item.featuredImage) : undefined;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      type: item.type === "post" ? "article" : "website",
      title,
      description,
      url: canonical,
      images: image ? [{ url: image, alt: item.featuredImageAlt || item.title }] : undefined,
      publishedTime: item.type === "post" ? item.date : undefined,
      modifiedTime: item.modified,
    },
  };
}
