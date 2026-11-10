import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/catalog/server";
import { sitemapEntries } from "@/lib/seo/sitemap";
import { absoluteUrl } from "@/lib/site";

/**
 * Generated from the catalog. There is no `lastModified`: parts have no per-record date, and a
 * made-up one would mislead crawlers. Public saved builds will be added through
 * `publicBuildPaths` (public builds only) when they exist.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await getCatalog();
  return sitemapEntries(catalog).map((entry) => ({
    url: absoluteUrl(entry.path),
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
