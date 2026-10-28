import { Bell } from "lucide-react";
import { SearchTrigger } from "@/components/layout/command-palette";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";

/**
 * Dark top bar spanning the main area, visually seamless with the sidebar
 * (same gradient top value). Height 64px, sticky.
 *
 *   - Search opens the command palette. Ctrl+K does the same from any screen.
 *   - Bell has a static unread count badge.
 *   - Theme toggle is wired.
 *   - Avatar opens a menu (Profile, shortcuts, security, sign out). Gravatar when set.
 */
export function Topbar({
  name,
  role,
  email,
  avatarSrc,
}: {
  name: string;
  role: string;
  email: string;
  avatarSrc: string | null;
}) {
  return (
    <header
      className="sticky top-0 z-10 flex h-16 items-center gap-4 px-6"
      style={{
        background:
          "linear-gradient(180deg, var(--sidebar-bg-top), #0C1324)",
      }}
    >
      <div className="flex min-w-0 flex-1 justify-center">
        <SearchTrigger />
      </div>

      <div className="flex items-center gap-1.5">
        <NotificationsBell count={3} />
        <ThemeToggle />
        <UserMenu name={name} role={role} email={email} avatarSrc={avatarSrc} />
      </div>
    </header>
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
