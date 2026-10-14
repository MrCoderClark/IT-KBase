import { Suspense } from "react";
import { PaletteArticleSync, PaletteProvider } from "@/components/layout/command-palette";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getKbNavCounts, getPaletteArticles } from "@/lib/queries/articles";

/**
 * Authenticated app shell: dark sidebar (left, full-height sticky) + dark
 * top bar + light canvas. See Docs/specs/02-design-system.md and
 * Docs/mocks/TechBase Windows Knowledge Article.png.
 *
 * Server Component — children stream in while the shell renders instantly.
 * Sidebar uses usePathname() so it must be inside Suspense (Next.js 16).
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PaletteProvider>
      <div className="relative flex min-h-screen bg-canvas text-fg">
        <Suspense fallback={<Sidebar />}>
          <SidebarWithCounts />
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <Suspense fallback={null}>
            <PaletteArticleSource />
          </Suspense>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </PaletteProvider>
  );
}

async function PaletteArticleSource() {
  const articles = await getPaletteArticles();
  return <PaletteArticleSync articles={articles} />;
}

async function SidebarWithCounts() {
  const counts = await getKbNavCounts();
  return <Sidebar counts={counts} />;
}
