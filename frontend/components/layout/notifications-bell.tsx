"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import {
  notificationKindLabel,
  type NotificationItem,
} from "@/lib/queries/notifications";

export function NotificationsBell({
  items,
  unreadCount,
}: {
  items: NotificationItem[];
  unreadCount: number;
}) {
  const router = useRouter();

  async function onOpenItem(item: NotificationItem) {
    if (!item.readAt) await markNotificationRead(item.id);
    if (item.href) router.push(item.href);
    else router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : "Notifications"
        }
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-sm text-sidebar-fg/90 outline-none transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-accent data-popup-open:bg-white/[0.06] data-popup-open:text-white"
      >
        <Bell size={18} aria-hidden />
        {unreadCount > 0 ? (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold tabular-nums text-white ring-2"
            style={{ boxShadow: "0 0 0 2px #0F172A" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[340px] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <p className="text-[13px] font-semibold text-fg">Notifications</p>
          {unreadCount > 0 ? (
            <button
              type="button"
              className="text-[12px] font-semibold text-accent hover:underline"
              onClick={() => void markAllNotificationsRead().then(() => router.refresh())}
            >
              Mark all read
            </button>
          ) : null}
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-fg-subtle">
            You are caught up. Imports and review requests show up here.
          </p>
        ) : (
          <ul className="max-h-[360px] overflow-y-auto py-1">
            {items.map((item) => (
              <li key={item.id}>
                {item.href ? (
                  <DropdownMenuItem
                    className="cursor-pointer items-start gap-2 px-3 py-2.5"
                    onClick={() => void onOpenItem(item)}
                  >
                    <NotificationRow item={item} />
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="cursor-pointer items-start gap-2 px-3 py-2.5"
                    onClick={() => void onOpenItem(item)}
                  >
                    <NotificationRow item={item} />
                  </DropdownMenuItem>
                )}
              </li>
            ))}
          </ul>
        )}
        <DropdownMenuSeparator className="my-0" />
        <div className="px-3 py-2">
          <Link
            href="/kb/shared"
            className="text-[12px] font-semibold text-fg-muted hover:text-accent"
          >
            Shared with me
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationRow({ item }: { item: NotificationItem }) {
  const unread = !item.readAt;
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
      <span className="flex items-center gap-2">
        {unread ? (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
        ) : (
          <span className="h-1.5 w-1.5 shrink-0" aria-hidden />
        )}
        <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
          {notificationKindLabel(item.kind)}
        </span>
        <span className="ml-auto text-[11px] text-fg-subtle">
          {relativeTime(item.createdAt)}
        </span>
      </span>
      <span
        className={`pl-3.5 text-[13px] leading-5 ${unread ? "font-semibold text-fg" : "text-fg"}`}
      >
        {item.title}
      </span>
      {item.body ? (
        <span className="pl-3.5 text-[12px] leading-4 text-fg-muted line-clamp-2">
          {item.body}
        </span>
      ) : null}
    </span>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const delta = Math.max(0, Date.now() - then);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
