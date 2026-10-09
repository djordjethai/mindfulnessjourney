import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const root = process.cwd();
const outputRoot = path.join(root, "out");

type ValidationIssue = { page: string; target?: string; issue: string };
type SchemaNode = Record<string, unknown>;

function schemaTypes(node: SchemaNode): string[] {
  const value = node["@type"];
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : typeof value === "string" ? [value] : [];
}

function canonicalPageId(canonical: string): string {
  return `${new URL(canonical).toString()}#webpage`;
}

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const target = path.join(directory, name);
    return statSync(target).isDirectory() ? walk(target) : [target];
  });
}

function pageRoute(filePath: string): string {
  const relative = path.relative(outputRoot, filePath).replaceAll("\\", "/");
  if (relative === "index.html") return "/";
  return `/${relative.replace(/\/index\.html$/, "/")}`;
}

function outputTarget(pathname: string): string {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // A malformed source URL should fail as a missing file below.
  }
  const relative = decoded.replace(/^\/+/, "");
  if (!relative) return path.join(outputRoot, "index.html");
  if (path.extname(relative)) return path.join(outputRoot, ...relative.split("/"));
  return path.join(outputRoot, ...relative.split("/").filter(Boolean), "index.html");
}

function main(): void {
  if (!existsSync(outputRoot)) throw new Error("out/ does not exist. Run npm run build first.");
  const htmlFiles = walk(outputRoot).filter((file) => file.endsWith(".html"));
  const issues: ValidationIssue[] = [];
  const canonicals = new Map<string, string>();
  const postRoutes = new Set(readdirSync(path.join(root, "content", "posts")).filter((file) => file.endsWith(".json")).map((file) => (JSON.parse(readFileSync(path.join(root, "content", "posts", file), "utf8")) as { route: string }).route));
  const pageRoutes = new Set(readdirSync(path.join(root, "content", "pages")).filter((file) => file.endsWith(".json")).map((file) => (JSON.parse(readFileSync(path.join(root, "content", "pages", file), "utf8")) as { route: string }).route).filter((route) => route !== "/"));
  let checkedLinks = 0;
  let checkedImages = 0;
  let structuredDataPages = 0;

  for (const file of htmlFiles) {
    const route = pageRoute(file);
    const isNotFoundArtifact = route === "/404.html" || route === "/404/" || route === "/_not-found/";
    const html = readFileSync(file, "utf8");
    const $ = cheerio.load(html);
    if (/localhost|127\.0\.0\.1/i.test(html)) issues.push({ page: route, issue: "Contains a localhost reference" });
    if (/\/wp-admin\/|\/wp-json\/|wp-comments-post\.php/i.test(html)) issues.push({ page: route, issue: "Depends on a WordPress runtime endpoint" });

    const canonical = $('link[rel="canonical"]').attr("href");
    if (!canonical && !isNotFoundArtifact) {
      issues.push({ page: route, issue: "Missing canonical URL" });
    } else if (canonical && !isNotFoundArtifact && canonicals.has(canonical)) {
      issues.push({ page: route, target: canonical, issue: `Duplicate canonical also used by ${canonicals.get(canonical)}` });
    } else if (canonical && !isNotFoundArtifact) {
      canonicals.set(canonical, route);
    }

    if (!isNotFoundArtifact) {
      const scripts = $('script[type="application/ld+json"]');
      if (scripts.length !== 1) {
        issues.push({ page: route, issue: `Expected exactly one JSON-LD graph, found ${scripts.length}` });
      } else {
        try {
          const data = JSON.parse(scripts.first().html() || "") as { "@context"?: unknown; "@graph"?: unknown };
          const nodes = Array.isArray(data["@graph"]) ? data["@graph"].filter((node): node is SchemaNode => Boolean(node) && typeof node === "object") : [];
          if (data["@context"] !== "https://schema.org" || !nodes.length) {
            issues.push({ page: route, issue: "JSON-LD must contain a Schema.org @graph" });
          } else {
            structuredDataPages += 1;
            const types = new Set(nodes.flatMap(schemaTypes));
            const expectedPageId = canonical ? canonicalPageId(canonical) : undefined;
            if (expectedPageId && !nodes.some((node) => node["@id"] === expectedPageId)) issues.push({ page: route, target: expectedPageId, issue: "JSON-LD WebPage ID does not match canonical URL" });
            if (route === "/" && !types.has("WebSite")) issues.push({ page: route, issue: "Homepage JSON-LD is missing WebSite" });
            if (route !== "/" && !types.has("BreadcrumbList")) issues.push({ page: route, issue: "JSON-LD is missing BreadcrumbList" });
            if (postRoutes.has(route)) {
              const article = nodes.find((node) => schemaTypes(node).includes("BlogPosting"));
              if (!article) {
                issues.push({ page: route, issue: "Post JSON-LD is missing BlogPosting" });
              } else if (typeof article.headline !== "string" || typeof article.datePublished !== "string" || typeof article.dateModified !== "string" || !Array.isArray(article.image) || !article.image.length) {
                issues.push({ page: route, issue: "BlogPosting is missing headline, dates, or image required for rich-result quality" });
              }
              if (!$(".article-date").text().includes("George M. Posi")) issues.push({ page: route, issue: "Visible post byline does not use the public author identity" });
            }
            if (pageRoutes.has(route) && !["WebPage", "ProfilePage", "ContactPage"].some((type) => types.has(type))) issues.push({ page: route, issue: "Page JSON-LD is missing a WebPage type" });
            if ((route.startsWith("/category/") || route.startsWith("/tag/")) && !types.has("CollectionPage")) issues.push({ page: route, issue: "Archive JSON-LD is missing CollectionPage" });
            if (route === "/search/" && !types.has("SearchResultsPage")) issues.push({ page: route, issue: "Search JSON-LD is missing SearchResultsPage" });
            if (postRoutes.has(route) && !nodes.some((node) => schemaTypes(node).includes("Person") && node.name === "George M. Posi")) issues.push({ page: route, issue: "Post JSON-LD is missing the public author identity" });
          }
        } catch {
          issues.push({ page: route, issue: "JSON-LD is not valid JSON" });
        }
      }
    }

    $("a[href]").each((_index, anchor) => {
      const href = $(anchor).attr("href") || "";
      if (!href || href.startsWith("#") || /^(?:mailto:|tel:|javascript:)/i.test(href)) return;
      let url: URL;
      try {
        url = new URL(href, `https://georgemposi.com${route}`);
      } catch {
        issues.push({ page: route, target: href, issue: "Malformed link" });
        return;
      }
      if (url.hostname !== "georgemposi.com" && url.hostname !== "www.georgemposi.com") return;
      checkedLinks += 1;
      if (!existsSync(outputTarget(url.pathname))) issues.push({ page: route, target: href, issue: "Broken internal page or file link" });
    });

    $("img[src],source[src],video[src],audio[src]").each((_index, element) => {
      const src = $(element).attr("src") || "";
      if (!src || src.startsWith("data:")) return;
      let url: URL;
      try {
        url = new URL(src, `https://georgemposi.com${route}`);
      } catch {
        issues.push({ page: route, target: src, issue: "Malformed media URL" });
        return;
      }
      if (url.hostname !== "georgemposi.com" && url.hostname !== "www.georgemposi.com") return;
      checkedImages += 1;
      if (!existsSync(outputTarget(url.pathname))) issues.push({ page: route, target: src, issue: "Missing local media" });
    });
  }

  const auditPath = path.join(root, "migration", "url-audit.json");
  if (existsSync(auditPath)) {
    const audit = JSON.parse(readFileSync(auditPath, "utf8")) as { missingUrls?: string[]; sitemapError?: string };
    if (audit.sitemapError) issues.push({ page: "/sitemap.xml", issue: `Live sitemap audit failed: ${audit.sitemapError}` });
    for (const missing of audit.missingUrls || []) issues.push({ page: "/sitemap.xml", target: missing, issue: "Live sitemap URL is not generated" });
  }

  const summary = { htmlPages: htmlFiles.length, checkedLinks, checkedImages, uniqueCanonicals: canonicals.size, structuredDataPages, issues };
  console.log(JSON.stringify(summary, null, 2));
  if (issues.length) throw new Error(`Static output validation found ${issues.length} issue(s).`);
}

main();
