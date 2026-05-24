import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User, type UserDoc } from "@/models/User";
import { getSessionFromCookies } from "./session";
import { hasPermission, type Permission } from "@/lib/rbac";
import type { UserRole } from "@/lib/constants";

export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  user: UserDoc;
}

export async function requireAuth(): Promise<
  { ok: true; ctx: AuthContext } | { ok: false; response: NextResponse }
> {
  const session = await getSessionFromCookies();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  await connectDB();
  const user = await User.findById(session.sub);
  if (!user || user.status !== "active") {
    return { ok: false, response: NextResponse.json({ error: "Account inactive" }, { status: 401 }) };
  }
  // Invalidate if the token version no longer matches (e.g. after password reset).
  if (typeof user.tokenVersion === "number" && user.tokenVersion !== session.tv) {
    return { ok: false, response: NextResponse.json({ error: "Session expired" }, { status: 401 }) };
  }
  return {
    ok: true,
    ctx: {
      userId: String(user._id),
      email: user.email,
      role: user.role as UserRole,
      user,
    },
  };
}

export async function requirePermission(perm: Permission) {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  if (!hasPermission(auth.ctx.role, perm)) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return auth;
}

export async function requireAnyRole(roles: UserRole[]) {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  if (!roles.includes(auth.ctx.role)) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return auth;
}
