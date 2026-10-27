"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SHARE_EVENT } from "@/components/kb/share-link-button";

const CHORD_MS = 1000;

export const SHORTCUTS_EVENT = "tb-shortcuts";

const SHORTCUTS = [
  { keys: ["Ctrl", "K"], sequence: false, label: "Search" },
  { keys: ["?"], sequence: false, label: "Show this list" },
  { keys: ["E"], sequence: false, label: "Edit this article" },
  { keys: ["S"], sequence: false, label: "Share this article" },
  { keys: ["P"], sequence: false, label: "Print this article" },
  { keys: ["J"], sequence: false, label: "Next section" },
  { keys: ["K"], sequence: false, label: "Previous section" },
  { keys: ["G", "A"], sequence: true, label: "All articles" },
  { keys: ["G", "H"], sequence: true, label: "Home" },
  { keys: ["G", "I"], sequence: true, label: "Import from file" },
] as const;

/**
 * Global shortcuts. Quiet while a field is focused or a dialog is open,
 * so the palette and the editor keep their keys.
 */
export function KeyboardShortcuts({ canImport = false }: { canImport?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingG = useRef(false);
  const chordTimer = useRef<number | null>(null);

  useEffect(() => {
    function openFromPalette() {
      setHelpOpen(true);
    }
    window.addEventListener(SHORTCUTS_EVENT, openFromPalette);
    return () => window.removeEventListener(SHORTCUTS_EVENT, openFromPalette);
  }, []);

  useEffect(() => {
    function clearChord() {
      pendingG.current = false;
      if (chordTimer.current !== null) {
        window.clearTimeout(chordTimer.current);
        chordTimer.current = null;
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (!event.key) return;

      const key = event.key.toLowerCase();
      const dialogOpen = document.querySelector("[data-slot=dialog-content]");
      const menuOpen = document.querySelector("[data-slot=dropdown-menu-content]");
      if (dialogOpen || menuOpen) {
        if (key === "?" && helpOpen) {
          event.preventDefault();
          setHelpOpen(false);
        }
        return;
      }

      if (pendingG.current) {
        clearChord();
        if (key === "a") {
          event.preventDefault();
          router.push("/kb");
        } else if (key === "h") {
          event.preventDefault();
          router.push("/");
        } else if (key === "i" && canImport) {
          event.preventDefault();
          router.push("/import");
        }
        return;
      }

      if (key === "g") {
        event.preventDefault();
        pendingG.current = true;
        chordTimer.current = window.setTimeout(clearChord, CHORD_MS);
        return;
      }

      if (key === "?") {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }

      const onArticle = Boolean(articleSlug(pathname));

      if (key === "e") {
        const slug = articleSlug(pathname);
        if (!slug) return;
        event.preventDefault();
        router.push(`/kb/${slug}/edit`);
        return;
      }

      if (key === "s") {
        if (!onArticle) return;
        event.preventDefault();
        // Prefer the Share button listener (updates its label). Fall back to clipboard.
        if (document.querySelector("[data-share-link]")) {
          window.dispatchEvent(new Event(SHARE_EVENT));
        } else {
          void navigator.clipboard.writeText(window.location.href).catch(() => undefined);
        }
        return;
      }

      if (key === "p") {
        if (!onArticle) return;
        event.preventDefault();
        window.print();
        return;
      }

      if (key === "j" || key === "k") {
        if (!onArticle) return;
        const moved = goToSection(key === "j" ? 1 : -1);
        if (moved) event.preventDefault();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearChord();
    };
  }, [canImport, helpOpen, pathname, router]);

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            These stay off while you are typing in a field. Share, print, and
            section keys work on an article page.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {SHORTCUTS.filter((row) => row.label !== "Import from file" || canImport).map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between gap-4"
            >
              <span className="text-[13px] leading-5 text-fg">{row.label}</span>
              <span className="flex items-center gap-1">
                {row.keys.map((key, index) => (
                  <span key={key} className="flex items-center gap-1">
                    {index > 0 ? (
                      <span className="text-[11px] text-fg-subtle">
                        {row.sequence ? "then" : "+"}
                      </span>
                    ) : null}
                    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-xs border border-border-strong bg-surface-muted px-1.5 font-sans text-[12px] font-semibold text-fg">
                      {key}
                    </kbd>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function articleSlug(pathname: string): string | null {
  const match = /^\/kb\/([^/]+)$/.exec(pathname);
  if (!match) return null;
  const slug = match[1];
  if (!slug || slug === "drafts" || slug === "recent" || slug === "shared") {
    return null;
  }
  return slug;
}

/** Scroll to the next (+1) or previous (−1) article section heading. */
function goToSection(delta: 1 | -1): boolean {
  const headings = Array.from(
    document.querySelectorAll<HTMLElement>("[data-article-sections] section[aria-labelledby] > div[id]"),
  );
  if (headings.length === 0) return false;

  const y = window.scrollY + 100;
  let index = headings.findIndex((el, i) => {
    const top = el.getBoundingClientRect().top + window.scrollY;
    const next = headings[i + 1];
    const nextTop = next
      ? next.getBoundingClientRect().top + window.scrollY
      : Number.POSITIVE_INFINITY;
    return y >= top - 4 && y < nextTop - 4;
  });
  if (index < 0) {
    index = delta > 0 ? -1 : headings.length;
  }

  const target = headings[index + delta];
  if (!target) return false;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}
