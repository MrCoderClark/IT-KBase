"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { Search } from "lucide-react";
import type { Role } from "@/lib/auth/policy";
import type { ArticleStatus } from "@/lib/types/article";

export type PaletteArticle = {
  title: string;
  slug: string;
  status: ArticleStatus;
  category: string | null;
};

type PaletteContextValue = {
  openPalette: () => void;
  setRecent: (articles: PaletteArticle[]) => void;
};

const PaletteContext = createContext<PaletteContextValue | null>(null);

const CommandPaletteDialog = dynamic(
  () =>
    import("@/components/layout/command-palette-dialog").then((mod) => mod.CommandPaletteDialog),
  { ssr: false },
);

/**
 * Light shell provider: Ctrl+K listener only. cmdk UI loads on first open so
 * article pages are not blocked by the search dialog bundle.
 */
export function PaletteProvider({ children, role }: { children: ReactNode; role: Role }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [recent, setRecent] = useState<PaletteArticle[] | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key?.toLowerCase() !== "k") return;
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      setMounted(true);
      setOpen((current) => !current);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo<PaletteContextValue>(
    () => ({
      openPalette: () => {
        setMounted(true);
        setOpen(true);
      },
      setRecent,
    }),
    [],
  );

  return (
    <PaletteContext.Provider value={value}>
      {children}
      {mounted ? (
        <CommandPaletteDialog
          open={open}
          onOpenChange={setOpen}
          role={role}
          recent={recent}
        />
      ) : null}
    </PaletteContext.Provider>
  );
}

export function usePalette() {
  const value = useContext(PaletteContext);
  if (!value) {
    throw new Error("usePalette must be used inside PaletteProvider");
  }
  return value;
}

/** Pushes this person's recent articles into the palette without remounting it. */
export function PaletteArticleSync({ recent }: { recent: PaletteArticle[] }) {
  const { setRecent } = usePalette();
  useEffect(() => {
    setRecent(recent);
  }, [recent, setRecent]);
  return null;
}

export function SearchTrigger() {
  const { openPalette } = usePalette();
  return (
    <button
      type="button"
      onClick={openPalette}
      className="group flex h-10 w-full max-w-[640px] items-center gap-3 rounded-sm border border-white/[0.08] bg-white/[0.04] px-3.5 text-left text-[14px] leading-5 text-sidebar-fg/70 transition-colors hover:bg-white/[0.06] hover:text-sidebar-fg"
    >
      <Search size={16} className="shrink-0 text-sidebar-fg/60" aria-hidden />
      <span className="flex-1 truncate">
        Search for articles, keywords, or solutions…
      </span>
      <KbdChip>Ctrl</KbdChip>
      <span className="text-sidebar-fg/40">+</span>
      <KbdChip>K</KbdChip>
    </button>
  );
}

function KbdChip({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-xs border border-white/[0.10] bg-white/[0.06] px-1 font-sans text-[11px] font-semibold text-sidebar-fg/80">
      {children}
    </kbd>
  );
}
