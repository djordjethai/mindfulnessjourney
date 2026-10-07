import { describe, expect, it } from "vitest";
import { cleanHtml, normalizeInternalUrl, parseWxr, removeDuplicateLeadingFeaturedImage, removeDuplicateLeadingTitle } from "../lib/wordpress";

const fixture = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:wp="http://wordpress.org/export/1.2/"><channel>
<wp:category><wp:category_nicename><![CDATA[mindfulness]]></wp:category_nicename><wp:cat_name><![CDATA[Mindfulness]]></wp:cat_name><wp:category_description><![CDATA[<p>Present.</p>]]></wp:category_description></wp:category>
<item><title><![CDATA[Image]]></title><link>https://georgemposi.com/wp-content/uploads/2024/01/hero.jpg</link><wp:post_id>99</wp:post_id><wp:post_type><![CDATA[attachment]]></wp:post_type><wp:status><![CDATA[inherit]]></wp:status><wp:attachment_url><![CDATA[https://georgemposi.com/wp-content/uploads/2024/01/hero.jpg]]></wp:attachment_url><wp:postmeta><wp:meta_key><![CDATA[_wp_attachment_image_alt]]></wp:meta_key><wp:meta_value><![CDATA[Quiet landscape]]></wp:meta_value></wp:postmeta></item>
<item><title><![CDATA[Published story]]></title><link>https://georgemposi.com/published-story/</link><pubDate>Mon, 01 Jan 2024 00:00:00 +0000</pubDate><dc:creator><![CDATA[George]]></dc:creator><content:encoded><![CDATA[<!-- wp:paragraph --><p>Hello <a href="https://georgemposi.com/about/">inside</a>.</p><!-- /wp:paragraph -->]]></content:encoded><excerpt:encoded><![CDATA[]]></excerpt:encoded><wp:post_id>1</wp:post_id><wp:post_date_gmt>2024-01-01 00:00:00</wp:post_date_gmt><wp:post_modified_gmt>2024-01-02 00:00:00</wp:post_modified_gmt><wp:post_name><![CDATA[published-story]]></wp:post_name><wp:status><![CDATA[publish]]></wp:status><wp:post_type><![CDATA[post]]></wp:post_type><category domain="category" nicename="mindfulness"><![CDATA[Mindfulness]]></category><wp:postmeta><wp:meta_key><![CDATA[_thumbnail_id]]></wp:meta_key><wp:meta_value><![CDATA[99]]></wp:meta_value></wp:postmeta><wp:postmeta><wp:meta_key><![CDATA[rank_math_description]]></wp:meta_key><wp:meta_value><![CDATA[Preferred description]]></wp:meta_value></wp:postmeta><wp:postmeta><wp:meta_key><![CDATA[_yoast_wpseo_metadesc]]></wp:meta_key><wp:meta_value><![CDATA[Fallback description]]></wp:meta_value></wp:postmeta></item>
<item><title>Draft</title><link>https://georgemposi.com/draft/</link><wp:post_id>2</wp:post_id><wp:post_name>draft</wp:post_name><wp:status>draft</wp:status><wp:post_type>post</wp:post_type></item>
<item><title>Menu</title><link>https://georgemposi.com/menu/</link><wp:post_id>3</wp:post_id><wp:post_name>menu</wp:post_name><wp:status>publish</wp:status><wp:post_type>nav_menu_item</wp:post_type></item>
</channel></rss>`;

describe("WordPress WXR parsing", () => {
  it("imports only published posts and pages and preserves slugs", () => {
    const result = parseWxr(fixture);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].slug).toBe("published-story");
    expect(result.items[0].route).toBe("/published-story/");
  });

  it("maps attachments and resolves featured images", () => {
    const result = parseWxr(fixture);
    expect(result.attachments[0].localPath).toBe("/wp-content/uploads/2024/01/hero.jpg");
    expect(result.items[0].featuredImage).toBe("/wp-content/uploads/2024/01/hero.jpg");
    expect(result.items[0].featuredImageAlt).toBe("Quiet landscape");
  });

  it("prefers Rank Math SEO values over Yoast", () => {
    expect(parseWxr(fixture).items[0].seoDescription).toBe("Preferred description");
  });
});

describe("HTML migration", () => {
  it("normalizes internal links but leaves external links unchanged", () => {
    expect(normalizeInternalUrl("http://georgemposi.com/a/?x=1#b")).toBe("/a/?x=1#b");
    expect(normalizeInternalUrl("https://example.com/a/")).toBe("https://example.com/a/");
  });

  it("removes WordPress comments, scripts, and empty headings while preserving prose", () => {
    const result = cleanHtml('<!-- wp:paragraph --><h2> </h2><p class="wp-block-paragraph">Keep <strong>this</strong>.</p><script>alert(1)</script><!-- /wp:paragraph -->');
    expect(result.html).toContain("Keep <strong>this</strong>.");
    expect(result.html).not.toContain("wp:");
    expect(result.html).not.toContain("script");
    expect(result.html).not.toContain("<h2>");
  });

  it("removes a leading resized copy of the featured image", () => {
    const html = '<p><img src="/wp-content/uploads/2019/10/photo-1024x589.jpg" alt="Photo"></p><p>Keep this text.</p>';
    const result = removeDuplicateLeadingFeaturedImage(html, "/wp-content/uploads/2019/10/photo.jpg");
    expect(result).not.toContain("<img");
    expect(result).toContain("Keep this text.");
  });

  it("removes a leading title repeated with insignificant wording differences", () => {
    const result = removeDuplicateLeadingTitle("<h1>About My Quest For A Better Life</h1><p>Keep this introduction.</p>", "About my quest to better life");
    expect(result).not.toContain("<h1>");
    expect(result).toContain("Keep this introduction.");
  });
});
