import { Bell, ChevronDown, Search } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";

/**
 * Dark top bar spanning the main area, visually seamless with the sidebar
 * (same gradient top value). Height 64px, sticky.
 *
 * Pass B is visual-only:
 *   - Search is a non-functional disclosure (opens the command palette later).
 *   - Bell has a static unread count badge.
 *   - Theme toggle is wired.
 *   - User menu is static (opens a dropdown in a later pass).
 */
export function Topbar() {
  return (
    <header
      className="sticky top-0 z-10 flex h-16 items-center gap-4 px-6"
      style={{
        background:
          "linear-gradient(180deg, var(--sidebar-bg-top), #0C1324)",
      }}
    >
      {/* Search */}
      <div className="flex min-w-0 flex-1 justify-center">
        <SearchDisclosure />
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-1.5">
        <NotificationsBell count={3} />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}

function SearchDisclosure() {
  return (
    <button
      type="button"
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

function KbdChip({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-xs border border-white/[0.10] bg-white/[0.06] px-1 font-sans text-[11px] font-semibold text-sidebar-fg/80">
      {children}
    </kbd>
  );
}

function NotificationsBell({ count }: { count: number }) {
  return (
    <button
      type="button"
      aria-label={`Notifications (${count} unread)`}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-sm text-sidebar-fg/90 transition-colors hover:bg-white/[0.06] hover:text-white"
    >
      <Bell size={18} aria-hidden />
      {count > 0 ? (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold tabular-nums text-white ring-2"
          style={{ boxShadow: "0 0 0 2px #0F172A" }}
        >
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </button>
  );
}

function UserMenu() {
  return (
    <button
      type="button"
      aria-label="Account menu for Joe Clark"
      className="ml-1 inline-flex h-10 items-center gap-2.5 rounded-sm pl-1 pr-2 text-left transition-colors hover:bg-white/[0.06]"
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-white">
        JC
      </span>
      <span className="hidden min-w-0 sm:block">
        <span className="block truncate text-[13px] leading-4 font-semibold text-white">
          Joe Clark
        </span>
        <span className="block truncate text-[11px] leading-4 text-sidebar-fg/70">
          IT Administrator
        </span>
      </span>
      <ChevronDown
        size={16}
        className="hidden shrink-0 text-sidebar-fg/60 sm:block"
        aria-hidden
      />
    </button>
  );
}
