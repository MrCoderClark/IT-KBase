import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppFrame } from "@/components/layout/app-frame";
import { getSession } from "@/lib/auth/session";
import { readSiteSettings } from "@/lib/settings/store";

/**
 * Authenticated app shell. The article read route lives outside this
 * layout so a published public article can be opened without a session.
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
