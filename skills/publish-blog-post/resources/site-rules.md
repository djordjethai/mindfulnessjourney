# Mindfulness Journey publishing rules

- Preserve the author's personal wording and lived experience unless editing is explicitly requested. Do not silently rewrite prose or invent personal experiences.
- Store content as the existing JSON schema with article markup in `contentHtml`; do not introduce MDX.
- Use semantic headings. The layout renders the page title as H1, so start body sections at H2.
- Preserve valid internal and external links. Do not invent URLs, locations, historical details, quotations, or health claims.
- Keep local media under `public/wp-content/uploads` and reference it with `/wp-content/uploads/...`. Verify every referenced file exists and use meaningful alt text.
- Do not create duplicate slugs or routes. Validate category names and slugs against `content.config.json`.
- Use `seoDescription` for new content and preserve existing SEO fields when updating migrated content.
- Do not add contact, newsletter, subscription, or signup forms. Contact is through `mailto:info@georgemposi.com`.
- Preserve the valid Facebook, X, Instagram, YouTube, and Amazon links and the existing icon components; do not invent social profiles.
- Existing book and Amazon links are valid editorial content, but do not add shopping-cart, checkout, account, or WooCommerce functionality.
- Do not reintroduce WordPress endpoints, shortcodes, plugin scripts, or other WordPress runtime dependencies.
