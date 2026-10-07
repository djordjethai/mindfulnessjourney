import * as cheerio from "cheerio";
import { XMLParser } from "fast-xml-parser";
import type { AnyNode } from "domhandler";
import type { Attachment, Category, ContentItem, InternalLinkIssue } from "@/lib/types";

type ParsedWxr = {
  items: ContentItem[];
  attachments: Attachment[];
  categories: Category[];
  comments: { total: number; approved: number };
};

const SITE_HOSTS = new Set(["georgemposi.com", "www.georgemposi.com"]);
const ILLEGAL_XML_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

export function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  const nested = (value as Record<string, unknown>)["#text"];
  return typeof nested === "string" || typeof nested === "number" ? String(nested) : "";
}

function child(record: unknown, key: string): unknown {
  if (!record || typeof record !== "object") return undefined;
  return (record as Record<string, unknown>)[key];
}

function metadata(item: unknown): Map<string, string> {
  const result = new Map<string, string>();
  for (const entry of asArray(child(item, "wp:postmeta"))) {
    const key = text(child(entry, "wp:meta_key"));
    if (key) result.set(key, text(child(entry, "wp:meta_value")));
  }
  return result;
}

function termMetadata(term: unknown): Map<string, string> {
  const result = new Map<string, string>();
  for (const entry of asArray(child(term, "wp:termmeta"))) {
    const key = text(child(entry, "wp:meta_key"));
    if (key) result.set(key, text(child(entry, "wp:meta_value")));
  }
  return result;
}

function preferred(meta: Map<string, string>, rankMath: string, yoast: string): string | undefined {
  return meta.get(rankMath)?.trim() || meta.get(yoast)?.trim() || undefined;
}

function toIsoDate(value: string, fallback: string): string {
  const source = value && value !== "0000-00-00 00:00:00" ? `${value.replace(" ", "T")}Z` : fallback;
  const date = new Date(source);
  return Number.isNaN(date.valueOf()) ? new Date(0).toISOString() : date.toISOString();
}

function normalizeRoute(url: string, slug: string): string {
  try {
    const pathname = new URL(url).pathname;
    if (pathname === "/") return "/";
    return `/${pathname.split("/").filter(Boolean).join("/")}/`;
  } catch {
    return `/${slug}/`;
  }
}

export function sanitizeWxr(xml: string): string {
  return xml.replace(ILLEGAL_XML_CONTROL_CHARACTERS, "");
}

