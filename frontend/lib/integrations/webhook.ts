import type { IntegrationRecord } from "./types";
import { templateById } from "./templates";

export type WebhookResult = { ok: true } | { ok: false; error: string };

export function isAllowedWebhookUrl(url: string, hosts: string[] | null): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (!hosts) return true;
    const host = parsed.hostname.toLowerCase();
    return hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

export async function postJsonWebhook(
  webhookUrl: string,
  body: Record<string, unknown>,
  hosts: string[] | null,
): Promise<WebhookResult> {
  if (!isAllowedWebhookUrl(webhookUrl, hosts)) {
    return {
      ok: false,
      error: hosts
        ? `Webhook URL must be https on: ${hosts.join(", ")}.`
        : "Webhook URL must be a valid https address.",
    };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = (await response.text()).trim().slice(0, 200);
      return { ok: false, error: detail || `Webhook returned HTTP ${response.status}.` };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    return { ok: false, error: message };
  }
}

export function webhookUrlFor(row: IntegrationRecord): string {
  if (!row.webhookUrlKey) return "";
  return row.config[row.webhookUrlKey]?.trim() ?? "";
}

export function webhookHostsFor(row: IntegrationRecord): string[] | null {
  const template = templateById(row.templateId);
  return template?.webhookHosts ?? null;
}

export function buildPublishPayload(
  row: IntegrationRecord,
  input: {
    title: string;
    slug: string;
    url: string;
    summary: string | null;
    version: string;
    authorName: string;
  },
): Record<string, unknown> {
  const channel = row.config.defaultChannel?.trim() || row.config.label?.trim();
  if (row.templateId === "slack") {
    const lines = [
      `*Published:* <${input.url}|${input.title}>`,
      `Version ${input.version} · ${input.authorName}`,
    ];
    if (channel) lines.push(`Channel: ${channel}`);
    if (input.summary) lines.push(input.summary);
    return {
      text: `Published: ${input.title} (${input.url})`,
      blocks: [{ type: "section", text: { type: "mrkdwn", text: lines.join("\n") } }],
    };
  }

  return {
    text: `Published: ${input.title}`,
    event: "article.published",
    article: {
      title: input.title,
      slug: input.slug,
      url: input.url,
      summary: input.summary,
      version: input.version,
      authorName: input.authorName,
    },
    integration: { name: row.name, label: channel || null },
  };
}

export function buildTestPayload(row: IntegrationRecord): Record<string, unknown> {
  const channel = row.config.defaultChannel?.trim() || row.config.label?.trim();
  if (row.templateId === "slack") {
    return {
      text: channel
        ? `TechBase connection test for ${channel}.`
        : "TechBase connection test. Slack is ready for publish posts.",
    };
  }
  return {
    text: channel
      ? `TechBase connection test for ${channel}.`
      : "TechBase connection test.",
    event: "integration.test",
    integration: { name: row.name, id: row.id },
  };
}
