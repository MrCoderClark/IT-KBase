export type ThemeMode = "light" | "dark";

export const THEME_EVENT = "tb-theme";

export function readThemeMode(): ThemeMode {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Writes the same `tb_theme` value the pre-paint script reads. */
export function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.dataset.theme = mode;
  try {
    localStorage.setItem("tb_theme", mode);
  } catch {
    /* storage disabled — the class still applies for this page */
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = readThemeMode() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
