-- Authenticator secrets, one-time recovery codes, and the short login challenge.

CREATE TABLE "auth"."totp" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "secretCipher" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "lastStep" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "totp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "totp_identityId_key" ON "auth"."totp"("identityId");

ALTER TABLE "auth"."totp"
ADD CONSTRAINT "totp_identityId_fkey"
FOREIGN KEY ("identityId") REFERENCES "auth"."identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "auth"."recovery_code" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_code_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recovery_code_codeHash_key" ON "auth"."recovery_code"("codeHash");
CREATE INDEX "recovery_code_identityId_idx" ON "auth"."recovery_code"("identityId");

ALTER TABLE "auth"."recovery_code"
ADD CONSTRAINT "recovery_code_identityId_fkey"
FOREIGN KEY ("identityId") REFERENCES "auth"."identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "auth"."mfa_challenge" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_challenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mfa_challenge_secretHash_key" ON "auth"."mfa_challenge"("secretHash");
CREATE INDEX "mfa_challenge_identityId_idx" ON "auth"."mfa_challenge"("identityId");

ALTER TABLE "auth"."mfa_challenge"
ADD CONSTRAINT "mfa_challenge_identityId_fkey"
FOREIGN KEY ("identityId") REFERENCES "auth"."identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
