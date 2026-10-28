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

/** Soft fill from a hex chip color for tinted pills. */
export function categorySoftBackground(hex: string, alpha = 0.14): string | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match?.[1]) return null;
  const n = Number.parseInt(match[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
