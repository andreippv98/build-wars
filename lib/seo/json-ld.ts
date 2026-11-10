import { SITE_NAME, absoluteUrl } from "@/lib/site";

/**
 * schema.org structured data. Build Wars has no prices and no reviews, so products carry no
 * `offers`, `review` or `aggregateRating`: only facts that identify and describe the part.
 */

export type JsonLd = Record<string, unknown>;

export function productJsonLd(product: {
  name: string;
  /** The maker: "AMD", "ASUS". A brand name identifies the part; no logos. */
  brand: string;
  /** Plain category: "Processor", "Graphics card". */
  category: string;
  description: string;
  path: string;
  /** Spec rows, emitted as `additionalProperty`. */
  specs: { name: string; value: string }[];
  /** For a board model: the chip page it is a variant of. */
  variantOfPath?: string;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    brand: { "@type": "Brand", name: product.brand },
    category: product.category,
    description: product.description,
    url: absoluteUrl(product.path),
    ...(product.variantOfPath
      ? { isVariantOf: { "@type": "ProductGroup", url: absoluteUrl(product.variantOfPath) } }
      : {}),
    additionalProperty: product.specs.map((spec) => ({
      "@type": "PropertyValue",
      name: spec.name,
      value: spec.value,
    })),
  };
}

export function breadcrumbJsonLd(trail: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function itemListJsonLd(list: {
  name: string;
  items: { name: string; path: string }[];
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: list.name,
    itemListElement: list.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
  };
}

/** Serialises structured data for a `<script type="application/ld+json">`, safe against `</script>`. */
export function jsonLdString(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
