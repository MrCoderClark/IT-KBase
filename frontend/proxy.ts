import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = process.env.AUTH_COOKIE_NAME ?? "__Host-tb_session";

/** These /kb segments are app pages, not article slugs. */
const RESERVED = new Set(["drafts", "recent", "shared"]);

/**
 * Signed-in article reads stay on /kb/[slug] inside the app layout, so
 * Next.js can navigate without remounting the sidebar.
 * With no session, rewrite that URL to the public article page.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const match = pathname.match(/^\/kb\/([^/]+)$/);
  if (!match) return NextResponse.next();

  const slug = decodeURIComponent(match[1] ?? "");
  if (RESERVED.has(slug)) return NextResponse.next();
  if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/p/${slug}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/kb/:slug"],
};
