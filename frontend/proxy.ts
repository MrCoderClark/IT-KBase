import { NextResponse, type NextRequest } from "next/server";
import { applySecurityHeaders, buildContentSecurityPolicy } from "@/lib/security/headers";

const SESSION_COOKIE = process.env.AUTH_COOKIE_NAME ?? "__Host-tb_session";

/** These /kb segments are app pages, not article slugs. */
const RESERVED = new Set(["drafts", "recent", "shared"]);

/**
 * Auth routes and the anonymous public-article rewrite target.
 * API routes stay out of this list — handlers enforce their own auth
 * (and cron uses a secret, not a browser session).
 */
function isPublicPath(pathname: string): boolean {
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (pathname === "/forgot-password" || pathname.startsWith("/forgot-password/")) {
    return true;
  }
  if (pathname === "/reset-password" || pathname.startsWith("/reset-password/")) {
    return true;
  }
  if (pathname === "/verify-email" || pathname.startsWith("/verify-email/")) {
    return true;
  }
  if (pathname.startsWith("/p/")) return true;
  if (pathname.startsWith("/api/")) return true;
  return false;
}

/**
 * Per-request CSP nonce + fixed security headers from 07-security.md.
 * Login wall and unsigned /kb/[slug] → /p/[slug] live here so `(app)/layout`
 * never has to `redirect()` for the common anonymous case (that pattern
 * false-triggers Cache Components instant-navigation validation in next
 * dev — vercel/next.js#98711 / #99998).
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = buildContentSecurityPolicy(nonce, isDev);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = nextOrGate(request, requestHeaders);
  applySecurityHeaders(response.headers, csp);
  return response;
}

function nextOrGate(request: NextRequest, requestHeaders: Headers): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  const article = pathname.match(/^\/kb\/([^/]+)$/);
  if (article) {
    const slug = decodeURIComponent(article[1] ?? "");
    if (!RESERVED.has(slug) && !hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = `/p/${slug}`;
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }
  }

  if (!hasSession && !isPublicPath(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    const dest = `${pathname}${request.nextUrl.search}`;
    if (dest && dest !== "/") {
      login.searchParams.set("next", dest);
    }
    return NextResponse.redirect(login);
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
