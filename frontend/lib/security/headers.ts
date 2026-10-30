/**
 * Response headers from Docs/specs/07-security.md §6.
 * CSP uses a per-request nonce (set by proxy.ts).
 *
 * We intentionally omit 'strict-dynamic' for now: Next.js 16 still emits some
 * Suspense/boundary and Turbopack chunk <script src> tags without the request
 * nonce (vercel/next.js#98015). With 'strict-dynamic', host allowlisting is
 * disabled so those chunks are blocked → console/CSP Best Practices failures.
 * 'self' keeps same-origin bundles; theme + React $RT boots stay hash-pinned.
 */

import { REACT_RT_BOOT_SCRIPT_SHA256 } from "./react-boot-script";
import { THEME_INIT_SCRIPT_SHA256 } from "./theme-init-script";

export function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    THEME_INIT_SCRIPT_SHA256,
    REACT_RT_BOOT_SCRIPT_SHA256,
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].join(" ");

  // Browser PUT to MinIO/S3 uses https (or local :9000). Ingestion is server-side.
  const connectSrc = [
    "'self'",
    "http://127.0.0.1:9000",
    "http://localhost:9000",
    "http://127.0.0.1:8080",
    "http://localhost:8080",
    "https:",
  ].join(" ");

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];

  return directives.join("; ");
}

export const SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
];

/** Apply CSP + fixed headers onto a response (used by `proxy.ts`). */
export function applySecurityHeaders(
  headers: { set(name: string, value: string): void },
  csp: string,
): void {
  headers.set("Content-Security-Policy", csp);
  for (const header of SECURITY_HEADERS) {
    headers.set(header.key, header.value);
  }
}
