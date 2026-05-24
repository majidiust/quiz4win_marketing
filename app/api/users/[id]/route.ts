import { z } from "zod";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { badRequest, notFound, ok, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { USER_ROLES, USER_STATUS } from "@/lib/constants";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/users/[id]">) {
  try {
    const auth = await requirePermission("users.read");
    if (!auth.ok) return auth.response;
    const { id } = await ctx.params;
    await connectDB();
    const user = await User.findById(id).populate("assignedProjects", "projectName slug logo");
    if (!user) return notFound();
    return ok({ user });
  } catch (err) {
    return serverError(err);
  }
}

const UpdateBody = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUS).optional(),
  assignedProjects: z.array(z.string()).optional(),
  profileImage: z.string().url().optional().or(z.literal("")),
  password: z.string().min(8).optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/users/[id]">) {
  try {
    const auth = await requirePermission("users.update");
    if (!auth.ok) return auth.response;
    const { id } = await ctx.params;
    const body = UpdateBody.safeParse(await req.json().catch(() => null));
    if (!body.success) return badRequest("Invalid input", body.error.flatten());

    await connectDB();
    const user = await User.findById(id);
    if (!user) return notFound();

    const updates: Record<string, unknown> = {};
    for (const k of ["firstName", "lastName", "role", "status", "assignedProjects", "profileImage"] as const) {
      if (body.data[k] !== undefined) updates[k] = body.data[k];
    }
    let activityAction: "user.updated" | "user.disabled" | "user.enabled" | "user.password_reset" = "user.updated";
    if (body.data.status && body.data.status !== user.status) {
      activityAction = body.data.status === "disabled" ? "user.disabled" : "user.enabled";
    }
    if (body.data.password) {
      const strength = validatePasswordStrength(body.data.password);
      if (!strength.ok) return badRequest(strength.message);
      updates.passwordHash = await hashPassword(body.data.password);
      updates.tokenVersion = (user.tokenVersion || 0) + 1;
      activityAction = "user.password_reset";
    }

    await User.updateOne({ _id: id }, { $set: updates });
    await logActivity({
      action: activityAction,
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
      targetType: "User",
      targetId: user._id,
      message: `Updated user ${user.email}`,
    });
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/users/[id]">) {
  try {
    const auth = await requirePermission("users.disable");
    if (!auth.ok) return auth.response;
    const { id } = await ctx.params;
    if (String(auth.ctx.userId) === id) return badRequest("You cannot disable your own account");
    await connectDB();
    const user = await User.findById(id);
    if (!user) return notFound();
    user.status = "disabled";
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    await logActivity({
      action: "user.disabled",
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
      targetType: "User",
      targetId: user._id,
    });
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
