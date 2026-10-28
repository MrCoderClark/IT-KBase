import { SearchTrigger } from "@/components/layout/command-palette";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import type { NotificationItem } from "@/lib/queries/notifications";

/**
 * Dark top bar spanning the main area, visually seamless with the sidebar
 * (same gradient top value). Height 64px, sticky.
 */
export function Topbar({
  name,
  role,
  email,
  avatarSrc,
  notifications,
  unreadCount,
}: {
  name: string;
  role: string;
  email: string;
  avatarSrc: string | null;
  notifications: NotificationItem[];
  unreadCount: number;
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
        <NotificationsBell items={notifications} unreadCount={unreadCount} />
        <ThemeToggle />
        <UserMenu name={name} role={role} email={email} avatarSrc={avatarSrc} />
      </div>
    </header>
  );
}
