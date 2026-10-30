/**
 * ASVS-oriented same-origin check for cookie-authenticated mutating routes.
 * Browser POSTs send Origin; cross-site form posts fail this check.
 * Cron / service callers that use a Bearer secret (no session) skip this helper.
 */

export function originMismatch(request: Request): string | null {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const origin = request.headers.get("origin");
  const hostHeader = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!hostHeader) return "Host header is required.";
  const host = hostHeader.split(",")[0]?.trim() ?? "";
  if (!host) return "Host header is required.";

  if (!origin) {
    // Non-browser clients should not use the session cookie on these routes.
    return "Origin header is required.";
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return "Origin is not a valid URL.";
  }

  if (originHost !== host) {
    return "Cross-origin request blocked.";
  }
  return null;
}

export function forbidBadOrigin(request: Request): Response | null {
  const reason = originMismatch(request);
  if (!reason) return null;
  return Response.json({ error: reason }, { status: 403 });
}
