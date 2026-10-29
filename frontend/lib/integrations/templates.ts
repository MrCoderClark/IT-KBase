import type { IntegrationTemplate, IntegrationTemplateId } from "./types";

export const INTEGRATION_TEMPLATES: IntegrationTemplate[] = [
  {
    id: "slack",
    name: "Slack",
    summary: "Post notifications to a channel via an incoming webhook.",
    accentHex: "#E01E5A",
    iconKey: "message",
    webhookUrlKey: "webhookUrl",
    notifyOnPublish: true,
    webhookHosts: ["hooks.slack.com"],
    fields: [
      {
        name: "webhookUrl",
        label: "Incoming webhook URL",
        type: "password",
        placeholder: "https://hooks.slack.com/services/…",
        hint: "Must be https://hooks.slack.com/….",
      },
      {
        name: "defaultChannel",
        label: "Default channel",
        type: "text",
        placeholder: "#it-knowledge",
        hint: "Shown in the message. The webhook’s channel is where the post lands.",
      },
    ],
  },
  {
    id: "teams",
    name: "Teams",
    summary: "Post notifications to a channel via an incoming webhook.",
    accentHex: "#6264A7",
    iconKey: "users",
    webhookUrlKey: "webhookUrl",
    notifyOnPublish: true,
    webhookHosts: ["outlook.office.com", "webhook.office.com"],
    fields: [
      {
        name: "webhookUrl",
        label: "Incoming webhook URL",
        type: "password",
        placeholder: "https://…webhook.office.com/…",
      },
    ],
  },
  {
    id: "webhook",
    name: "Generic webhook",
    summary: "POST JSON to any HTTPS endpoint on Test and on publish.",
    accentHex: "#1E6BFF",
    iconKey: "webhook",
    webhookUrlKey: "webhookUrl",
    notifyOnPublish: true,
    webhookHosts: null,
    fields: [
      {
        name: "webhookUrl",
        label: "Webhook URL",
        type: "password",
        placeholder: "https://example.com/hooks/techbase",
        hint: "Any https URL. Used for Test and publish posts.",
      },
      {
        name: "label",
        label: "Label",
        type: "text",
        placeholder: "Zapier / n8n / custom",
        hint: "Optional name shown in the payload.",
      },
    ],
  },
  {
    id: "servicenow",
    name: "ServiceNow",
    summary: "Outbound link from an article to a Service Catalog item.",
    accentHex: "#10B981",
    iconKey: "cloud",
    webhookUrlKey: null,
    notifyOnPublish: false,
    webhookHosts: null,
    fields: [
      {
        name: "instanceUrl",
        label: "Instance URL",
        type: "url",
        placeholder: "https://contoso.service-now.com",
      },
      {
        name: "catalogItemPath",
        label: "Catalog item path",
        type: "text",
        placeholder: "/sp?id=sc_cat_item&sys_id=…",
      },
    ],
  },
  {
    id: "jira",
    name: "Jira",
    summary: "Cite an article from a Jira ticket and show inbound links.",
    accentHex: "#2684FF",
    iconKey: "ticket",
    webhookUrlKey: null,
    notifyOnPublish: false,
    webhookHosts: null,
    fields: [
      {
        name: "baseUrl",
        label: "Site URL",
        type: "url",
        placeholder: "https://contoso.atlassian.net",
      },
      {
        name: "projectKey",
        label: "Default project key",
        type: "text",
        placeholder: "IT",
      },
    ],
  },
];

export function templateById(id: string): IntegrationTemplate | null {
  return INTEGRATION_TEMPLATES.find((row) => row.id === id) ?? null;
}

export function isTemplateId(value: string): value is IntegrationTemplateId {
  return INTEGRATION_TEMPLATES.some((row) => row.id === value);
}
