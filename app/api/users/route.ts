import { z } from "zod";
import { requirePermission } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { badRequest, ok, parsePagination, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { USER_ROLES, USER_STATUS } from "@/lib/constants";
import type { NextRequest } from "next/server";

const ListQuery = z.object({
  q: z.string().optional(),
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUS).optional(),
  project: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission("users.read");
    if (!auth.ok) return auth.response;
    const sp = req.nextUrl.searchParams;
    const q = ListQuery.safeParse({
      q: sp.get("q") ?? undefined,
      role: sp.get("role") ?? undefined,
      status: sp.get("status") ?? undefined,
      project: sp.get("project") ?? undefined,
    });
    if (!q.success) return badRequest("Invalid filters");

    const { page, limit, skip } = parsePagination(sp);
    await connectDB();
    const filter: Record<string, unknown> = {};
    if (q.data.q) {
      const re = new RegExp(q.data.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ firstName: re }, { lastName: re }, { email: re }];
    }
    if (q.data.role) filter.role = q.data.role;
    if (q.data.status) filter.status = q.data.status;
    if (q.data.project) filter.assignedProjects = q.data.project;

    const [items, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("assignedProjects", "projectName slug"),
      User.countDocuments(filter),
    ]);

    return ok({ items, total, page, limit });
  } catch (err) {
    return serverError(err);
  }
}

const CreateBody = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(USER_ROLES),
  assignedProjects: z.array(z.string()).optional(),
  status: z.enum(USER_STATUS).optional(),
});

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("users.create");
    if (!auth.ok) return auth.response;
    const body = CreateBody.safeParse(await req.json().catch(() => null));
    if (!body.success) return badRequest("Invalid input", body.error.flatten());
    const strength = validatePasswordStrength(body.data.password);
    if (!strength.ok) return badRequest(strength.message);

    await connectDB();
    const exists = await User.findOne({ email: body.data.email.toLowerCase() });
    if (exists) return badRequest("A user with this email already exists");

    const passwordHash = await hashPassword(body.data.password);
    const user = await User.create({
      firstName: body.data.firstName,
      lastName: body.data.lastName,
      email: body.data.email.toLowerCase(),
      passwordHash,
      role: body.data.role,
      status: body.data.status || "active",
      assignedProjects: body.data.assignedProjects || [],
    });

    await logActivity({
      action: "user.created",
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
      targetType: "User",
      targetId: user._id,
      message: `Created user ${user.email}`,
    });

    return ok({ id: String(user._id) }, 201);
  } catch (err) {
    return serverError(err);
  }
}
