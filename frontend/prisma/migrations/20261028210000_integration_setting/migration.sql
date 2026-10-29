-- Admin integrations shell. Config is saved; live ServiceNow / Jira / Teams calls wait.

CREATE TABLE "public"."integration_setting" (
    "kind" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "lastTestAt" TIMESTAMP(3),
    "lastTestOk" BOOLEAN,
    "lastSyncAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_setting_pkey" PRIMARY KEY ("kind")
);
