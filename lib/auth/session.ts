import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { verifyJwt, signJwt, type JwtPayload } from "./jwt";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: "lax" as const,
  path: "/",
};

// Server-side: read JWT cookie and verify.
export async function getSessionFromCookies(): Promise<JwtPayload | null> {
  const c = await cookies();
  const token = c.get(env.sessionCookieName)?.value;
  if (!token) return null;
  const payload = verifyJwt(token);
  if (!payload) return null;
  if (payload.mfa === "pending") return null; // not yet authenticated
  return payload;
}

// Used by Route Handlers to set the session cookie after a successful login.
export async function setSessionCookie(payload: Omit<JwtPayload, "mfa">) {
  const token = signJwt(payload);
  const c = await cookies();
  c.set(env.sessionCookieName, token, {
    ...COOKIE_OPTS,
    maxAge: 60 * 60 * 24 * 7,
    domain: env.sessionCookieDomain,
  });
}

// Sets a short-lived cookie used between password step and MFA step.
export async function setMfaPendingCookie(token: string) {
  const c = await cookies();
  c.set(`${env.sessionCookieName}_mfa`, token, {
    ...COOKIE_OPTS,
    maxAge: 60 * 10,
    domain: env.sessionCookieDomain,
  });
}

export async function getMfaPendingPayload(): Promise<JwtPayload | null> {
  const c = await cookies();
  const token = c.get(`${env.sessionCookieName}_mfa`)?.value;
  if (!token) return null;
  const payload = verifyJwt(token);
  if (!payload || payload.mfa !== "pending") return null;
  return payload;
}

export async function clearAllSessionCookies() {
  const c = await cookies();
  c.delete(env.sessionCookieName);
  c.delete(`${env.sessionCookieName}_mfa`);
}
