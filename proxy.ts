import { NextResponse, type NextRequest } from "next/server";
import { knownPartPaths } from "@/lib/parts/known-paths";

/** A path no route matches: rewriting to it renders the site's not-found page with status 404. */
const MISSING = "/__not-found__";

/**
 * Real 404s where a page-level `notFound()` would come too late (see `known-paths.ts`):
 *  - part pages whose slug is not in the catalog;
 *  - developer pages under /dev, unless running `next dev` or started with ENABLE_DEV_PAGES=1.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  const allowed =
    path === "/dev" || path.startsWith("/dev/")
      ? process.env.NODE_ENV === "development" || process.env.ENABLE_DEV_PAGES === "1"
      : knownPartPaths().has(path);
  if (allowed) return NextResponse.next();

  const response = NextResponse.rewrite(new URL(MISSING, request.url), { status: 404 });
  response.headers.set("x-robots-tag", "noindex");
  return response;
}

export const config = {
  // Detail pages only: the section index pages (/cpu, /gpu, ...) are ordinary static routes.
  matcher: ["/dev", "/dev/:path*", "/cpu/:slug", "/gpu/:path+", "/motherboard/:slug", "/psu/:slug"],
};
