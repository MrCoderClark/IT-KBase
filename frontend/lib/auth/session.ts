import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { resolveSession, revokePresentedSession } from "../../../auth/web/src/read-session";
import { prisma } from "@/lib/db";
import { authStore } from "./store";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "__Host-tb_session";

export type AppSession = {
  sessionId: string;
  identityId: string;
  userId: string;
  email: string;
  name: string;
  role: "reader" | "author" | "reviewer" | "admin";
};

export function sessionCookieName(): string {
  return COOKIE_NAME;
}

export function appOrigin(headerList: Headers): string {
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function requestMeta(headerList: Headers): { ip: string | null; userAgent: string | null } {
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || headerList.get("x-real-ip") || null;
  const userAgent = headerList.get("user-agent");
  return { ip, userAgent };
}

/** Clock read for a real request. `cacheComponents` rejects a bare `new Date()` during prerender. */
export async function requestTime(): Promise<Date> {
  await connection();
  return new Date();
}

export async function getSession(): Promise<AppSession | null> {
  const now = await requestTime();
  const jar = await cookies();
  const secret = jar.get(COOKIE_NAME)?.value;
  const active = await resolveSession(authStore, secret, now);
  if (!active) return null;

  const user = await prisma.user.findUnique({
    where: { identityId: active.identityId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) return null;

  return {
    sessionId: active.sessionId,
    identityId: active.identityId,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function setSessionCookie(secret: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, secret, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  const secret = jar.get(COOKIE_NAME)?.value;
  await revokePresentedSession(authStore, secret, await requestTime());
  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function currentRequestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  return requestMeta(await headers());
}
