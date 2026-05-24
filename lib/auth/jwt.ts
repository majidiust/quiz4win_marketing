import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "@/lib/env";
import type { UserRole } from "@/lib/constants";

export interface JwtPayload {
  sub: string;            // user id
  email: string;
  role: UserRole;
  tv: number;             // token version
  mfa?: "pending" | "passed";
}

export function signJwt(payload: JwtPayload, expiresIn?: string): string {
  const opts: SignOptions = {
    expiresIn: (expiresIn || env.jwtExpiresIn) as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.jwtSecret(), opts);
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, env.jwtSecret()) as JwtPayload;
  } catch {
    return null;
  }
}

export function signMfaChallengeToken(userId: string, email: string, role: UserRole, tv: number): string {
  return signJwt({ sub: userId, email, role, tv, mfa: "pending" }, "10m");
}
