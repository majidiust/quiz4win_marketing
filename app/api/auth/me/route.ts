import { requireAuth } from "@/lib/auth/guard";
import { ok, serverError } from "@/lib/api";
import { rolePermissions } from "@/lib/rbac";
import type { UserRole } from "@/lib/constants";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const u = auth.ctx.user;
    return ok({
      user: {
        id: String(u._id),
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        profileImage: u.profileImage,
        assignedProjects: u.assignedProjects,
        mfaEnabled: u.mfaEnabled,
        status: u.status,
        lastLoginAt: u.lastLoginAt,
        createdAt: (u as unknown as { createdAt?: Date }).createdAt,
      },
      permissions: rolePermissions(u.role as UserRole),
    });
  } catch (err) {
    return serverError(err);
  }
}
