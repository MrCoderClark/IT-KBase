"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChartColumn,
  FileText,
  FolderClosed,
  History,
  House,
  Keyboard,
  Moon,
  Plus,
  BookOpen,
  Sun,
  Tag,
  Upload,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { SearchSnippet } from "@/components/kb/search-snippet";
import { SHORTCUTS_EVENT } from "@/components/layout/keyboard-shortcuts";
import type { PaletteArticle } from "@/components/layout/command-palette";
import { can, canReadArticleAnalytics, type Role } from "@/lib/auth/policy";
import type { SearchHit } from "@/lib/queries/search";
import { readThemeMode, THEME_EVENT, toggleTheme, type ThemeMode } from "@/lib/theme";
import type { ArticleStatus } from "@/lib/types/article";

const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/kb", label: "All Articles", icon: BookOpen },
  { href: "/kb/drafts", label: "My Drafts", icon: BookOpen },
  { href: "/kb/recent", label: "Recently Updated", icon: BookOpen },
  { href: "/kb/shared", label: "Shared With Me", icon: BookOpen },
  { href: "/categories", label: "Categories", icon: FolderClosed },
  { href: "/tags", label: "Tags", icon: Tag },
] as const;

const STATUS_LABEL: Record<ArticleStatus, string> = {
  published: "Published",
  draft: "Draft",
  in_review: "In Review",
  archived: "Archived",
};

/** cmdk dialog — loaded only after Ctrl+K / search open (keeps article TBT down). */
export function CommandPaletteDialog({
  open,
  onOpenChange,
  role,
  recent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
  recent: PaletteArticle[] | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [theme, setTheme] = useState<ThemeMode | null>(null);

  useEffect(() => {
    function syncTheme() {
      setTheme(readThemeMode());
    }
    syncTheme();
    window.addEventListener(THEME_EVENT, syncTheme);
    return () => window.removeEventListener(THEME_EVENT, syncTheme);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setHits(null);
    }
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=8`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { hits: [] }))
        .then((body: { hits?: SearchHit[] }) => {
          if (!controller.signal.aborted) setHits(body.hits ?? []);
        })
        .catch(() => {
          if (!controller.signal.aborted) setHits([]);
        });
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  function showShortcuts() {
    onOpenChange(false);
    window.setTimeout(() => {
      window.dispatchEvent(new Event(SHORTCUTS_EVENT));
    }, 0);
  }

  const searching = query.trim().length >= 2;
  const needle = query.trim().toLowerCase();
  function matches(label: string) {
    return !searching || label.toLowerCase().includes(needle);
  }

  const themeLabel = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const actions = [
    can(role, "article.create")
      ? { id: "create", label: "Create article", icon: Plus, run: () => go("/create") }
      : null,
    can(role, "article.create")
      ? { id: "import", label: "Import from file", icon: Upload, run: () => go("/import") }
      : null,
    { id: "theme", label: themeLabel, icon: ThemeIcon, run: () => toggleTheme() },
    { id: "shortcuts", label: "Keyboard shortcuts", icon: Keyboard, run: showShortcuts },
    canReadArticleAnalytics(role)
      ? { id: "analytics", label: "Analytics", icon: ChartColumn, run: () => go("/analytics") }
      : null,
  ].filter(
    (item): item is { id: string; label: string; icon: typeof Plus; run: () => void } =>
      item !== null && matches(item.label),
  );
  const pages = NAV.filter((item) => matches(item.label));

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search TechBase"
      description="Find an article or jump to a page"
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search articles, keywords, or pages…"
          onValueChange={(value) => {
            setQuery(value);
            if (value.trim().length < 2) setHits(null);
          }}
        />
        <CommandList>
          <CommandEmpty>No matches.</CommandEmpty>
          {searching ? (
            <CommandGroup heading="Articles">
              {hits === null ? (
                <p className="px-2 py-2 text-[13px] leading-5 text-fg-subtle">Searching…</p>
              ) : hits.length === 0 ? (
                <p className="px-2 py-2 text-[13px] leading-5 text-fg-subtle">
                  No articles match. Try a broader word.
                </p>
              ) : (
                hits.map((hit) => (
                  <CommandItem key={hit.slug} value={hit.slug} onSelect={() => go(`/kb/${hit.slug}`)}>
                    <FileText className="text-fg-subtle" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-fg">{hit.title}</span>
                      <SearchSnippet snippet={hit.snippet} />
                    </span>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          ) : (
            <CommandGroup heading="Recent">
              {recent === null ? (
                <p className="px-2 py-2 text-[13px] leading-5 text-fg-subtle">Loading…</p>
              ) : recent.length === 0 ? (
                <p className="px-2 py-2 text-[13px] leading-5 text-fg-subtle">
                  Articles you open or edit show up here.
                </p>
              ) : (
                recent.map((article) => (
                  <CommandItem key={article.slug} value={article.slug} onSelect={() => go(`/kb/${article.slug}`)}>
                    <History className="text-fg-subtle" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-fg">{article.title}</span>
                      <span className="block truncate text-[12px] leading-4 text-fg-subtle">
                        {[article.category, STATUS_LABEL[article.status]].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          )}
          {actions.length > 0 ? (
            <CommandGroup heading="Actions">
              {actions.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem key={item.id} value={item.label} onSelect={item.run}>
                    <Icon className="text-fg-subtle" aria-hidden />
                    <span className="font-medium text-fg">{item.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ) : null}
          {pages.length > 0 ? (
            <CommandGroup heading="Go to">
              {pages.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem key={item.href} value={item.label} onSelect={() => go(item.href)}>
                    <Icon className="text-fg-subtle" aria-hidden />
                    <span className="font-medium text-fg">{item.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
