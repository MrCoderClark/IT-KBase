import { Suspense } from "react";
import { PaletteArticleSync, PaletteProvider } from "@/components/layout/command-palette";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { Role } from "@/lib/auth/policy";
import type { AppSession } from "@/lib/auth/session";
import { getKbNavCounts, getPaletteArticles } from "@/lib/queries/articles";

/** Signed-in chrome: dark sidebar, top bar, light canvas. */
export function AppFrame({
  session,
  children,
}: {
  session: AppSession;
  children: React.ReactNode;
}) {
  return (
    <PaletteProvider role={session.role}>
      <div className="relative flex min-h-screen bg-canvas text-fg">
        <Suspense fallback={<Sidebar role={session.role} />}>
          <SidebarWithCounts userId={session.userId} role={session.role} />
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar name={session.name} role={session.role} />
          <Suspense fallback={null}>
            <PaletteArticleSource />
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

async function PaletteArticleSource() {
  const articles = await getPaletteArticles();
  return <PaletteArticleSync articles={articles} />;
}

async function SidebarWithCounts({ userId, role }: { userId: string; role: Role }) {
  const counts = await getKbNavCounts(userId);
  return <Sidebar counts={counts} role={role} />;
}
