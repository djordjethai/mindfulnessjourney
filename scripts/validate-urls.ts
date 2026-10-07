import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const root = process.cwd();
const outputRoot = path.join(root, "out");

type ValidationIssue = { page: string; target?: string; issue: string };

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
  let checkedLinks = 0;
  let checkedImages = 0;

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

  const summary = { htmlPages: htmlFiles.length, checkedLinks, checkedImages, uniqueCanonicals: canonicals.size, issues };
  console.log(JSON.stringify(summary, null, 2));
  if (issues.length) throw new Error(`Static output validation found ${issues.length} issue(s).`);
}

main();
