/*
  Warnings:

  - A unique constraint covering the columns `[identityId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "auth";

-- CreateEnum
CREATE TYPE "ArticleVisibility" AS ENUM ('private', 'public');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "visibility" "ArticleVisibility" NOT NULL DEFAULT 'private';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "identityId" TEXT;

-- CreateTable
CREATE TABLE "auth"."identity" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "sessionGen" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."session" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "idleAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."email_token" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."login_attempt" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "attempted" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."audit_event" (
    "id" TEXT NOT NULL,
    "identityId" TEXT,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "identity_email_key" ON "auth"."identity"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_secretHash_key" ON "auth"."session"("secretHash");

-- CreateIndex
CREATE INDEX "session_identityId_idx" ON "auth"."session"("identityId");

-- CreateIndex
CREATE UNIQUE INDEX "email_token_tokenHash_key" ON "auth"."email_token"("tokenHash");

-- CreateIndex
CREATE INDEX "email_token_identityId_idx" ON "auth"."email_token"("identityId");

-- CreateIndex
CREATE INDEX "login_attempt_key_attempted_idx" ON "auth"."login_attempt"("key", "attempted");

-- CreateIndex
CREATE INDEX "audit_event_identityId_createdAt_idx" ON "auth"."audit_event"("identityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_identityId_key" ON "User"("identityId");

-- AddForeignKey
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "auth"."identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."email_token" ADD CONSTRAINT "email_token_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "auth"."identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
