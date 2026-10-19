export const DEFAULT_ACCENT = "#1E6BFF";
export const DEFAULT_VERSION_RETENTION_DAYS = 365;
export const SITE_SETTING_ID = "default";

const ACCENT = /^#[0-9A-Fa-f]{6}$/;
const DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export type SiteSettings = {
  accentHex: string;
  logoUrl: string | null;
  versionRetentionDays: number;
  allowedEmailDomains: string[];
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  accentHex: DEFAULT_ACCENT,
  logoUrl: null,
  versionRetentionDays: DEFAULT_VERSION_RETENTION_DAYS,
  allowedEmailDomains: [],
};

export function parseAccent(raw: string): string | null {
  const value = raw.trim();
  if (!ACCENT.test(value)) return null;
  return value.toUpperCase();
}

export function parseRetentionDays(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const days = Number(raw);
  if (days < 30 || days > 3650) return null;
  return days;
}

export function parseLogoUrl(raw: string): { ok: true; logoUrl: string | null } | { ok: false } {
  const value = raw.trim();
  if (!value) return { ok: true, logoUrl: null };
  if (value.length > 500) return { ok: false };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false };
  return { ok: true, logoUrl: url.toString() };
}

export function parseEmailDomains(raw: string): { ok: true; domains: string[] } | { ok: false } {
  const parts = raw
    .split(/[\s,]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const domains = [...new Set(parts)];
  if (domains.length > 20) return { ok: false };
  if (domains.some((domain) => domain.length > 253 || !DOMAIN.test(domain))) return { ok: false };
  return { ok: true, domains };
}

export function accentTokens(hex: string): { accent: string; hover: string; soft: string; ring: string } {
  const parsed = parseAccent(hex) ?? DEFAULT_ACCENT;
  const n = Number.parseInt(parsed.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const darken = (channel: number) => Math.max(0, Math.round(channel * 0.88));
  const toHex = (red: number, green: number, blue: number) =>
    `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  return {
    accent: parsed,
    hover: toHex(darken(r), darken(g), darken(b)),
    soft: `rgba(${r}, ${g}, ${b}, 0.12)`,
    ring: `rgba(${r}, ${g}, ${b}, 0.45)`,
  };
}
