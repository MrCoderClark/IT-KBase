-- Passkey credentials and the short ceremony challenge. The private key never lands here.

CREATE TABLE "auth"."passkey" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passkey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "passkey_credentialId_key" ON "auth"."passkey"("credentialId");
CREATE INDEX "passkey_identityId_idx" ON "auth"."passkey"("identityId");

ALTER TABLE "auth"."passkey"
ADD CONSTRAINT "passkey_identityId_fkey"
FOREIGN KEY ("identityId") REFERENCES "auth"."identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "auth"."passkey_challenge" (
    "id" TEXT NOT NULL,
    "identityId" TEXT,
    "secretHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passkey_challenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "passkey_challenge_secretHash_key" ON "auth"."passkey_challenge"("secretHash");
CREATE INDEX "passkey_challenge_identityId_idx" ON "auth"."passkey_challenge"("identityId");

ALTER TABLE "auth"."passkey_challenge"
ADD CONSTRAINT "passkey_challenge_identityId_fkey"
FOREIGN KEY ("identityId") REFERENCES "auth"."identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
