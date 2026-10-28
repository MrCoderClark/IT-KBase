import { NextResponse, type NextRequest } from "next/server";
import { buildContentSecurityPolicy, SECURITY_HEADERS } from "@/lib/security/headers";

const SESSION_COOKIE = process.env.AUTH_COOKIE_NAME ?? "__Host-tb_session";

/** These /kb segments are app pages, not article slugs. */
const RESERVED = new Set(["drafts", "recent", "shared"]);

/**
 * Per-request CSP nonce + fixed security headers from 07-security.md.
 * Also rewrites unsigned /kb/[slug] reads to the public article page.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = buildContentSecurityPolicy(nonce, isDev);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = nextOrPublicRewrite(request, requestHeaders);

  response.headers.set("Content-Security-Policy", csp);
  for (const header of SECURITY_HEADERS) {
    response.headers.set(header.key, header.value);
  }

  return response;
}

function nextOrPublicRewrite(request: NextRequest, requestHeaders: Headers): NextResponse {
  const { pathname } = request.nextUrl;
  const match = pathname.match(/^\/kb\/([^/]+)$/);
  if (match) {
    const slug = decodeURIComponent(match[1] ?? "");
    if (!RESERVED.has(slug) && !request.cookies.get(SESSION_COOKIE)?.value) {
      const url = request.nextUrl.clone();
      url.pathname = `/p/${slug}`;
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }
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
