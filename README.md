# Mindfulness Journey

A static preservation of **Mindfulness Journey — A Very Personal Story**, migrated from WordPress to Next.js. The writing, original URLs, dates, categories, SEO metadata, and media are retained without carrying WordPress, its theme, or its plugins into the new site.

## How the migration works

The one-time importer reads a WordPress WXR export and the uploads backup from `migration-source/`. It accepts only published posts and pages, resolves featured images through WordPress attachment IDs, cleans implementation-only markup conservatively, rewrites old `georgemposi.com` links to relative URLs, extracts dated media, and creates the content and audit files used by the static site.

The original source directory is ignored by Git. Never commit the WXR export or uploads ZIP.

```text
migration-source/
  mindfulnessjourney.WordPress.2026-10-07.xml
  backup_2026-10-01-0254_Mindfulness_Journey_b19526f73577-uploads.zip
```

Run the importer with:

```powershell
npm install
npm run import:wordpress
```

The importer replaces generated files under `content/posts/`, `content/pages/`, and `public/wp-content/uploads/`. It retains every WXR attachment and every media file referenced by migrated content, while omitting unused WordPress-generated size variants. Migration findings are written to `migration/`, including the attachment map, internal-link report, URL map, live-sitemap audit, and content report.

## Content storage

- `content/posts/*.json` contains one published article per file.
- `content/pages/*.json` contains one published WordPress page per file.
- `content/categories.json` contains category descriptions and SEO fields.
- `content/tags.json` lists only useful tag archives (currently tags used by at least four posts).
- `public/wp-content/uploads/` retains the original year/month media paths.
- `public/search-index.json` is the generated browser-side search index.

Article bodies remain HTML because that is the least destructive representation of the WordPress content. React components provide the site shell but do not contain the article collection.

## Development, tests, and build

```powershell
npm run dev
npm test
npm run build
npm run validate
```

`npm run build` performs a Next.js static export and creates `out/`. `npm run validate` crawls that directory and fails on broken internal links, missing local media, duplicate/missing canonical URLs, localhost references, WordPress runtime endpoints, or uncovered live-sitemap URLs. Run the complete verification sequence with `npm run check`.

No Node server, database, CMS, authentication, API, or server action is used after the build.

## Azure deployment

The existing workflow at `.github/workflows/azure-static-web-apps-green-island-071796b10.yml` is intentionally unchanged. It builds from `/`, uses no API location, publishes `out`, and uses the repository's existing Azure Static Web Apps secret. A push to `main` triggers the established deployment to the Azure-generated hostname.

Do not add another Azure workflow, rename the deployment secret, purge a CDN, modify DNS, or remove the existing WordPress hosting as part of this migration. Production-domain switching is a separate manual step after review.

## Add an occasional post manually

1. Copy a recent file from `content/posts/` and rename it to the new URL slug, such as `content/posts/a-quiet-morning.json`.
2. Give it a unique numeric `id`, set `type` to `post`, update the title, slug, ISO dates, excerpt, HTML body, categories, tags, SEO fields, and both `route` and `oldUrl`.
3. Put images under `public/wp-content/uploads/YYYY/MM/` and reference them with `/wp-content/uploads/YYYY/MM/file.jpg`.
4. Add the post entry to `public/search-index.json` until/unless the importer is rerun.
5. Run `npm run check`, then commit and push after review. Azure deploys the new static export automatically.

Keep body HTML semantic: paragraphs, headings, links, lists, blockquotes, tables, figures, and images. Standard `<img>` elements are intentional because runtime Next.js image optimization is unavailable in a pure static export.

## Sitemap and SEO

`app/sitemap.ts` creates `out/sitemap.xml` from all posts, non-home pages, categories, and useful tags. `app/robots.ts` creates `out/robots.txt`. Each content route generates its canonical URL, description, and Open Graph metadata from the migrated Rank Math values, falling back to Yoast and then the content excerpt.

The importer downloads the current public sitemap index and compares it with generated routes in `migration/url-audit.json`. The migration should not be published if important entries appear in `missingUrls`.

## Forms, newsletter, free book, and comments

The site is deliberately static. WordPress form controls and inline scripts are not migrated. Valid informational copy, links, and downloadable media are preserved where present, while `migration/content-report.json` identifies pages that previously depended on form or plugin behavior. A real contact/newsletter submission flow would require a separately approved external service or backend.

Seven historical approved comments exist in the source export. They are counted in the report but are not displayed; comment migration remains an optional separate project.
