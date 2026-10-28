import { Suspense } from "react";
import { PaletteArticleSync, PaletteProvider } from "@/components/layout/command-palette";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { can, type Role } from "@/lib/auth/policy";
import type { AppSession } from "@/lib/auth/session";
import { getKbNavCounts } from "@/lib/queries/articles";
import { getArticleTree } from "@/lib/queries/article-tree";
import { listRecentPaletteArticles } from "@/lib/queries/recent-articles";
import { resolveAvatarSrc } from "@/lib/avatar/gravatar";
import {
  countUnreadNotifications,
  listNotifications,
} from "@/lib/queries/notifications";
import { accentTokens, type SiteSettings } from "@/lib/settings/site-settings";

/** Signed-in chrome: dark sidebar, top bar, light canvas. */
export function AppFrame({
  session,
  settings,
  children,
}: {
  session: AppSession;
  settings: SiteSettings;
  children: React.ReactNode;
}) {
  const accent = accentTokens(settings.accentHex);
  return (
    <PaletteProvider role={session.role}>
      <div
        className="relative flex min-h-screen bg-canvas text-fg"
        style={{
          ["--accent" as string]: accent.accent,
          ["--accent-hover" as string]: accent.hover,
          ["--accent-soft" as string]: accent.soft,
          ["--accent-ring" as string]: accent.ring,
        }}
      >
        <Suspense fallback={<Sidebar role={session.role} logoUrl={settings.logoUrl} />}>
          <SidebarWithCounts userId={session.userId} role={session.role} logoUrl={settings.logoUrl} />
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col">
          <Suspense
            fallback={
              <Topbar
                name={session.name}
                role={session.role}
                email={session.email}
                avatarSrc={resolveAvatarSrc(session.email, session.avatarUrl, 64)}
                notifications={[]}
                unreadCount={0}
              />
            }
          >
            <TopbarWithNotifications session={session} />
          </Suspense>
          <Suspense fallback={null}>
            <PaletteArticleSource role={session.role} userId={session.userId} />
          </Suspense>
          <main className="min-w-0 flex-1">{children}</main>
          <Suspense fallback={null}>
            <KeyboardShortcuts canImport={can(session.role, "article.create")} />
          </Suspense>
        </div>
      </div>
    </PaletteProvider>
  );
}

async function TopbarWithNotifications({ session }: { session: AppSession }) {
  const [notifications, unreadCount] = await Promise.all([
    listNotifications(session.userId),
    countUnreadNotifications(session.userId),
  ]);
  return (
    <Topbar
      name={session.name}
      role={session.role}
      email={session.email}
      avatarSrc={resolveAvatarSrc(session.email, session.avatarUrl, 64)}
      notifications={notifications}
      unreadCount={unreadCount}
    />
  );
}

async function PaletteArticleSource({ role, userId }: { role: Role; userId: string }) {
  const recent = await listRecentPaletteArticles(role, userId);
  return <PaletteArticleSync recent={recent} />;
}

async function SidebarWithCounts({
  userId,
  role,
  logoUrl,
}: {
  userId: string;
  role: Role;
  logoUrl: string | null;
}) {
  const [counts, articleTree] = await Promise.all([
    getKbNavCounts(role, userId),
    getArticleTree(role, userId),
  ]);
  return <Sidebar counts={counts} role={role} logoUrl={logoUrl} articleTree={articleTree} />;
}
