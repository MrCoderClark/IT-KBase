import { headers } from "next/headers";
import { appOrigin } from "@/lib/auth/session";
import {
  listPublishIntegrations,
  markIntegrationSynced,
  markIntegrationTest,
  markIntegrationTestStub,
  getIntegrationById,
} from "./store";
import {
  buildPublishPayload,
  buildTestPayload,
  postJsonWebhook,
  webhookHostsFor,
  webhookUrlFor,
  type WebhookResult,
} from "./webhook";

export async function testIntegrationConnection(id: string): Promise<WebhookResult> {
  const row = await getIntegrationById(id);
  if (!row) return { ok: false, error: "Integration not found." };
  if (!row.enabled) return { ok: false, error: "Enable this integration and save before testing." };

  if (!row.webhookUrlKey) {
    await markIntegrationTestStub(id);
    return { ok: false, error: "This template has no live connection test yet." };
  }

  const webhookUrl = webhookUrlFor(row);
  if (!webhookUrl) return { ok: false, error: "Add a webhook URL and save." };

  const result = await postJsonWebhook(webhookUrl, buildTestPayload(row), webhookHostsFor(row));
  await markIntegrationTest(id, result.ok);
  return result;
}

export async function notifyIntegrationsArticlePublished(input: {
  title: string;
  slug: string;
  summary: string | null;
  version: string;
  authorName: string;
}): Promise<void> {
  const rows = await listPublishIntegrations();
  if (rows.length === 0) return;

  const origin = appOrigin(await headers());
  const url = `${origin}/kb/${encodeURIComponent(input.slug)}`;

  for (const row of rows) {
    const webhookUrl = webhookUrlFor(row);
    if (!webhookUrl) continue;
    try {
      const result = await postJsonWebhook(
        webhookUrl,
        buildPublishPayload(row, { ...input, url }),
        webhookHostsFor(row),
      );
      if (result.ok) await markIntegrationSynced(row.id);
    } catch {
      // Publish already succeeded; integrations must not roll it back.
    }
  }
}
