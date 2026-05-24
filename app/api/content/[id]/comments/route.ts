import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { Content } from "@/models/Content";
import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { canReadContentForProject } from "@/lib/project-access";
import { hasPermission } from "@/lib/rbac";

const Body = z.object({ body: z.string().min(1).max(4000) });

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/content/[id]/comments">) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { id } = await ctx.params;
    await connectDB();
    const c = await Content.findById(id)
      .select("_id createdBy project isGeneralMarketing isDeleted comments")
      .populate("comments.by", "firstName lastName email profileImage");
    if (!c) return notFound();
    if (
      !canReadContentForProject(auth.ctx.role, auth.ctx.user, {
        createdBy: c.createdBy,
        project: c.project,
        isGeneralMarketing: c.isGeneralMarketing,
      })
    ) {
      return forbidden("You do not have access to this content");
    }
    return ok({ items: c.comments || [] });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/content/[id]/comments">) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    if (!hasPermission(auth.ctx.role, "content.comment")) {
      return forbidden("You cannot comment on content");
    }
    const { id } = await ctx.params;
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return badRequest("Invalid input", body.error.flatten());

    await connectDB();
    const c = await Content.findById(id);
    if (!c) return notFound();
    if (
      !canReadContentForProject(auth.ctx.role, auth.ctx.user, {
        createdBy: c.createdBy,
        project: c.project,
        isGeneralMarketing: c.isGeneralMarketing,
      })
    ) {
      return forbidden("You do not have access to this content");
    }

    const now = new Date();
    c.comments = c.comments || [];
    c.comments.push({ at: now, by: auth.ctx.user._id, body: body.data.body });
    await c.save();

    await logActivity({
      action: "content.commented",
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
      targetType: "Content",
      targetId: c._id,
      project: c.project ?? undefined,
    });
    return ok({ success: true }, 201);
  } catch (err) {
    return serverError(err);
  }
}
