import Link from "next/link";
import { Suspense } from "react";
import { UserAvatar } from "@/components/kb/user-avatar";
import { resolveAvatarSrc } from "@/lib/avatar/gravatar";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-10 text-[13px] text-fg-subtle">Loading profile…</div>
      }
    >
      <ProfilePanel />
    </Suspense>
  );
}

async function ProfilePanel() {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { createdAt: true },
  });
  const avatarSrc = resolveAvatarSrc(session.email, session.avatarUrl, 96);

  return (
    <div className="mx-auto w-full max-w-[640px] px-6 py-8">
      <h1 className="text-[22px] leading-7 font-bold tracking-tight text-fg">Profile</h1>
      <p className="mt-1 text-[13px] text-fg-subtle">
        How you appear in TechBase. The face comes from Gravatar when you have not set a
        custom avatar.
      </p>

      <div className="mt-6 flex items-start gap-4 rounded-xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,.06)]">
        <UserAvatar name={session.name} src={avatarSrc} size={64} />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-fg">{session.name}</p>
          <p className="mt-0.5 truncate text-[13px] text-fg-muted">{session.email}</p>
          <p className="mt-2 text-[12px] capitalize text-fg-subtle">Role · {session.role}</p>
          {user?.createdAt ? (
            <p className="mt-1 text-[12px] text-fg-subtle">
              Member since{" "}
              {user.createdAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-surface p-4 text-[13px] leading-5 text-fg-muted">
        <p>
          Your face is loaded from{" "}
          <a
            href="https://gravatar.com"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-accent hover:underline"
          >
            gravatar.com
          </a>{" "}
          for <span className="font-medium text-fg">{session.email}</span>. Seed
          accounts use <code className="text-[12px]">@techbase.local</code>, so you
          see Gravatar&apos;s identicon until that address has a real photo — or
          sign in with an email you already use on Gravatar. Custom uploads in
          TechBase come later.
        </p>
        <p className="mt-3">
          <Link
            href="/account/security"
            className="font-semibold text-accent hover:underline"
          >
            Security settings
          </Link>
          {" · "}
          password, authenticator, and passkeys.
        </p>
      </div>
    </div>
  );
}
