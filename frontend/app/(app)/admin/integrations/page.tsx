import { Suspense } from "react";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { saveIntegrationSettings, testIntegration } from "@/lib/integrations/actions";
import { INTEGRATIONS, isIntegrationKind } from "@/lib/integrations/kinds";
import { listIntegrations, type IntegrationRecord } from "@/lib/integrations/store";

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] leading-5 text-fg outline-none focus:border-accent focus:ring-1 focus:ring-accent/30";

export default function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; notice?: string; kind?: string; m?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <ArticleListShell title="Integrations" description="Loading integrations…" showCreate={false}>
          <div />
        </ArticleListShell>
      }
    >
      <IntegrationsPanel searchParams={searchParams} />
    </Suspense>
  );
}

async function IntegrationsPanel({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; notice?: string; kind?: string; m?: string }>;
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
  const byKind = new Map(rows.map((row) => [row.kind, row]));
  const focus = params.kind && isIntegrationKind(params.kind) ? params.kind : null;
  const message = noticeMessage(params.e, params.notice, focus, params.m);

  return (
    <ArticleListShell
      title="Integrations"
      description="ServiceNow, Jira, Teams, and Slack placeholders. Config saves here; live ticket import and webhooks come later."
      showCreate={false}
    >
      {message ? (
        <p role="status" className={`mb-4 text-[13px] font-medium ${params.e ? "text-danger" : "text-fg"}`}>
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-1">
        {INTEGRATIONS.map((meta) => {
          const row = byKind.get(meta.kind) ?? emptyRow(meta.kind);
          return <IntegrationCard key={meta.kind} meta={meta} row={row} />;
        })}
      </div>
    </ArticleListShell>
  );
}

function IntegrationCard({
  meta,
  row,
}: {
  meta: (typeof INTEGRATIONS)[number];
  row: IntegrationRecord;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-fg">{meta.title}</h2>
          <p className="mt-1 max-w-2xl text-[13px] text-fg-muted">{meta.summary}</p>
        </div>
        <StatusChips row={row} />
      </div>

      <form action={saveIntegrationSettings} className="mt-4 space-y-3">
        <input type="hidden" name="kind" value={meta.kind} />
        <label className="flex items-center gap-2 text-[13px] text-fg">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={row.enabled}
            className="size-4 rounded border-border-strong accent-[var(--accent)]"
          />
          Enable {meta.title}
        </label>

        {meta.fields.map((field) => (
          <div key={field.name} className="space-y-1">
            <label className="text-[13px] font-medium text-fg" htmlFor={`${meta.kind}-${field.name}`}>
              {field.label}
            </label>
            <input
              id={`${meta.kind}-${field.name}`}
              name={field.name}
              type={field.type}
              defaultValue={row.config[field.name] ?? ""}
              placeholder={field.placeholder}
              autoComplete="off"
              className={fieldClass}
            />
            {field.hint ? <p className="text-[12px] text-fg-muted">{field.hint}</p> : null}
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="submit">Save</Button>
        </div>
      </form>

      <form action={testIntegration} className="mt-3">
        <input type="hidden" name="kind" value={meta.kind} />
        <Button type="submit" variant="outline">
          Test connection
        </Button>
        <p className="mt-2 text-[12px] text-fg-muted">
          {meta.kind === "slack"
            ? "Posts a short message to the webhook. Enable Slack and save the URL first."
            : "Records a test attempt. No remote call runs for this integration yet."}
        </p>
      </form>
    </section>
  );
}

function StatusChips({ row }: { row: IntegrationRecord }) {
  return (
    <dl className="flex flex-wrap gap-2 text-[11px]">
      <div className="rounded-full border border-border px-2.5 py-1 text-fg-muted">
        <dt className="sr-only">Enabled</dt>
        <dd>{row.enabled ? "On" : "Off"}</dd>
      </div>
      <div className="rounded-full border border-border px-2.5 py-1 text-fg-muted">
        <dt className="sr-only">Last test</dt>
        <dd>
          {row.lastTestAt
            ? `Tested ${formatWhen(row.lastTestAt)}${
                row.lastTestOk === true ? " (ok)" : row.lastTestOk === false ? " (failed)" : " (stub)"
              }`
            : "Never tested"}
        </dd>
      </div>
      <div className="rounded-full border border-border px-2.5 py-1 text-fg-muted">
        <dt className="sr-only">Last sync</dt>
        <dd>{row.lastSyncAt ? `Synced ${formatWhen(row.lastSyncAt)}` : "No sync yet"}</dd>
      </div>
    </dl>
  );
}

function emptyRow(kind: IntegrationRecord["kind"]): IntegrationRecord {
  return {
    kind,
    enabled: false,
    config: {},
    lastTestAt: null,
    lastTestOk: null,
    lastSyncAt: null,
    updatedAt: new Date(0),
  };
}

function noticeMessage(
  error: string | undefined,
  notice: string | undefined,
  kind: string | null,
  detail?: string,
): string | null {
  const label = kind ? INTEGRATIONS.find((row) => row.kind === kind)?.title : null;
  if (error === "kind") return "That integration is not supported.";
  if (error === "url") return "Use an http or https address, or leave the URL blank.";
  if (error === "test") {
    return detail?.trim() || (label ? `${label} test failed.` : "Connection test failed.");
  }
  if (notice === "saved") return label ? `${label} settings saved.` : "Settings saved.";
  if (notice === "test_ok") {
    return label ? `${label} test succeeded. Check the channel for the message.` : "Connection test succeeded.";
  }
  if (notice === "test") {
    return label
      ? `${label} test recorded. Live connection checks are not wired yet.`
      : "Test recorded. Live connection checks are not wired yet.";
  }
  return null;
}

function formatWhen(at: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(at) + " UTC";
}
