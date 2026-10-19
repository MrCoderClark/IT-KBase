"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyTheme, readThemeMode, THEME_EVENT, type ThemeMode } from "@/lib/theme";

type Mode = ThemeMode;

/**
 * Minimal theme toggle — reads/writes `tb_theme` in localStorage and toggles
 * `class="dark"` on <html>. The initial resolution happens pre-paint via
 * the inline script in app/layout.tsx (no FOUC).
 *
 * Later we'll add a 3-state menu (light / dark / system). This single-click
 * toggle is enough for the shell shakedown.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    function sync() {
      setMode(readThemeMode());
    }
    sync();
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);

  const toggle = () => {
    const next: Mode = mode === "dark" ? "light" : "dark";
    applyTheme(next);
  };

  const isDark = mode === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-sm text-sidebar-fg/90 transition-colors hover:bg-white/[0.06] hover:text-white",
        className,
      )}
    >
      {/* Render both and toggle visibility to avoid layout shift on hydration */}
      <Sun
        size={18}
        className={cn(
          "transition-opacity",
          mode === null || !isDark ? "opacity-100" : "opacity-0 absolute",
        )}
        aria-hidden
      />
      <Moon
        size={18}
        className={cn(
          "transition-opacity",
          isDark ? "opacity-100" : "opacity-0 absolute",
        )}
        aria-hidden
      />
    </button>
  );
}
