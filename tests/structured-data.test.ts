import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contentStructuredData, homeStructuredData, PUBLIC_AUTHOR_NAME } from "../lib/structured-data";
import type { ContentItem } from "../lib/types";

const root = process.cwd();

function content(relativePath: string): ContentItem {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as ContentItem;
}

describe("structured data", () => {
  it("describes posts as BlogPosting with the public author identity", () => {
    const data = contentStructuredData(content("content/posts/mindful-mornings-in-bangkok-finding-calm-before-the-city-wakes-up.json"));
    expect(data["@graph"]).toEqual(expect.arrayContaining([
      expect.objectContaining({ "@type": "BlogPosting", headline: "Mindful Mornings in Bangkok: Finding Calm Before the City Wakes Up", datePublished: expect.any(String), dateModified: expect.any(String), image: expect.arrayContaining([expect.stringMatching(/^https:\/\//)]) }),
      expect.objectContaining({ "@type": "Person", name: PUBLIC_AUTHOR_NAME }),
      expect.objectContaining({ "@type": "BreadcrumbList" }),
    ]));
  });

  it("describes the About page as a profile for George M. Posi", () => {
    const data = contentStructuredData(content("content/pages/about-my-quest-to-better-life.json"));
    expect(data["@graph"]).toEqual(expect.arrayContaining([
      expect.objectContaining({ "@type": "ProfilePage", mainEntity: expect.objectContaining({ "@id": expect.stringContaining("#person") }) }),
    ]));
  });

  it("describes the homepage and website", () => {
    const data = homeStructuredData("Mindfulness Journey description");
    expect(data["@graph"]).toEqual(expect.arrayContaining([
      expect.objectContaining({ "@type": "WebSite", name: "Mindfulness Journey" }),
      expect.objectContaining({ "@type": "WebPage" }),
    ]));
  });
});
