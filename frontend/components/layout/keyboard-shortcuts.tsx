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

const CHORD_MS = 1000;

const SHORTCUTS = [
  { keys: ["Ctrl", "K"], sequence: false, label: "Search" },
  { keys: ["?"], sequence: false, label: "Show this list" },
  { keys: ["E"], sequence: false, label: "Edit this article" },
  { keys: ["G", "A"], sequence: true, label: "All articles" },
  { keys: ["G", "H"], sequence: true, label: "Home" },
] as const;

/**
 * Global shortcuts. Quiet while a field is focused or a dialog is open,
 * so the palette and the editor keep their keys.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingG = useRef(false);
  const chordTimer = useRef<number | null>(null);

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

      const key = event.key.toLowerCase();
      const dialogOpen = document.querySelector("[data-slot=dialog-content]");
      if (dialogOpen) {
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

      if (key === "e") {
        const slug = articleSlug(pathname);
        if (!slug) return;
        event.preventDefault();
        router.push(`/kb/${slug}/edit`);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearChord();
    };
  }, [helpOpen, pathname, router]);

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            These stay off while you are typing in a field.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {SHORTCUTS.map((row) => (
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

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}
