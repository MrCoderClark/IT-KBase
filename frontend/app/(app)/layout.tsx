import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppFrame } from "@/components/layout/app-frame";
import { getSession } from "@/lib/auth/session";
import { readSiteSettings } from "@/lib/settings/store";

/**
 * Authenticated app shell. Article reads live here so in-app links stay
 * client-side. A published public article with no session is rewritten
 * to /p/[slug] by proxy.ts.
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
  if (!session) redirect("/login");
  const settings = await readSiteSettings();
  return (
    <AppFrame session={session} settings={settings}>
      {children}
    </AppFrame>
  );
}
