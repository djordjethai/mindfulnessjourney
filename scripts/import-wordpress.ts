import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { pipeline } from "node:stream/promises";
import * as unzipper from "unzipper";
import {
  cleanHtml,
  collectInternalLinks,
  excerptFromHtml,
  localUploadPath,
  parseWxr,
  plainTextFromHtml,
  removeDuplicateLeadingFeaturedImage,
  removeDuplicateLeadingTitle,
} from "../lib/wordpress";
import type { ContentItem } from "../lib/types";
import { CONTACT_EMAIL } from "../lib/site";

const root = process.cwd();
const sourceDirectory = path.join(root, "migration-source");
const xmlPath = path.join(sourceDirectory, "mindfulnessjourney.WordPress.2026-10-07.xml");
const uploadsPath = path.join(sourceDirectory, "backup_2026-10-01-0254_Mindfulness_Journey_b19526f73577-uploads.zip");
const publicUploads = path.join(root, "public", "wp-content", "uploads");
const contentDirectory = path.join(root, "content");
const migrationDirectory = path.join(root, "migration");
const allowedMediaExtensions = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg", ".pdf", ".mp4", ".webm", ".mp3", ".wav", ".ogg", ".m4a", ".mov", ".doc", ".docx", ".xls", ".xlsx", ".zip", ".txt"]);

type ZipFile = unzipper.File & { path: string; type: string };

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function safeArchiveRelativePath(entryPath: string): string | undefined {
  const normalized = entryPath.replaceAll("\\", "/");
  const match = normalized.match(/^uploads\/(\d{4}\/\d{2}\/.+)$/);
  if (!match || match[1].split("/").includes("..")) return undefined;
  if (!allowedMediaExtensions.has(path.extname(match[1]).toLowerCase())) return undefined;
  return match[1];
}

async function extractUploads(zipPath: string): Promise<{ files: Set<string>; relativeFiles: string[]; extracted: number }> {
  await rm(publicUploads, { recursive: true, force: true });
  await mkdir(publicUploads, { recursive: true });
  const archive = await unzipper.Open.file(zipPath);
  const files = new Set<string>();
  const relativeFiles: string[] = [];
  let extracted = 0;
  for (const entry of archive.files as ZipFile[]) {
    if (entry.type === "Directory") continue;
    const relativePath = safeArchiveRelativePath(entry.path);
    if (!relativePath) continue;
    const destination = path.join(publicUploads, ...relativePath.split("/"));
    await mkdir(path.dirname(destination), { recursive: true });
    await pipeline(entry.stream(), createWriteStream(destination));
    files.add(relativePath.toLowerCase());
    relativeFiles.push(relativePath);
    extracted += 1;
  }
  return { files, relativeFiles, extracted };
}

