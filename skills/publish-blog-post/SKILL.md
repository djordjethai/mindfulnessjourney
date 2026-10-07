---
name: publish-blog-post
description: Create or update posts and pages in the Mindfulness Journey static Next.js repository using its existing JSON and HTML content schema. Use for editorial publishing work in this repository; do not use it to migrate WordPress or change hosting infrastructure.
---

# Publish Mindfulness Journey Content

Work from the repository root. Read `content.config.json`, then inspect one current JSON item of the requested type and [resources/site-rules.md](resources/site-rules.md). The live schema is JSON with an HTML string in `contentHtml`; it is not MDX.

## Choose the operation

- For a new post, require a title and category. Use `python scripts/new_post.py --title ... --category ... --description ...` to validate the category, create the slug, reject duplicates, normalize the date, and verify any supplied image. Use today's date when the user does not provide one. Then replace `contentHtml` with the user's article HTML and add only optional metadata that the content supports.
- For a new page, start from [resources/page-template.json](resources/page-template.json), save it under the configured `pagesDir`, and use the same root route convention. Do not add post categories, tags, or blog-only metadata.
- For an update, preserve the existing slug, route, date, author, IDs, and SEO metadata unless the user explicitly asks to change them.

Use [resources/post-template.json](resources/post-template.json) only as a schema reference. Generate a concise `seoDescription` from the supplied content when one is not provided. Preserve the author's personal voice and do not invent facts, links, tags, images, locations, or experiences.

## Verify

Do not manually edit the sitemap, category/tag archives, recent-post lists, or `public/search-index.json`. The Next.js loaders derive the routes and archives, and `npm run build` regenerates the search index.

Before reporting completion, run:

1. `npm run check-content`
2. `npm test`
3. `npm run build`
4. `npm run validate`

Report the changed file, slug, expected public URL, category when applicable, featured image, and the result of each check.

After creating or updating content, verify that the generated sitemap includes the expected public URL. Do not manually edit generated sitemap files unless the project architecture explicitly requires it.

Do not automatically commit, push, deploy, change DNS, or change Azure resources. Perform any of those only when the user explicitly asks.
