-- Modular integrations: UI-owned instances from code templates.

CREATE TABLE "public"."integration" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "templateId" TEXT NOT NULL,
    "accentHex" TEXT NOT NULL DEFAULT '#1E6BFF',
    "iconKey" TEXT NOT NULL DEFAULT 'puzzle',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "fieldSchema" JSONB NOT NULL DEFAULT '[]',
    "config" JSONB NOT NULL DEFAULT '{}',
    "webhookUrlKey" TEXT,
    "notifyOnPublish" BOOLEAN NOT NULL DEFAULT false,
    "lastTestAt" TIMESTAMP(3),
    "lastTestOk" BOOLEAN,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_slug_key" ON "public"."integration"("slug");
CREATE INDEX "integration_enabled_notifyOnPublish_idx" ON "public"."integration"("enabled", "notifyOnPublish");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'integration_setting'
  ) THEN
    INSERT INTO "public"."integration" (
      "id", "slug", "name", "description", "templateId", "accentHex", "iconKey",
      "enabled", "fieldSchema", "config", "webhookUrlKey", "notifyOnPublish",
      "lastTestAt", "lastTestOk", "lastSyncAt", "createdAt", "updatedAt"
    )
    SELECT
      'migrated_' || s."kind",
      s."kind",
      CASE s."kind"
        WHEN 'servicenow' THEN 'ServiceNow'
        WHEN 'jira' THEN 'Jira'
        WHEN 'teams' THEN 'Teams'
        WHEN 'slack' THEN 'Slack'
        ELSE initcap(s."kind")
      END,
      CASE s."kind"
        WHEN 'servicenow' THEN 'Outbound link from an article to a Service Catalog item.'
        WHEN 'jira' THEN 'Cite an article from a Jira ticket and show inbound links.'
        WHEN 'teams' THEN 'On publish, post to a channel via an incoming webhook.'
        WHEN 'slack' THEN 'On publish, post a link to the article via an incoming webhook.'
        ELSE ''
      END,
      s."kind",
      CASE s."kind"
        WHEN 'servicenow' THEN '#10B981'
        WHEN 'jira' THEN '#2684FF'
        WHEN 'teams' THEN '#6264A7'
        WHEN 'slack' THEN '#E01E5A'
        ELSE '#1E6BFF'
      END,
      CASE s."kind"
        WHEN 'servicenow' THEN 'cloud'
        WHEN 'jira' THEN 'ticket'
        WHEN 'teams' THEN 'users'
        WHEN 'slack' THEN 'message'
        ELSE 'puzzle'
      END,
      s."enabled",
      CASE s."kind"
        WHEN 'servicenow' THEN '[{"name":"instanceUrl","label":"Instance URL","type":"url","placeholder":"https://contoso.service-now.com"},{"name":"catalogItemPath","label":"Catalog item path","type":"text","placeholder":"/sp?id=sc_cat_item&sys_id=…"}]'::jsonb
        WHEN 'jira' THEN '[{"name":"baseUrl","label":"Site URL","type":"url","placeholder":"https://contoso.atlassian.net"},{"name":"projectKey","label":"Default project key","type":"text","placeholder":"IT"}]'::jsonb
        WHEN 'teams' THEN '[{"name":"webhookUrl","label":"Incoming webhook URL","type":"password","placeholder":"https://…webhook.office.com/…"}]'::jsonb
        WHEN 'slack' THEN '[{"name":"webhookUrl","label":"Incoming webhook URL","type":"password","placeholder":"https://hooks.slack.com/services/…"},{"name":"defaultChannel","label":"Default channel","type":"text","placeholder":"#it-knowledge"}]'::jsonb
        ELSE '[]'::jsonb
      END,
      s."config",
      CASE WHEN s."kind" IN ('slack', 'teams') THEN 'webhookUrl' ELSE NULL END,
      CASE WHEN s."kind" IN ('slack', 'teams') THEN true ELSE false END,
      s."lastTestAt",
      s."lastTestOk",
      s."lastSyncAt",
      CURRENT_TIMESTAMP,
      s."updatedAt"
    FROM "public"."integration_setting" s;

    DROP TABLE "public"."integration_setting";
  END IF;
END $$;
