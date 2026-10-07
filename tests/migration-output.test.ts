import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateStaticParams } from "../app/[slug]/page";

const root = process.cwd();

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as T;
}

describe("generated migration output", () => {
  it("has no duplicate content slugs", () => {
    const files = ["content/posts", "content/pages"].flatMap((directory) =>
      readdirSync(path.join(root, directory)).filter((file) => file.endsWith(".json")),
    );
    const slugs = files.map((file) => file.replace(/\.json$/, ""));
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("generates a static root route for every non-home content item", () => {
    const postCount = readdirSync(path.join(root, "content/posts")).filter((file) => file.endsWith(".json")).length;
    const pageCount = readdirSync(path.join(root, "content/pages")).filter((file) => file.endsWith(".json")).length;
    expect(generateStaticParams()).toHaveLength(postCount + pageCount - 1);
  });

  it("reports missing media and live sitemap coverage explicitly", () => {
    const report = readJson<{ missingMedia: string[] }>("migration/content-report.json");
    const audit = readJson<{ oldUrls: string[]; missingUrls: string[] }>("migration/url-audit.json");
    expect(Array.isArray(report.missingMedia)).toBe(true);
    expect(audit.oldUrls.length).toBeGreaterThan(100);
    expect(audit.missingUrls).toEqual([]);
  });

  it("replaces obsolete form and newsletter pages with static contact content", () => {
    const contact = readJson<{ contentHtml: string; seoDescription: string }>("content/pages/contact-us.json");
    const freeBook = readJson<{ contentHtml: string }>("content/pages/free-e-book.json");
    const privacy = readJson<{ contentHtml: string }>("content/pages/privacy-policy.json");
    expect(contact.contentHtml).toBe("");
    expect(contact.seoDescription).toContain("info@georgemposi.com");
    expect(freeBook.contentHtml).not.toMatch(/subscribe|newsletter|mailerlite|<form/i);
    expect(privacy.contentHtml).toContain("no user accounts, comments, contact forms, newsletter signup");
  });
});