export function parseWxr(xml: string): ParsedWxr {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    trimValues: false,
    isArray: (_name, jPath) => {
      const currentPath = typeof jPath === "string" ? jPath : "";
      return (
        currentPath.endsWith("channel.item") ||
        currentPath.endsWith("item.category") ||
        currentPath.endsWith("item.wp:postmeta") ||
        currentPath.endsWith("item.wp:comment") ||
        currentPath.endsWith("channel.wp:category") ||
        currentPath.endsWith("wp:category.wp:termmeta")
      );
    },
  });
  const parsed = parser.parse(sanitizeWxr(xml)) as Record<string, unknown>;
  const channel = child(parsed, "rss") ? child(child(parsed, "rss"), "channel") : undefined;
  const rawItems = asArray(child(channel, "item"));

  const attachmentRecords = rawItems.filter((item) => text(child(item, "wp:post_type")) === "attachment");
  const attachments: Attachment[] = attachmentRecords.map((item) => {
    const meta = metadata(item);
    const sourceUrl = text(child(item, "wp:attachment_url")) || text(child(item, "link"));
    return {
      id: Number(text(child(item, "wp:post_id"))),
      sourceUrl,
      localPath: localUploadPath(sourceUrl || meta.get("_wp_attached_file") || ""),
      alt: meta.get("_wp_attachment_image_alt")?.trim() || undefined,
      title: text(child(item, "title")).trim() || undefined,
    };
  });
  const attachmentById = new Map(attachments.map((attachment) => [attachment.id, attachment]));

  const items: ContentItem[] = rawItems
    .filter((item) => {
      const type = text(child(item, "wp:post_type"));
      return (type === "post" || type === "page") && text(child(item, "wp:status")) === "publish";
    })
    .map((item) => {
      const type = text(child(item, "wp:post_type")) as "post" | "page";
      const meta = metadata(item);
      const slug = text(child(item, "wp:post_name")).trim();
      const oldUrl = text(child(item, "link")).trim();
      const rawTerms = asArray(child(item, "category"));
      const categoryTerms = rawTerms.filter((term) => text(child(term, "@_domain")) === "category");
      const tagTerms = rawTerms.filter((term) => text(child(term, "@_domain")) === "post_tag");
      const featuredImageIdValue = meta.get("_thumbnail_id");
      const featuredImageId = featuredImageIdValue ? Number(featuredImageIdValue) : undefined;
      const featured = featuredImageId ? attachmentById.get(featuredImageId) : undefined;
      const pubDate = text(child(item, "pubDate"));

      return {
        id: Number(text(child(item, "wp:post_id"))),
        type,
        title: text(child(item, "title")).trim(),
        slug,
        date: toIsoDate(text(child(item, "wp:post_date_gmt")), pubDate),
        modified: toIsoDate(text(child(item, "wp:post_modified_gmt")), pubDate),
        author: text(child(item, "dc:creator")).trim() || undefined,
        excerpt: text(child(item, "excerpt:encoded")).trim() || undefined,
        contentHtml: text(child(item, "content:encoded")),
        categories: categoryTerms.map((term) => text(term).trim()).filter(Boolean),
        categorySlugs: categoryTerms.map((term) => text(child(term, "@_nicename")).trim()).filter(Boolean),
        tags: tagTerms.map((term) => text(term).trim()).filter(Boolean),
        tagSlugs: tagTerms.map((term) => text(child(term, "@_nicename")).trim()).filter(Boolean),
        featuredImageId,
        featuredImage: featured?.localPath,
        featuredImageAlt: featured?.alt || featured?.title,
        seoTitle: preferred(meta, "rank_math_title", "_yoast_wpseo_title"),
        seoDescription: preferred(meta, "rank_math_description", "_yoast_wpseo_metadesc"),
        focusKeyword: preferred(meta, "rank_math_focus_keyword", "_yoast_wpseo_focuskw"),
        canonical: preferred(meta, "rank_math_canonical_url", "_yoast_wpseo_canonical"),
        oldUrl,
        route: normalizeRoute(oldUrl, slug),
      };
    });

  const categories = asArray(child(channel, "wp:category")).map((term): Category => {
    const meta = termMetadata(term);
    return {
      name: text(child(term, "wp:cat_name")).trim(),
      slug: text(child(term, "wp:category_nicename")).trim(),
      descriptionHtml: text(child(term, "wp:category_description")),
      seoTitle: meta.get("rank_math_title")?.trim() || undefined,
      seoDescription: meta.get("rank_math_description")?.trim() || undefined,
      focusKeyword: meta.get("rank_math_focus_keyword")?.trim() || undefined,
    };
  });

  const comments = rawItems.flatMap((item) => asArray(child(item, "wp:comment")));
  return {
    items,
    attachments,
    categories,
    comments: {
      total: comments.length,
      approved: comments.filter((comment) => text(child(comment, "wp:comment_approved")) === "1").length,
    },
  };
}

export function normalizeInternalUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  try {
    const url = trimmed.startsWith("//") ? new URL(`https:${trimmed}`) : new URL(trimmed);
    if (!SITE_HOSTS.has(url.hostname.toLowerCase())) return trimmed;
    return `${url.pathname || "/"}${url.search}${url.hash}`;
  } catch {
    return trimmed;
  }
}

