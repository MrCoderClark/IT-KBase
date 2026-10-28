/**
 * Response headers from Docs/specs/07-security.md §6.
 * CSP uses a per-request nonce (set by proxy.ts) plus 'strict-dynamic'.
 * The theme boot script is allowed by sha256 so the root layout never calls
 * headers() (that blocked prerender under cacheComponents).
 */

import { THEME_INIT_SCRIPT_SHA256 } from "./theme-init-script";

export function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    THEME_INIT_SCRIPT_SHA256,
    "'strict-dynamic'",
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
