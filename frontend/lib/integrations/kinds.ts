export const INTEGRATION_KINDS = ["servicenow", "jira", "teams", "slack"] as const;
export type IntegrationKind = (typeof INTEGRATION_KINDS)[number];

export type IntegrationField = {
  name: string;
  label: string;
  type: "url" | "text" | "password";
  placeholder?: string;
  hint?: string;
};

export type IntegrationMeta = {
  kind: IntegrationKind;
  title: string;
  summary: string;
  fields: IntegrationField[];
};

export const INTEGRATIONS: IntegrationMeta[] = [
  {
    kind: "servicenow",
    title: "ServiceNow",
    summary: "Outbound link from an article to a Service Catalog item. Live calls are not wired yet.",
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
        hint: "Path appended to the instance when an article links out.",
      },
    ],
  },
  {
    kind: "jira",
    title: "Jira",
    summary: "Cite an article from a Jira ticket and show inbound links on Related. Live calls are not wired yet.",
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
  {
    kind: "teams",
    title: "Teams",
    summary: "On publish, post to a channel via an incoming webhook. Live posts are not wired yet.",
    fields: [
      {
        name: "webhookUrl",
        label: "Incoming webhook URL",
        type: "password",
        placeholder: "https://…webhook.office.com/…",
        hint: "Stored for later. Publishing does not call Teams yet.",
      },
    ],
  },
  {
    kind: "slack",
    title: "Slack",
    summary: "On publish, post to a channel via an incoming webhook. Live posts are not wired yet.",
    fields: [
      {
        name: "webhookUrl",
        label: "Incoming webhook URL",
        type: "password",
        placeholder: "https://hooks.slack.com/services/…",
        hint: "Stored for later. Publishing does not call Slack yet.",
      },
      {
        name: "defaultChannel",
        label: "Default channel",
        type: "text",
        placeholder: "#it-knowledge",
        hint: "Label only until a live post path exists.",
      },
    ],
  },
];

export function isIntegrationKind(value: string): value is IntegrationKind {
  return (INTEGRATION_KINDS as readonly string[]).includes(value);
}

export function metaFor(kind: IntegrationKind): IntegrationMeta {
  const meta = INTEGRATIONS.find((row) => row.kind === kind);
  if (!meta) throw new Error(`Unknown integration: ${kind}`);
  return meta;
}
