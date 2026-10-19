import { Suspense } from "react";
import { PaletteArticleSync, PaletteProvider } from "@/components/layout/command-palette";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { Role } from "@/lib/auth/policy";
import type { AppSession } from "@/lib/auth/session";
import { getKbNavCounts } from "@/lib/queries/articles";
import { listRecentPaletteArticles } from "@/lib/queries/recent-articles";
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
          <Topbar name={session.name} role={session.role} />
          <Suspense fallback={null}>
            <PaletteArticleSource userId={session.userId} />
          </Suspense>
          <main className="min-w-0 flex-1">{children}</main>
          <Suspense fallback={null}>
            <KeyboardShortcuts />
          </Suspense>
        </div>
      </div>
    </PaletteProvider>
  );
}

async function PaletteArticleSource({ userId }: { userId: string }) {
  const recent = await listRecentPaletteArticles(userId);
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
  const counts = await getKbNavCounts(userId);
  return <Sidebar counts={counts} role={role} logoUrl={logoUrl} />;
}
