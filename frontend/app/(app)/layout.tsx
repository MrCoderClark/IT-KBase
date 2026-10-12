import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

/**
 * Authenticated app shell: dark sidebar (left, full-height sticky) + dark
 * top bar + light canvas. See Docs/specs/02-design-system.md and
 * Docs/mocks/TechBase Windows Knowledge Article.png.
 *
 * Server Component — children stream in while the shell renders instantly.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-screen bg-canvas text-fg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
