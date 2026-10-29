"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  Cloud,
  MessageSquare,
  Plus,
  Puzzle,
  Ticket,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addIntegration,
  removeIntegration,
  saveIntegrationSettings,
  testIntegration,
} from "@/lib/integrations/actions";
import {
  integrationStatus,
  type IntegrationIconKey,
  type IntegrationRecord,
  type IntegrationTemplate,
} from "@/lib/integrations/types";

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] leading-5 text-fg outline-none focus:border-accent focus:ring-1 focus:ring-accent/30";

const ICONS: Record<IntegrationIconKey, LucideIcon> = {
  puzzle: Puzzle,
  message: MessageSquare,
  users: Users,
  ticket: Ticket,
  cloud: Cloud,
  webhook: Webhook,
};

/** Brand marks under /public/integrations when present; else Lucide. */
const BRAND_MARKS: Partial<Record<string, { src: string; alt: string }>> = {
  slack: { src: "/integrations/slack.png", alt: "Slack" },
  teams: { src: "/integrations/teams.png", alt: "Teams" },
};

function IntegrationMark({
  templateId,
  iconKey,
  accentHex,
  size,
}: {
  templateId: string;
  iconKey: IntegrationIconKey;
  accentHex: string;
  size: "sm" | "md";
}) {
  const box = size === "sm" ? "size-7" : "size-9";
  const brand = BRAND_MARKS[templateId];
  if (brand) {
    return (
      <span className={`relative ${box} shrink-0 overflow-hidden rounded-md bg-[#0B1220]`}>
        <Image src={brand.src} alt={brand.alt} fill sizes={size === "sm" ? "28px" : "36px"} className="object-cover" />
      </span>
    );
  }
  const Icon = ICONS[iconKey] ?? Puzzle;
  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-md`}
      style={{ backgroundColor: `${accentHex}22`, color: accentHex }}
    >
      <Icon size={size === "sm" ? 14 : 16} aria-hidden />
    </span>
  );
}

type ClientRecord = Omit<IntegrationRecord, "lastTestAt" | "lastSyncAt" | "updatedAt"> & {
  lastTestAt: string | null;
  lastSyncAt: string | null;
  updatedAt: string;
};

export function IntegrationsPanel({
  rows,
  templates,
  message,
  focusId,
  isError,
}: {
  rows: ClientRecord[];
  templates: IntegrationTemplate[];
  message: string | null;
  focusId: string | null;
  isError: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [configureId, setConfigureId] = useState<string | null>(focusId);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "webhook");

  const selected = useMemo(
    () => rows.find((row) => row.id === configureId) ?? null,
    [rows, configureId],
  );
  const selectedTemplate = templates.find((row) => row.id === templateId) ?? templates[0];

  return (
    <>
      {message ? (
        <p role="status" className={`mb-4 text-[13px] font-medium ${isError ? "text-danger" : "text-fg"}`}>
          {message}
        </p>
      ) : null}

      <div className="mb-4 flex justify-end">
        <Button type="button" onClick={() => setAddOpen(true)}>
          <Plus size={15} aria-hidden />
          Add integration
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-5 py-10 text-center">
          <p className="text-[14px] font-medium text-fg">No integrations yet</p>
          <p className="mt-1 text-[13px] text-fg-muted">
            Add Slack, Teams, a generic webhook, ServiceNow, or Jira from a template.
          </p>
          <Button type="button" className="mt-4" onClick={() => setAddOpen(true)}>
            <Plus size={15} aria-hidden />
            Add integration
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <IntegrationCard key={row.id} row={row} onConfigure={() => setConfigureId(row.id)} />
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <form action={addIntegration}>
            <DialogHeader>
              <div className="flex items-start gap-3">
                {selectedTemplate ? (
                  <IntegrationMark
                    templateId={selectedTemplate.id}
                    iconKey={selectedTemplate.iconKey}
                    accentHex={selectedTemplate.accentHex}
                    size="md"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <DialogTitle>Add integration</DialogTitle>
                  <DialogDescription>
                    Pick a template. You can rename it and configure secrets after it is created.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="mt-4 space-y-3">
              <fieldset className="space-y-2">
                <legend className="text-[13px] font-medium text-fg">Template</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {templates.map((template) => {
                    const active = templateId === template.id;
                    return (
                      <label
                        key={template.id}
                        className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                          active ? "border-accent bg-accent/5" : "border-border hover:border-border-strong"
                        }`}
                      >
                        <input
                          type="radio"
                          name="templateId"
                          value={template.id}
                          checked={templateId === template.id}
                          onChange={() => setTemplateId(template.id)}
                          className="sr-only"
                        />
                        <span className="flex items-start gap-2">
                          <span className="mt-0.5">
                            <IntegrationMark
                              templateId={template.id}
                              iconKey={template.iconKey}
                              accentHex={template.accentHex}
                              size="sm"
                            />
                          </span>
                          <span>
                            <span className="block text-[13px] font-semibold text-fg">{template.name}</span>
                            <span className="mt-0.5 block text-[12px] leading-4 text-fg-muted">
                              {template.summary}
                            </span>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="space-y-1">
                <label className="text-[13px] font-medium text-fg" htmlFor="add-name">
                  Display name
                </label>
                <input
                  id="add-name"
                  name="name"
                  type="text"
                  defaultValue={selectedTemplate?.name ?? ""}
                  key={selectedTemplate?.id}
                  placeholder="Slack · #it-ops"
                  className={fieldClass}
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setConfigureId(null)}>
        {selected ? (
          <DialogContent className="sm:max-w-lg" key={selected.id}>
            <form action={saveIntegrationSettings}>
              <input type="hidden" name="id" value={selected.id} />
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <IntegrationMark
                    templateId={selected.templateId}
                    iconKey={selected.iconKey}
                    accentHex={selected.accentHex}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <DialogTitle>Configure {selected.name}</DialogTitle>
                    <DialogDescription>
                      {selected.description || "Enable, set fields, then test the connection."}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-fg" htmlFor={`name-${selected.id}`}>
                    Name
                  </label>
                  <input
                    id={`name-${selected.id}`}
                    name="name"
                    type="text"
                    defaultValue={selected.name}
                    required
                    className={fieldClass}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-fg" htmlFor={`desc-${selected.id}`}>
                    Description
                  </label>
                  <input
                    id={`desc-${selected.id}`}
                    name="description"
                    type="text"
                    defaultValue={selected.description}
                    className={fieldClass}
                  />
                </div>

                <label className="flex items-center gap-2 text-[13px] text-fg">
                  <input
                    type="checkbox"
                    name="enabled"
                    defaultChecked={selected.enabled}
                    className="size-4 rounded border-border-strong accent-[var(--accent)]"
                  />
                  Enable this integration
                </label>

                {selected.fieldSchema.map((field) => (
                  <div key={field.name} className="space-y-1">
                    <label className="text-[13px] font-medium text-fg" htmlFor={`${selected.id}-${field.name}`}>
                      {field.label}
                    </label>
                    <input
                      id={`${selected.id}-${field.name}`}
                      name={field.name}
                      type={field.type}
                      defaultValue={field.type === "password" ? "" : (selected.config[field.name] ?? "")}
                      placeholder={
                        field.type === "password" && selected.config[field.name]
                          ? "••••••••  (leave blank to keep)"
                          : field.placeholder
                      }
                      autoComplete="off"
                      className={fieldClass}
                    />
                    {field.hint ? <p className="text-[12px] text-fg-muted">{field.hint}</p> : null}
                  </div>
                ))}
              </div>

              <DialogFooter className="mt-4">
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>

            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-4">
              <form action={testIntegration}>
                <input type="hidden" name="id" value={selected.id} />
                <Button type="submit" variant="outline">
                  Test connection
                </Button>
              </form>
              <form
                action={removeIntegration}
                onSubmit={(event) => {
                  if (!window.confirm(`Remove “${selected.name}”? This cannot be undone.`)) {
                    event.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="id" value={selected.id} />
                <Button type="submit" variant="outline" className="text-danger">
                  Remove
                </Button>
              </form>
            </div>
            <p className="mt-2 text-[12px] text-fg-muted">
              {selected.webhookUrlKey
                ? "Test posts a short payload to the webhook. Enable and save first."
                : "This template has no live connection test yet. Save still stores config."}
            </p>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

function IntegrationCard({
  row,
  onConfigure,
}: {
  row: ClientRecord;
  onConfigure: () => void;
}) {
  const status = integrationStatus({
    ...row,
    lastTestAt: row.lastTestAt ? new Date(row.lastTestAt) : null,
    lastSyncAt: row.lastSyncAt ? new Date(row.lastSyncAt) : null,
    updatedAt: new Date(row.updatedAt),
  });
  const statusLabel =
    status === "connected" ? "Connected" : status === "off" ? "Off" : "Not tested";

  return (
    <section className="flex flex-col rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <IntegrationMark
          templateId={row.templateId}
          iconKey={row.iconKey}
          accentHex={row.accentHex}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-[14px] font-semibold text-fg">{row.name}</h2>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] ${
                status === "connected"
                  ? "border-success/40 text-success"
                  : status === "off"
                    ? "border-border text-fg-muted"
                    : "border-border text-fg-muted"
              }`}
            >
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[12px] leading-4 text-fg-muted">
            {row.description || "No description"}
          </p>
        </div>
      </div>

      <dl className="mt-3 space-y-1 text-[11px] text-fg-muted">
        <div className="flex justify-between gap-2">
          <dt>Template</dt>
          <dd className="font-medium text-fg">{row.templateId}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Last test</dt>
          <dd>
            {row.lastTestAt
              ? `${formatWhen(row.lastTestAt)}${
                  row.lastTestOk === true ? " · ok" : row.lastTestOk === false ? " · failed" : ""
                }`
              : "Never"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Last publish</dt>
          <dd>{row.lastSyncAt ? formatWhen(row.lastSyncAt) : "No publish yet"}</dd>
        </div>
      </dl>

      <div className="mt-4 grow" />
      <Button type="button" variant="outline" className="w-full" onClick={onConfigure}>
        Configure
      </Button>
    </section>
  );
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(iso));
}
