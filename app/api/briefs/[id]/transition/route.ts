import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { ContentBrief } from "@/models/ContentBrief";
import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { notifyBriefEvent } from "@/lib/notifications";
import { BRIEF_STATUS, type ActivityAction } from "@/lib/constants";
import { canPerformBriefTransition, canReadBrief, canTransitionBrief } from "@/lib/brief-policy";

const Body = z.object({
  toStatus: z.enum(BRIEF_STATUS),
  note: z.string().optional(),
});

const STATUS_TO_ACTION: Partial<Record<string, ActivityAction>> = {
  assigned: "brief.assigned",
  in_progress: "brief.in_progress",
  completed: "brief.completed",
  archived: "brief.archived",
  created: "brief.updated",
};

export async function POST(req: NextRequest, ctx: RouteContext<"/api/briefs/[id]/transition">) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { id } = await ctx.params;
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return badRequest("Invalid input");
    const { toStatus, note } = body.data;

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
    if (!canPerformBriefTransition(auth.ctx.role, toStatus)) {
      return forbidden("You cannot perform this transition");
    }
    if (!canTransitionBrief(b.status, toStatus, auth.ctx.role)) {
      return badRequest(`Invalid transition from "${b.status}" to "${toStatus}"`);
    }

    const fromStatus = b.status;
    const now = new Date();
    b.status = toStatus;
    b.statusChangedAt = now;
    if (toStatus === "completed") b.completedAt = now;

    b.activityLog = b.activityLog || [];
    b.activityLog.push({
      at: now,
      by: auth.ctx.user._id,
      action: `transition:${fromStatus}->${toStatus}`,
      fromStatus,
      toStatus,
      note: note || "",
    });
    await b.save();

    const action = STATUS_TO_ACTION[toStatus] || "brief.updated";
    await logActivity({
      action,
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
      targetType: "ContentBrief",
      targetId: b._id,
      project: b.project ?? undefined,
      message: `${fromStatus} → ${toStatus}${note ? ` (${note})` : ""}`,
    });
    void notifyBriefEvent({
      action,
      briefId: String(b._id),
      briefTitle: b.title,
      actorEmail: auth.ctx.email,
      creatorId: b.createdBy,
      assigneeId: b.assignedTo ?? null,
      note: note || `Status changed from ${fromStatus} to ${toStatus}`,
    });
    return ok({ success: true, status: b.status });
  } catch (err) {
    return serverError(err);
  }
}
