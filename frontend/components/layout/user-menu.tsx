"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/kb/user-avatar";
import { SHORTCUTS_EVENT } from "@/components/layout/keyboard-shortcuts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/lib/auth/actions";

export function UserMenu({
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
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="ml-1 inline-flex h-10 items-center gap-2.5 rounded-sm pr-2 pl-1 text-left outline-none transition-colors hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-accent data-popup-open:bg-white/[0.06]">
        {/* Name comes from sr-only so avatar initials / CSS-capitalized role
            don't trip label-in-name against an aria-label. */}
        <span className="sr-only">{`${name}, ${role}`}</span>
        <span aria-hidden className="inline-flex items-center gap-2.5">
          <UserAvatar name={name} src={avatarSrc} size={32} />
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-[13px] leading-4 font-semibold text-white">
              {name}
            </span>
            <span className="block truncate text-[11px] leading-4 text-sidebar-fg/70 capitalize">
              {role}
            </span>
          </span>
          <ChevronDown
            size={16}
            className="hidden shrink-0 text-sidebar-fg/60 sm:block"
          />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-[200px]">
        <div className="px-2 py-1.5">
          <p className="truncate text-[13px] font-semibold text-fg">{name}</p>
          <p className="truncate text-[12px] text-fg-subtle">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/account")}>Profile</DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            window.dispatchEvent(new Event(SHORTCUTS_EVENT));
          }}
        >
          Keyboard shortcuts
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/account/security")}>
          Security
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void logout()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
