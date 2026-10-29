import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppFrame } from "@/components/layout/app-frame";
import { getSession } from "@/lib/auth/session";
import { readSiteSettings } from "@/lib/settings/store";

/**
 * Authenticated app shell. Article reads live here so in-app links stay
 * client-side. Anonymous traffic is handled in proxy.ts first: public
 * `/kb/[slug]` rewrites to `/p/[slug]`, everything else redirects to
 * `/login` before this layout runs. RequireSession is defense-in-depth
 * for a present-but-invalid cookie (proxy only sees the cookie name).
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <RequireSession>{children}</RequireSession>
    </Suspense>
  );
}

async function RequireSession({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  // Prefer proxy redirect for anonymous hits; this path is the stale-cookie case.
  if (!session) redirect("/login");
  const settings = await readSiteSettings();
  return (
    <AppFrame session={session} settings={settings}>
      {children}
    </AppFrame>
  );
}
