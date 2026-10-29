/** Preset chip colors for category admin. Null in the DB means brand accent. */
export const CATEGORY_COLOR_PRESETS = [
  { label: "Cobalt", value: "#1E6BFF" },
  { label: "Teal", value: "#0D9488" },
  { label: "Emerald", value: "#059669" },
  { label: "Amber", value: "#D97706" },
  { label: "Rose", value: "#E11D48" },
  { label: "Violet", value: "#7C3AED" },
  { label: "Slate", value: "#475569" },
] as const;

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match?.[1]) return null;
  const n = Number.parseInt(match[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** Soft fill from a hex chip color for tinted pills. */
export function categorySoftBackground(hex: string, alpha = 0.14): string | null {
  const rgb = parseHexRgb(hex);
  if (!rgb) return null;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Darken a category hex for 12px label text on `categorySoftBackground`.
 * Bright preset hues (e.g. teal #0D9488) fail AA on the soft tint as-is.
 */
export function categoryLabelColor(hex: string): string | null {
  const rgb = parseHexRgb(hex);
  if (!rgb) return null;
  const factor = 0.58;
  return toHex({
    r: Math.max(0, Math.round(rgb.r * factor)),
    g: Math.max(0, Math.round(rgb.g * factor)),
    b: Math.max(0, Math.round(rgb.b * factor)),
  });
}
