-- One row of admin-owned site options. Sign-in does not read this yet.

CREATE TABLE "public"."site_setting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "accentHex" TEXT NOT NULL DEFAULT '#1E6BFF',
    "logoUrl" TEXT,
    "versionRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "allowedEmailDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_setting_pkey" PRIMARY KEY ("id")
);
