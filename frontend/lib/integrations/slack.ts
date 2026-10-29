import { headers } from "next/headers";
import { appOrigin } from "@/lib/auth/session";
import { getIntegration, markIntegrationSynced, markIntegrationTest } from "./store";

export type SlackPostResult = { ok: true } | { ok: false; error: string };

function isSlackWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "hooks.slack.com";
  } catch {
    return false;
  }
}

/** POST JSON to a Slack incoming webhook. Failures are returned, not thrown. */
export async function postSlackWebhook(
  webhookUrl: string,
  body: Record<string, unknown>,
): Promise<SlackPostResult> {
  if (!isSlackWebhookUrl(webhookUrl)) {
    return { ok: false, error: "Webhook URL must be an https://hooks.slack.com/… address." };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = (await response.text()).trim().slice(0, 200);
      return {
        ok: false,
        error: detail || `Slack returned HTTP ${response.status}.`,
      };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    return { ok: false, error: message };
  }
}

export async function testSlackWebhook(): Promise<SlackPostResult> {
  const row = await getIntegration("slack");
  const webhookUrl = row?.config.webhookUrl?.trim() ?? "";
  if (!row?.enabled) {
    return { ok: false, error: "Enable Slack and save before testing." };
  }
  if (!webhookUrl) {
    return { ok: false, error: "Add a Slack incoming webhook URL and save." };
  }

  const channel = row.config.defaultChannel?.trim();
  const result = await postSlackWebhook(webhookUrl, {
    text: channel
      ? `TechBase connection test for ${channel}.`
      : "TechBase connection test. Slack is ready for publish posts.",
  });
  await markIntegrationTest("slack", result.ok);
  return result;
}

export async function notifySlackArticlePublished(input: {
  title: string;
  slug: string;
  summary: string | null;
  version: string;
  authorName: string;
}): Promise<void> {
  const row = await getIntegration("slack");
  if (!row?.enabled) return;
  const webhookUrl = row.config.webhookUrl?.trim() ?? "";
  if (!webhookUrl) return;

  const origin = appOrigin(await headers());
  const url = `${origin}/kb/${encodeURIComponent(input.slug)}`;
  const channel = row.config.defaultChannel?.trim();
  const summary = input.summary?.trim();

  const lines = [
    `*Published:* <${url}|${input.title}>`,
    `Version ${input.version} · ${input.authorName}`,
  ];
  if (channel) lines.push(`Channel: ${channel}`);
  if (summary) lines.push(summary);

  const result = await postSlackWebhook(webhookUrl, {
    text: `Published: ${input.title} (${url})`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: lines.join("\n") },
      },
    ],
  });

  if (result.ok) {
    await markIntegrationSynced("slack");
  }
}
