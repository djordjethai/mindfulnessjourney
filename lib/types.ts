export type ContentType = "post" | "page";

export type ContentItem = {
  id: number;
  type: ContentType;
  title: string;
  slug: string;
  date: string;
  modified?: string;
  author?: string;
  excerpt?: string;
  contentHtml: string;
  categories: string[];
  categorySlugs: string[];
  tags: string[];
  tagSlugs: string[];
  featuredImageId?: number;
  featuredImage?: string;
  featuredImageAlt?: string;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
  canonical?: string;
  oldUrl: string;
  route: string;
};

export type Category = {
  name: string;
  slug: string;
  descriptionHtml: string;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
};

export type Attachment = {
  id: number;
  sourceUrl: string;
  localPath?: string;
  alt?: string;
  title?: string;
};

export type InternalLinkIssue = {
  source: string;
  href: string;
  reason: string;
};
