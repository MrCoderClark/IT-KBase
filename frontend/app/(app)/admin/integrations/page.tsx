import { Suspense } from "react";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { listIntegrations } from "@/lib/integrations/store";
import { INTEGRATION_TEMPLATES } from "@/lib/integrations/templates";
import { IntegrationsPanel } from "./_components/integrations-panel";

export default function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; notice?: string; id?: string; m?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <ArticleListShell title="Integrations" description="Loading integrations…" showCreate={false}>
          <div />
        </ArticleListShell>
      }
    >
      <IntegrationsPageInner searchParams={searchParams} />
    </Suspense>
  );
}

async function IntegrationsPageInner({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; notice?: string; id?: string; m?: string }>;
}) {
  const session = await getSession();
  if (!session || !can(session.role, "admin.manage")) {
    return (
      <ArticleListShell title="Integrations" description="Only an admin can open this page." showCreate={false}>
        <p className="text-[13px] text-fg-muted">You do not have permission to manage integrations.</p>
      </ArticleListShell>
    );
  }

  const [params, rows] = await Promise.all([searchParams, listIntegrations()]);
  const focus = rows.find((row) => row.id === params.id) ?? null;
  const message = noticeMessage(params.e, params.notice, focus?.name ?? null, params.m);

  return (
    <ArticleListShell
      title="Integrations"
      description="Add Slack, Teams, Generic webhook, ServiceNow, or Jira from templates. Enabled webhook instances post on publish."
      showCreate={false}
    >
      <IntegrationsPanel
        rows={rows.map((row) => ({
          ...row,
          lastTestAt: row.lastTestAt?.toISOString() ?? null,
          lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
          updatedAt: row.updatedAt.toISOString(),
        }))}
        templates={INTEGRATION_TEMPLATES}
        message={message}
        focusId={params.id ?? null}
        isError={Boolean(params.e)}
      />
    </ArticleListShell>
  );
}

function noticeMessage(
  error: string | undefined,
  notice: string | undefined,
  label: string | null,
  detail?: string,
): string | null {
  if (error === "template") return "That template is not supported.";
  if (error === "missing") return "That integration was not found.";
  if (error === "name") return "Name is required.";
  if (error === "url") return "Use an http or https address, or leave the URL blank.";
  if (error === "host") return "That webhook host is not allowed for this template.";
  if (error === "test") {
    return detail?.trim() || (label ? `${label} test failed.` : "Connection test failed.");
  }
  if (notice === "added") return label ? `${label} added. Configure it to enable.` : "Integration added.";
  if (notice === "saved") return label ? `${label} settings saved.` : "Settings saved.";
  if (notice === "removed") return "Integration removed.";
  if (notice === "test_ok") {
    return label ? `${label} test succeeded.` : "Connection test succeeded.";
  }
  return null;
}
