"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  FileText,
  FolderClosed,
  House,
  Plus,
  Search,
  Tag,
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
import { can, type Role } from "@/lib/auth/policy";
import type { SearchHit } from "@/lib/queries/search";
import type { ArticleStatus } from "@/lib/types/article";

export type PaletteArticle = {
  title: string;
  slug: string;
  status: ArticleStatus;
  category: string | null;
  tags: string[];
};

const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/kb", label: "All Articles", icon: BookOpen },
  { href: "/kb/drafts", label: "My Drafts", icon: BookOpen },
  { href: "/kb/recent", label: "Recently Updated", icon: BookOpen },
  { href: "/kb/shared", label: "Shared With Me", icon: BookOpen },
  { href: "/create", label: "Create Article", icon: Plus },
  { href: "/categories", label: "Categories", icon: FolderClosed },
  { href: "/tags", label: "Tags", icon: Tag },
] as const;

const STATUS_LABEL: Record<ArticleStatus, string> = {
  published: "Published",
  draft: "Draft",
  in_review: "In Review",
  archived: "Archived",
};

type PaletteContextValue = {
  openPalette: () => void;
  setArticles: (articles: PaletteArticle[]) => void;
  articles: PaletteArticle[] | null;
};

const PaletteContext = createContext<PaletteContextValue | null>(null);

export function PaletteProvider({ children, role }: { children: ReactNode; role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [articles, setArticles] = useState<PaletteArticle[] | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key?.toLowerCase() !== "k") return;
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      setOpen((current) => !current);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

  const value = useMemo<PaletteContextValue>(
    () => ({
      openPalette: () => setOpen(true),
      setArticles,
      articles,
    }),
    [articles],
  );

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <PaletteContext.Provider value={value}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
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
            <CommandGroup heading="Articles">
              {query.trim().length >= 2 ? (
                hits === null ? (
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
                )
              ) : articles === null ? (
                <p className="px-2 py-2 text-[13px] leading-5 text-fg-subtle">
                  Loading articles…
                </p>
              ) : (
                articles.map((article) => (
                  <CommandItem
                    key={article.slug}
                    value={[
                      article.title,
                      article.category,
                      ...article.tags,
                      article.slug,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onSelect={() => go(`/kb/${article.slug}`)}
                  >
                    <FileText className="text-fg-subtle" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-fg">
                        {article.title}
                      </span>
                      <span className="block truncate text-[12px] leading-4 text-fg-subtle">
                        {[article.category, STATUS_LABEL[article.status]]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
            <CommandGroup heading="Go to">
              {NAV.filter((item) => item.href !== "/create" || can(role, "article.create"))
                .filter((item) => query.trim().length < 2 || item.label.toLowerCase().includes(query.trim().toLowerCase()))
                .map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    value={item.label}
                    onSelect={() => go(item.href)}
                  >
                    <Icon className="text-fg-subtle" aria-hidden />
                    <span className="font-medium text-fg">{item.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
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

/** Pushes server-loaded articles into the palette without remounting it. */
export function PaletteArticleSync({ articles }: { articles: PaletteArticle[] }) {
  const { setArticles } = usePalette();
  useEffect(() => {
    setArticles(articles);
  }, [articles, setArticles]);
  return null;
}

export function SearchTrigger() {
  const { openPalette } = usePalette();
  return (
    <button
      type="button"
      onClick={openPalette}
      aria-label="Search articles, keywords, or solutions"
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
