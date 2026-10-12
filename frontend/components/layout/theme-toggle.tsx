"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "light" | "dark";

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

  // Sync local state with whatever the pre-paint script decided.
  useEffect(() => {
    const current =
      document.documentElement.classList.contains("dark") ? "dark" : "light";
    setMode(current);
  }, []);

  const toggle = () => {
    const next: Mode = mode === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("tb_theme", next);
    } catch {
      /* storage disabled — toggle still works for the session */
    }
    setMode(next);
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
