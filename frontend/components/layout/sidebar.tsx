"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ComponentType } from "react";
import {
  BookOpen,
  ChartColumn,
  ChevronDown,
  FolderClosed,
  House,
  Plus,
  Puzzle,
  Settings,
  Sparkles,
  Tag,
  Upload,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand/brand-mark";
import { SidebarUploadCta } from "@/components/layout/sidebar-upload-cta";

export type KbNavCounts = {
  all: number;
  drafts: number;
  shared: number;
  recent: number;
};

type NavChild = {
  href: string;
  label: string;
  count?: number;
};

type NavItem = {
  href?: string;
  label: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  badge?: "new";
  children?: NavChild[];
};

const KB_LIST_ROUTES = new Set(["/kb/drafts", "/kb/shared", "/kb/recent"]);

function kbChildren(counts?: KbNavCounts): NavChild[] {
  return [
    { href: "/kb", label: "All Articles", count: counts?.all },
    { href: "/kb/drafts", label: "My Drafts", count: counts?.drafts },
    { href: "/kb/shared", label: "Shared With Me", count: counts?.shared },
    { href: "/kb/recent", label: "Recently Updated", count: counts?.recent },
  ];
}

const PRIMARY: NavItem[] = [
  { href: "/", label: "Home", icon: House },
  {
    label: "Knowledge Base",
    icon: BookOpen,
  },
  { href: "/create", label: "Create Article", icon: Plus },
  { href: "/categories", label: "Categories", icon: FolderClosed },
  { href: "/tags", label: "Tags", icon: Tag },
  { href: "/assistant", label: "AI Assistant", icon: Sparkles, badge: "new" },
  { href: "/import", label: "Import from File", icon: Upload },
  { href: "/analytics", label: "Analytics", icon: ChartColumn },
];

const ADMIN: NavItem[] = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/integrations", label: "Integrations", icon: Puzzle },
];

function isActive(pathname: string, href?: string) {
  if (!href) return false;
  if (href === "/") return pathname === "/";
  if (href === "/kb") {
    if (pathname === "/kb") return true;
    if (KB_LIST_ROUTES.has(pathname)) return false;
    return pathname.startsWith("/kb/");
  }
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ counts }: { counts?: KbNavCounts }) {
  const pathname = usePathname();
  const items = PRIMARY.map((item) =>
    item.label === "Knowledge Base" ? { ...item, children: kbChildren(counts) } : item,
  );

  return (
    <aside
      className="sticky top-0 flex h-screen w-[280px] shrink-0 flex-col"
      style={{
        background:
          "linear-gradient(180deg, var(--sidebar-bg-top), var(--sidebar-bg-bot))",
      }}
    >
      {/* Brand */}
      <div className="flex shrink-0 items-center gap-3 px-5 pt-5 pb-6">
        <BrandMark size={36} title="TechBase" />
        <div className="min-w-0">
          <div className="text-[18px] leading-6 font-semibold text-white">
            TechBase
          </div>
          <div className="text-[11px] leading-4 font-medium tracking-[0.04em] text-sidebar-fg/70">
            IT Knowledge Hub
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3">
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => (
            <NavRow key={item.label} item={item} pathname={pathname} />
          ))}
        </ul>

        <div className="mt-6 px-3 pb-2 text-[11px] font-semibold tracking-[0.08em] uppercase text-sidebar-fg/50">
          Admin
        </div>
        <ul className="flex flex-col gap-0.5">
          {ADMIN.map((item) => (
            <NavRow key={item.label} item={item} pathname={pathname} />
          ))}
        </ul>
      </nav>

      {/* Upload CTA pinned to bottom */}
      <div className="shrink-0 p-4">
        <SidebarUploadCta />
      </div>
    </aside>
  );
}

function NavRow({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const hasChildren = Boolean(item.children?.length);
  const childActive = useMemo(
    () => item.children?.some((c) => isActive(pathname, c.href)) ?? false,
    [item.children, pathname],
  );
  const [open, setOpen] = useState<boolean>(childActive);
  const active = isActive(pathname, item.href) || (hasChildren && childActive);

  const rowBase =
    "group relative flex h-10 w-full items-center gap-3 rounded-sm px-3 text-[14px] leading-5 font-medium transition-colors";

  const rowState = active
    ? "bg-sidebar-active text-white"
    : "text-sidebar-fg hover:bg-white/[0.04] hover:text-white";

  const activeBar = active ? (
    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-sm bg-sidebar-active-border" />
  ) : null;

  if (hasChildren) {
    return (
      <li>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cn(rowBase, rowState)}
        >
          {activeBar}
          <Icon size={18} className="shrink-0 opacity-90" />
          <span className="flex-1 truncate text-left">{item.label}</span>
          <ChevronDown
            size={16}
            className={cn(
              "shrink-0 opacity-70 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>

        {open ? (
          <ul className="relative mt-0.5 ml-6 flex flex-col gap-0.5 border-l border-white/[0.08] pl-3">
            {item.children!.map((child) => {
              const isChildActive = isActive(pathname, child.href);
              return (
                <li key={child.href}>
                  <Link
                    href={child.href}
                    className={cn(
                      "flex h-9 items-center gap-2 rounded-sm px-2.5 text-[13px] leading-5 font-medium transition-colors",
                      isChildActive
                        ? "bg-sidebar-active text-white"
                        : "text-sidebar-fg/90 hover:bg-white/[0.04] hover:text-white",
                    )}
                  >
                    <span className="flex-1 truncate">{child.label}</span>
                    {typeof child.count === "number" ? (
                      <span
                        className={cn(
                          "tabular-nums text-[11px] font-semibold",
                          isChildActive
                            ? "text-white/90"
                            : "text-sidebar-fg/60",
                        )}
                      >
                        {child.count}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <li>
      <Link href={item.href!} className={cn(rowBase, rowState)}>
        {activeBar}
        <Icon size={18} className="shrink-0 opacity-90" />
        <span className="flex-1 truncate">{item.label}</span>
        {item.badge === "new" ? (
          <span className="rounded-full bg-accent/90 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase text-white">
            New
          </span>
        ) : null}
      </Link>
    </li>
  );
}
