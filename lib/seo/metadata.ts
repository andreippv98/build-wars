import type { Metadata } from "next";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

/**
 * Metadata of a public page: a unique title and description, the canonical URL and Open Graph /
 * Twitter cards. `title` is the page's own part ("AMD Ryzen 7 9800X3D specs and Build Score");
 * the root layout appends the site name.
 */
export function pageMetadata(page: {
  title: string;
  description: string;
  /** Path of the page, e.g. `/cpu/ryzen-7-9800x3d`. */
  path: string;
  /** False keeps a page out of search results. */
  index?: boolean;
}): Metadata {
  const url = absoluteUrl(page.path);
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    robots: page.index === false ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: page.title,
      description: page.description,
      url,
    },
    twitter: { card: "summary", title: page.title, description: page.description },
  };
}

/** Trims text to a meta-description length at a word boundary. */
export function metaDescription(text: string, max = 158): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 30)).replace(/[\s,;:.]+$/, "")}…`;
}
