export type IntegrationFieldType = "url" | "text" | "password";

export type IntegrationField = {
  name: string;
  label: string;
  type: IntegrationFieldType;
  placeholder?: string;
  hint?: string;
};

export type IntegrationIconKey = "puzzle" | "message" | "users" | "ticket" | "cloud" | "webhook";

export type IntegrationTemplateId =
  | "slack"
  | "teams"
  | "servicenow"
  | "jira"
  | "webhook";

export type IntegrationTemplate = {
  id: IntegrationTemplateId;
  name: string;
  summary: string;
  accentHex: string;
  iconKey: IntegrationIconKey;
  fields: IntegrationField[];
  webhookUrlKey: string | null;
  notifyOnPublish: boolean;
  /** When set, webhook URL host must match one of these (lowercase). */
  webhookHosts: string[] | null;
};

export type IntegrationRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  templateId: string;
  accentHex: string;
  iconKey: IntegrationIconKey;
  enabled: boolean;
  fieldSchema: IntegrationField[];
  config: Record<string, string>;
  webhookUrlKey: string | null;
  notifyOnPublish: boolean;
  lastTestAt: Date | null;
  lastTestOk: boolean | null;
  lastSyncAt: Date | null;
  updatedAt: Date;
};

export type IntegrationStatus = "connected" | "off" | "not_tested";

export function integrationStatus(row: IntegrationRecord): IntegrationStatus {
  if (!row.enabled) return "off";
  if (row.lastTestOk === true) return "connected";
  return "not_tested";
}
