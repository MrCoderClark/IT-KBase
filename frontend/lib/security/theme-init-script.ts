import { createHash } from "node:crypto";

/**
 * Blocking inline script to resolve the theme before paint.
 * Kept as one exact string so CSP can allow it by sha256 hash (no headers()
 * in the root layout — that blocks prerender under cacheComponents).
 */
export const THEME_INIT_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem('tb_theme');
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var mode = stored === 'light' || stored === 'dark'
      ? stored
      : (systemDark ? 'dark' : 'light');
    if (mode === 'dark') document.documentElement.classList.add('dark');
    document.documentElement.dataset.theme = mode;
  } catch (_) { /* no-op */ }
})();`;

export const THEME_INIT_SCRIPT_SHA256 =
  `'sha256-${createHash("sha256").update(THEME_INIT_SCRIPT, "utf8").digest("base64")}'`;
