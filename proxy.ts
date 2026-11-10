import { NextResponse, type NextRequest } from "next/server";

/**
 * Developer-only pages under /dev (the model test page) do not exist on the public site:
 * they answer 404 unless running `next dev` or started with ENABLE_DEV_PAGES=1.
 * The pages also guard themselves; this makes the status code a real 404.
 */
export function proxy(request: NextRequest) {
  void request;
  if (process.env.NODE_ENV === "development" || process.env.ENABLE_DEV_PAGES === "1") {
    return NextResponse.next();
  }
  return new NextResponse("Not found", { status: 404, headers: { "x-robots-tag": "noindex" } });
}

export const config = { matcher: ["/dev", "/dev/:path*"] };
