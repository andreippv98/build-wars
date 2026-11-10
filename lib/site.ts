/** Site-wide constants. */
export const SITE_NAME = "Build Wars";
export const SITE_TAGLINE = "PC build configurator";

/** Public origin of the site, without a trailing slash. Set NEXT_PUBLIC_SITE_URL in production. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** Absolute URL of a path on this site (`/cpu/x` -> `https://.../cpu/x`). */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