export function localUploadPath(value: string): string | undefined {
  const normalized = normalizeInternalUrl(value).replaceAll("\\", "/");
  const match = normalized.match(/(?:^|\/)wp-content\/uploads\/(.+?)(?:[?#].*)?$/i);
  if (match) return `/wp-content/uploads/${match[1]}`;
  const bare = normalized.match(/^(?:uploads\/)?(\d{4}\/\d{2}\/.+)$/);
  return bare ? `/wp-content/uploads/${bare[1]}` : undefined;
}

function isEmptyElement($: cheerio.CheerioAPI, element: AnyNode): boolean {
  return $(element).text().replace(/\u00a0/g, " ").trim() === "" && $(element).find("img,video,audio").length === 0;
}

export function cleanHtml(
  html: string,
  altByPath: ReadonlyMap<string, string> = new Map(),
): { html: string; removedShortcodes: string[]; hadInteractiveForm: boolean; hadInlineScript: boolean } {
  const removedShortcodes: string[] = [];
  let cleaned = html.replace(/<!--\s*\/?wp:[\s\S]*?-->/gi, "");
  cleaned = cleaned.replace(/\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/gi, "$1");
  cleaned = cleaned.replace(/\[(formidable|wpforms|contact-form-7|contact-form|gallery)\b[^\]]*\](?:\s*\[\/\1\])?/gi, (match) => {
    removedShortcodes.push(match);
    return "";
  });

  const $ = cheerio.load(cleaned, null, false);
  const hadInteractiveForm = $("form,input,textarea,select").length > 0 || /\[(?:formidable|wpforms|contact-form-7|contact-form)\b/i.test(html);
  const hadInlineScript = $("script").length > 0;
  $("script,style,noscript,iframe").remove();
  $("form").each((_index, form) => {
    $(form).replaceWith($(form).contents());
  });
  $("input,textarea,select,button,label").remove();
  $("h1,h2,h3,h4,h5,h6,p").each((_index, element) => {
    if (isEmptyElement($, element)) $(element).remove();
  });

  $("*").each((_index, element) => {
    if (!("attribs" in element)) return;
    const attributes = { ...(element.attribs || {}) };
    for (const name of Object.keys(attributes)) {
      if (name === "class" || name === "style" || name === "id" || name.startsWith("data-") || name.startsWith("on")) {
        $(element).removeAttr(name);
      }
    }
  });

  $("a").each((_index, anchor) => {
    const href = $(anchor).attr("href");
    if (href) $(anchor).attr("href", normalizeInternalUrl(href));
  });
  $("img,source,video,audio").each((_index, element) => {
    for (const attribute of ["src", "poster"] as const) {
      const value = $(element).attr(attribute);
      if (value) $(element).attr(attribute, localUploadPath(value) || normalizeInternalUrl(value));
    }
    const srcset = $(element).attr("srcset");
    if (srcset) {
      $(element).attr(
        "srcset",
        srcset
          .split(",")
          .map((candidate) => {
            const [url, descriptor] = candidate.trim().split(/\s+/, 2);
            return `${localUploadPath(url) || normalizeInternalUrl(url)}${descriptor ? ` ${descriptor}` : ""}`;
          })
          .join(", "),
      );
    }
  });
  $("img").each((_index, image) => {
    const src = $(image).attr("src");
    if (src && !$(image).attr("alt")) {
      const alt = altByPath.get(src);
      if (alt) $(image).attr("alt", alt);
    }
    $(image).attr("loading", "lazy");
    $(image).attr("decoding", "async");
  });

  return { html: $.html().trim(), removedShortcodes, hadInteractiveForm, hadInlineScript };
}

export function plainTextFromHtml(html: string): string {
  return cheerio.load(html, null, false).text().replace(/\s+/g, " ").trim();
}

export function excerptFromHtml(html: string, maxLength = 220): string {
  const value = plainTextFromHtml(html);
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).replace(/\s+\S*$/, "").trim()}…`;
}

function imageIdentity(value: string): string {
  const pathname = value.split(/[?#]/, 1)[0].toLowerCase();
  const extension = pathname.match(/\.[a-z0-9]+$/)?.[0] || "";
  return pathname.slice(0, extension ? -extension.length : undefined).replace(/-\d+x\d+$/, "");
}

export function removeDuplicateLeadingFeaturedImage(html: string, featuredImage: string | undefined): string {
  if (!featuredImage) return html;
  const $ = cheerio.load(html, null, false);
  const first = $.root().children().first();
  if (!first.length) return html;
  const image = first.is("img") ? first : first.find("img").first();
  const source = image.attr("src");
  if (!source || imageIdentity(source) !== imageIdentity(featuredImage)) return html;
  if (!first.is("img") && (first.find("img").length !== 1 || first.text().replace(/\u00a0/g, " ").trim())) return html;
  first.remove();
  return $.html().trim();
}

function normalizedTitle(value: string): string {
  const stopWords = new Set(["a", "an", "for", "the", "to"]);
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !stopWords.has(word))
    .join(" ");
}

export function removeDuplicateLeadingTitle(html: string, title: string): string {
  const $ = cheerio.load(html, null, false);
  const first = $.root().children().first();
  if (first.is("h1") && normalizedTitle(first.text()) === normalizedTitle(title)) first.remove();
  return $.html().trim();
}

export function collectInternalLinks(items: ContentItem[], knownRoutes: ReadonlySet<string>): InternalLinkIssue[] {
  const issues: InternalLinkIssue[] = [];
  for (const item of items) {
    const $ = cheerio.load(item.contentHtml, null, false);
    $("a[href]").each((_index, anchor) => {
      const href = $(anchor).attr("href") || "";
      if (!href.startsWith("/") || href.startsWith("//")) return;
      const pathname = href.split(/[?#]/, 1)[0];
      if (!pathname || pathname === "/") return;
      if (/\.[a-z0-9]{2,8}$/i.test(pathname)) return;
      const route = `/${pathname.split("/").filter(Boolean).join("/")}/`;
      if (!knownRoutes.has(route)) issues.push({ source: item.route, href, reason: "No generated route" });
    });
  }
  return issues;
}
