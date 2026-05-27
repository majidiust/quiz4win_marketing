import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { ContentBrief } from "@/models/ContentBrief";
import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { notifyBriefEvent } from "@/lib/notifications";
import { canReadBrief } from "@/lib/brief-policy";
import { hasPermission } from "@/lib/rbac";

const Body = z.object({ body: z.string().min(1).max(4000) });

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/briefs/[id]/comments">) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { id } = await ctx.params;
    await connectDB();
    const b = await ContentBrief.findById(id)
      .select("_id status createdBy assignedTo project isGeneralMarketing isDeleted comments")
      .populate("comments.by", "firstName lastName email profileImage");
    if (!b) return notFound();
    if (
      !canReadBrief(auth.ctx.role, auth.ctx.user, {
        status: b.status,
        createdBy: b.createdBy,
        assignedTo: b.assignedTo,
        project: b.project,
        isGeneralMarketing: b.isGeneralMarketing,
        isDeleted: b.isDeleted,
      })
    ) {
      return forbidden("You do not have access to this brief");
    }
    return ok({ items: b.comments || [] });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/briefs/[id]/comments">) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    if (!hasPermission(auth.ctx.role, "briefs.comment")) {
      return forbidden("You cannot comment on briefs");
    }
    const { id } = await ctx.params;
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return badRequest("Invalid input", body.error.flatten());

    await connectDB();
    const b = await ContentBrief.findById(id);
    if (!b) return notFound();
    if (
      !canReadBrief(auth.ctx.role, auth.ctx.user, {
        status: b.status,
        createdBy: b.createdBy,
        assignedTo: b.assignedTo,
        project: b.project,
        isGeneralMarketing: b.isGeneralMarketing,
        isDeleted: b.isDeleted,
      })
    ) {
      return forbidden("You do not have access to this brief");
    }

    const now = new Date();
    b.comments = b.comments || [];
    b.comments.push({ at: now, by: auth.ctx.user._id, body: body.data.body });
    await b.save();

    await logActivity({
      action: "brief.commented",
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
      targetType: "ContentBrief",
      targetId: b._id,
      project: b.project ?? undefined,
    });
    void notifyBriefEvent({
      action: "brief.commented",
      briefId: String(b._id),
      briefTitle: b.title,
      actorEmail: auth.ctx.email,
      creatorId: b.createdBy,
      assigneeId: b.assignedTo ?? null,
    });
    return ok({ success: true }, 201);
  } catch (err) {
    return serverError(err);
  }
}