function uploadRelativePath(publicPath: string): string | undefined {
  const prefix = "/wp-content/uploads/";
  if (!publicPath.toLowerCase().startsWith(prefix)) return undefined;
  let relative = publicPath.slice(prefix.length).split(/[?#]/, 1)[0];
  try {
    relative = decodeURIComponent(relative);
  } catch {
    // Keep the source spelling when an old URL contains malformed escapes.
  }
  return relative.replaceAll("\\", "/").toLowerCase();
}

function mediaExists(publicPath: string | undefined, files: ReadonlySet<string>): boolean {
  if (!publicPath) return false;
  const relative = uploadRelativePath(publicPath);
  return relative ? files.has(relative) : false;
}

function collectRequiredUploads(values: unknown[]): Set<string> {
  const required = new Set<string>();
  const serialized = JSON.stringify(values);
  for (const match of serialized.matchAll(/\/wp-content\/uploads\/[^\s"'<>),\\]+/g)) {
    const relative = uploadRelativePath(match[0]);
    if (relative) required.add(relative);
  }
  return required;
}

async function pruneUnusedUploads(relativeFiles: string[], requiredFiles: ReadonlySet<string>): Promise<{ removed: number; retained: number; removedBytes: number; retainedBytes: number }> {
  let removed = 0;
  let retained = 0;
  let removedBytes = 0;
  let retainedBytes = 0;
  for (const relativeFile of relativeFiles) {
    const filePath = path.join(publicUploads, ...relativeFile.split("/"));
    const size = (await stat(filePath)).size;
    if (requiredFiles.has(relativeFile.toLowerCase())) {
      retained += 1;
      retainedBytes += size;
      continue;
    }
    await rm(filePath);
    removed += 1;
    removedBytes += size;
  }
  return { removed, retained, removedBytes, retainedBytes };
}

function normalizePathname(value: string): string {
  try {
    const pathname = new URL(value, "https://georgemposi.com").pathname;
    if (pathname === "/") return "/";
    if (/\.[a-z0-9]{2,8}$/i.test(pathname)) return pathname;
    return `/${pathname.split("/").filter(Boolean).join("/")}/`;
  } catch {
    return value;
  }
}

async function fetchSitemapUrls(): Promise<string[]> {
  const indexResponse = await fetch("https://georgemposi.com/sitemap_index.xml");
  if (!indexResponse.ok) throw new Error(`Sitemap index returned ${indexResponse.status}`);
  const index = await indexResponse.text();
  const childUrls = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const urls: string[] = [];
  for (const childUrl of childUrls) {
    const response = await fetch(childUrl);
    if (!response.ok) throw new Error(`${childUrl} returned ${response.status}`);
    const xml = await response.text();
    urls.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
  }
  return [...new Set(urls)];
}

async function preserveLocationKml(oldUrls: string[]): Promise<boolean> {
  const locationUrl = oldUrls.find((url) => url.endsWith("/locations.kml"));
  if (!locationUrl) return false;
  try {
    const response = await fetch(locationUrl);
    if (!response.ok) return false;
    await writeFile(path.join(root, "public", "locations.kml"), Buffer.from(await response.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function applyStaticPageOverrides(item: ContentItem): ContentItem {
  if (item.slug === "contact-us") {
    return {
      ...item,
      excerpt: `Contact George M. Posi at ${CONTACT_EMAIL} or connect through social media.`,
      contentHtml: "",
      seoDescription: `Contact George M. Posi at ${CONTACT_EMAIL} or connect through Facebook, X, Instagram, YouTube, and Amazon.`,
    };
  }

  if (item.slug === "free-e-book") {
    const bookContentStart = item.contentHtml.indexOf("<h2>My mindfulness journey story");
    const preservedBookContent = bookContentStart >= 0 ? item.contentHtml.slice(bookContentStart) : "";
    return {
      ...item,
      title: "My Mindfulness Journey Book",
      excerpt: "A personal story about mindfulness, change, and the decision to begin a new life in Thailand.",
      contentHtml: `${preservedBookContent}<p><a href="https://www.amazon.com/George-M-Posi/e/B07MP6CB7C" target="_blank" rel="noreferrer noopener"><strong>Explore my books on Amazon.</strong></a></p>`,
      seoTitle: "My Mindfulness Journey Book",
      seoDescription: "Explore George M. Posi’s books and personal writing about mindfulness, meditation, and changing his life in Thailand.",
    };
  }

  if (item.slug === "thank-you") {
    return {
      ...item,
      excerpt: "Thank you for visiting Mindfulness Journey.",
      contentHtml: '<p>Thank you for visiting Mindfulness Journey.</p><p><a href="/">Read the latest stories</a>, learn more <a href="/about-my-quest-to-better-life/">about this journey</a>, or <a href="https://www.amazon.com/George-M-Posi/e/B07MP6CB7C" target="_blank" rel="noreferrer noopener">explore my books on Amazon</a>.</p>',
      seoDescription: "Thank you for visiting Mindfulness Journey by George M. Posi.",
    };
  }

  if (item.slug === "privacy-policy") {
    return {
      ...item,
      excerpt: "A plain-language privacy note for the static Mindfulness Journey website.",
      contentHtml: `<h2>About this website</h2>
<p>Mindfulness Journey is a static website. It has no user accounts, comments, contact forms, newsletter signup, advertising, or on-site payment features. The site itself does not use analytics or set marketing cookies.</p>
<h2>Email</h2>
<p>If you choose to contact me by email, the message is handled by your email provider and the recipient email provider. Only include information you are comfortable sending by email.</p>
<h2>External websites</h2>
<p>This site links to services such as Facebook, X, Instagram, YouTube, and Amazon. Those websites have their own privacy policies and may collect information when you visit them.</p>
<h2>Hosting</h2>
<p>The hosting provider may process basic technical request information, such as IP address, browser details, and request time, for security and reliable delivery of the website.</p>
<h2>Contact</h2>
<p>For privacy questions, email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`,
      seoTitle: "Privacy Policy",
      seoDescription: "Privacy information for the static Mindfulness Journey website.",
    };
  }

  return item;
}

async function main(): Promise<void> {
  const xml = await readFile(xmlPath, "utf8");
  const parsed = parseWxr(xml);
  const uploadResult = await extractUploads(uploadsPath);
  const attachmentById = new Map(parsed.attachments.map((attachment) => [attachment.id, attachment]));
  const altByPath = new Map(
    parsed.attachments
      .filter((attachment) => attachment.localPath && attachment.alt)
      .map((attachment) => [attachment.localPath as string, attachment.alt as string]),
  );

  const functionalDependencies: Array<{ route: string; type: string; detail: string }> = [];
  const removedShortcodes: Array<{ route: string; shortcode: string }> = [];
  const items = parsed.items.map((item): ContentItem => {
    const cleaned = cleanHtml(item.contentHtml, altByPath);
    if (cleaned.hadInteractiveForm) {
      functionalDependencies.push({ route: item.route, type: "form", detail: "WordPress form controls were removed; preserve any valid outbound links separately." });
    }
    if (cleaned.hadInlineScript) {
      functionalDependencies.push({ route: item.route, type: "inline-script", detail: "Inline WordPress script was removed for the static migration." });
    }
    for (const shortcode of cleaned.removedShortcodes) {
      removedShortcodes.push({ route: item.route, shortcode });
    }
    const featured = item.featuredImageId ? attachmentById.get(item.featuredImageId) : undefined;
    const withoutDuplicateImage = removeDuplicateLeadingFeaturedImage(cleaned.html, featured?.localPath);
    const contentHtml = removeDuplicateLeadingTitle(withoutDuplicateImage, item.title);
    return applyStaticPageOverrides({
      ...item,
      contentHtml,
      excerpt: item.excerpt ? plainTextFromHtml(item.excerpt) : excerptFromHtml(contentHtml),
      featuredImage: featured?.localPath,
      featuredImageAlt: featured?.alt || featured?.title,
    });
  });

  const categories = parsed.categories.map((category) => ({
    ...category,
    descriptionHtml: cleanHtml(category.descriptionHtml, altByPath).html,
  }));
  const tagCounts = new Map<string, { name: string; count: number }>();
  for (const post of items.filter((item) => item.type === "post")) {
    post.tagSlugs.forEach((slug, index) => {
      const current = tagCounts.get(slug);
      tagCounts.set(slug, { name: post.tags[index] || slug, count: (current?.count || 0) + 1 });
    });
  }
  const usefulTags = [...tagCounts.entries()]
    .filter(([, value]) => value.count >= 4)
    .map(([slug, value]) => ({ slug, ...value }))
    .sort((a, b) => b.count - a.count);

  const knownRoutes = new Set<string>([
    "/",
    "/search/",
    ...items.filter((item) => item.route !== "/").map((item) => item.route),
    ...categories.map((category) => `/category/${category.slug}/`),
    ...usefulTags.map((tag) => `/tag/${tag.slug}/`),
  ]);
  const internalLinks = collectInternalLinks(items, knownRoutes);

  const missingMedia = new Set<string>();
  for (const attachment of parsed.attachments) {
    if (attachment.localPath && !mediaExists(attachment.localPath, uploadResult.files)) missingMedia.add(attachment.localPath);
  }
  for (const item of items) {
    for (const match of item.contentHtml.matchAll(/(?:src|poster)="(\/wp-content\/uploads\/[^"]+)"/g)) {
      if (!mediaExists(match[1], uploadResult.files)) missingMedia.add(match[1]);
    }
  }

  await rm(contentDirectory, { recursive: true, force: true });
  await mkdir(path.join(contentDirectory, "posts"), { recursive: true });
  await mkdir(path.join(contentDirectory, "pages"), { recursive: true });
  await mkdir(migrationDirectory, { recursive: true });
  for (const item of items) {
    const folder = item.type === "post" ? "posts" : "pages";
    await writeFile(path.join(contentDirectory, folder, `${item.slug}.json`), json(item));
  }
  await writeFile(path.join(contentDirectory, "categories.json"), json(categories));
  await writeFile(path.join(contentDirectory, "tags.json"), json(usefulTags));

  const mappedAttachments = parsed.attachments.map((attachment) => ({
    ...attachment,
    localPath: attachment.localPath && mediaExists(attachment.localPath, uploadResult.files) ? attachment.localPath : undefined,
  }));
  const requiredUploads = collectRequiredUploads([mappedAttachments, items, categories]);
  const mediaPruning = await pruneUnusedUploads(uploadResult.relativeFiles, requiredUploads);
  await writeFile(path.join(migrationDirectory, "attachment-map.json"), json(mappedAttachments));
  await writeFile(path.join(migrationDirectory, "internal-links.json"), json(internalLinks));
  await writeFile(
    path.join(migrationDirectory, "url-map.json"),
    json(items.map((item) => ({ old_url: item.oldUrl, new_url: new URL(item.route, "https://georgemposi.com").toString(), status: normalizePathname(item.oldUrl) === item.route ? "same" : "mapped" }))),
  );

  let oldUrls: string[] = [];
  let sitemapError: string | undefined;
  try {
    oldUrls = await fetchSitemapUrls();
  } catch (error) {
    sitemapError = error instanceof Error ? error.message : String(error);
  }
  const preservedKml = await preserveLocationKml(oldUrls);
  const generatedUrls = unique([
    "/",
    ...items.filter((item) => item.route !== "/").map((item) => item.route),
    ...categories.map((category) => `/category/${category.slug}/`),
    ...usefulTags.map((tag) => `/tag/${tag.slug}/`),
    "/search/",
    ...(preservedKml ? ["/locations.kml"] : []),
  ]).sort();
  const oldPaths = unique(oldUrls.map(normalizePathname)).sort();
  const generatedSet = new Set(generatedUrls);
  const oldSet = new Set(oldPaths);
  const urlAudit = {
    auditedAt: new Date().toISOString(),
    sitemapError,
    oldUrls: oldPaths,
    generatedUrls,
    missingUrls: oldPaths.filter((url) => !generatedSet.has(url)),
    newOnlyUrls: generatedUrls.filter((url) => !oldSet.has(url)),
  };
  await writeFile(path.join(migrationDirectory, "url-audit.json"), json(urlAudit));

  const searchIndex = items
    .filter((item) => item.type === "post" || (item.type === "page" && item.route !== "/"))
    .map((item) => ({ title: item.title, slug: item.route, excerpt: item.excerpt, categories: item.categories, body: plainTextFromHtml(item.contentHtml) }));
  await mkdir(path.join(root, "public"), { recursive: true });
  await writeFile(path.join(root, "public", "search-index.json"), json(searchIndex));

  const report = {
    generatedAt: new Date().toISOString(),
    postsImported: items.filter((item) => item.type === "post").length,
    pagesImported: items.filter((item) => item.type === "page").length,
    categoriesImported: categories.length,
    usefulTagArchives: usefulTags.length,
    attachmentsInWxr: parsed.attachments.length,
    attachmentsMapped: mappedAttachments.filter((attachment) => attachment.localPath).length,
    mediaFilesExtracted: uploadResult.extracted,
    mediaFilesRetained: mediaPruning.retained,
    mediaFilesPruned: mediaPruning.removed,
    mediaRetainedBytes: mediaPruning.retainedBytes,
    mediaPrunedBytes: mediaPruning.removedBytes,
    missingMedia: [...missingMedia].sort(),
    unresolvedInternalLinks: internalLinks,
    historicalComments: parsed.comments,
    functionalDependencies,
    removedShortcodes,
    sitemap: {
      oldUrlCount: oldPaths.length,
      generatedUrlCount: generatedUrls.length,
      missingUrlCount: urlAudit.missingUrls.length,
      newOnlyUrlCount: urlAudit.newOnlyUrls.length,
      error: sitemapError,
    },
  };
  await writeFile(path.join(migrationDirectory, "content-report.json"), json(report));

  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
