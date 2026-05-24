import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { Content } from "@/models/Content";
import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { CONTENT_STATUS, type ActivityAction } from "@/lib/constants";
import { canTransition, requiresReason } from "@/lib/content-policy";
import { canReadContentForProject } from "@/lib/project-access";
import { hasPermission } from "@/lib/rbac";

const Body = z.object({
  toStatus: z.enum(CONTENT_STATUS),
  reason: z.string().optional(),
  reviewerComment: z.string().optional(),
  scheduledAt: z.string().optional(),
});

const STATUS_TO_ACTION: Partial<Record<string, ActivityAction>> = {
  under_review: "content.submitted",
  approved: "content.approved",
  rejected: "content.rejected",
  scheduled: "content.scheduled",
  published: "content.published",
  failed: "content.publish_failed",
  archived: "content.archived",
  deleted: "content.deleted",
  draft: "content.updated",
};

export async function POST(req: NextRequest, ctx: RouteContext<"/api/content/[id]/transition">) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { id } = await ctx.params;
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return badRequest("Invalid input");
    const { toStatus, reason, reviewerComment, scheduledAt } = body.data;

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
    if (c.isDeleted && toStatus !== "draft") return forbidden("Content is deleted");

    // Permission gating per transition.
    const role = auth.ctx.role;
    const isOwner = String(c.createdBy) === auth.ctx.userId;
    const guards: Record<string, () => boolean> = {
      under_review: () => isOwner || hasPermission(role, "content.submit"),
      approved: () => hasPermission(role, "content.approve"),
      rejected: () => hasPermission(role, "content.reject"),
      scheduled: () => hasPermission(role, "content.schedule"),
      published: () => hasPermission(role, "content.publish"),
      archived: () => hasPermission(role, "content.archive"),
      deleted: () => (isOwner && hasPermission(role, "content.delete.own")) || hasPermission(role, "content.delete.any"),
      draft: () => isOwner || hasPermission(role, "content.update.any"),
      failed: () => hasPermission(role, "content.publish"),
    };
    const guard = guards[toStatus];
    if (guard && !guard()) return forbidden("You cannot perform this transition");

    if (!canTransition(c.status, toStatus)) {
      return badRequest(`Invalid transition from "${c.status}" to "${toStatus}"`);
    }
    if (requiresReason(toStatus) && !reason?.trim()) {
      return badRequest("A reason is required for rejection");
    }

    const fromStatus = c.status;
    const now = new Date();
    c.status = toStatus;
    c.statusChangedAt = now;
    if (toStatus === "under_review") {
      c.reviewedBy = undefined;
    }
    if (toStatus === "approved") {
      c.approvedBy = auth.ctx.user._id;
      c.approvalDate = now;
      c.reviewerComment = reviewerComment || c.reviewerComment;
      c.rejectionReason = "";
    }
    if (toStatus === "rejected") {
      c.rejectedBy = auth.ctx.user._id;
      c.rejectionDate = now;
      c.rejectionReason = reason || "";
      c.reviewerComment = reviewerComment || c.reviewerComment;
    }
    if (toStatus === "scheduled") {
      if (scheduledAt) c.scheduledAt = new Date(scheduledAt);
      else if (c.publishDate) c.scheduledAt = c.publishDate;
    }
    if (toStatus === "published") {
      c.publishedAt = now;
    }
    if (toStatus === "failed") {
      c.failedAt = now;
      c.publishRetryCount = (c.publishRetryCount || 0) + 1;
    }
    if (toStatus === "deleted") {
      c.isDeleted = true;
      c.deletedAt = now;
      c.deletedBy = auth.ctx.user._id;
    }
    if (toStatus === "draft" && c.isDeleted) {
      c.isDeleted = false;
      c.deletedAt = undefined;
    }

    c.activityLog = c.activityLog || [];
    c.activityLog.push({
      at: now,
      by: auth.ctx.user._id,
      action: `transition:${fromStatus}->${toStatus}`,
      fromStatus,
      toStatus,
      note: reason || reviewerComment || "",
    });
    await c.save();

    const action = STATUS_TO_ACTION[toStatus] || "content.updated";
    await logActivity({
      action,
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
      targetType: "Content",
      targetId: c._id,
      project: c.project ?? undefined,
      message: `${fromStatus} → ${toStatus}${reason ? ` (${reason})` : ""}`,
    });
    return ok({ success: true, status: c.status });
  } catch (err) {
    return serverError(err);
  }
}
