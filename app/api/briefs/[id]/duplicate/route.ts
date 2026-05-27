import { z } from "zod";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { ContentBrief } from "@/models/ContentBrief";
import { User } from "@/models/User";
import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { notifyBriefEvent } from "@/lib/notifications";
import { canReadBrief } from "@/lib/brief-policy";
import {
  canAccessProject,
  canCreateGeneralMarketing,
} from "@/lib/project-access";
import type { BriefStatus } from "@/lib/constants";

// Duplicate a brief into a fresh, regular (non-template) brief that the caller
// owns. The clone can optionally be assigned to a different user in the same
// request, which is the common use case (PM duplicating a finished brief and
// handing it off to another producer).
const Body = z.object({
  assignedTo: z.string().nullable().optional(),
  title: z.string().min(1).optional(),
});

export async function POST(req: NextRequest, ctx: RouteContext<"/api/briefs/[id]/duplicate">) {
  try {
    const auth = await requirePermission("briefs.create");
    if (!auth.ok) return auth.response;
    const { id } = await ctx.params;
    const body = Body.safeParse(await req.json().catch(() => ({})));
    if (!body.success) return badRequest("Invalid input", body.error.flatten());

    await connectDB();
    const src = await ContentBrief.findById(id);
    if (!src) return notFound();
    if (
      !canReadBrief(auth.ctx.role, auth.ctx.user, {
        status: src.status,
        createdBy: src.createdBy,
        assignedTo: src.assignedTo,
        project: src.project,
        isGeneralMarketing: src.isGeneralMarketing,
        isDeleted: src.isDeleted,
      })
    ) {
      return forbidden("You do not have access to this brief");
    }

    // Project / general-marketing gating mirrors the create endpoint so we
    // don't let a caller bypass either by going through duplicate.
    if (src.isGeneralMarketing && !canCreateGeneralMarketing(auth.ctx.role)) {
      return forbidden("You are not allowed to create General Marketing briefs");
    }
    if (src.project && !canAccessProject(auth.ctx.role, auth.ctx.user, String(src.project))) {
      return forbidden("You are not assigned to this project");
    }

    // Resolve the new assignee. `null` / omitted means leave unassigned.
    let assignedTo: string | undefined;
    if (body.data.assignedTo) {
      const u = await User.findById(body.data.assignedTo).select("_id status");
      if (!u || u.status !== "active") return badRequest("Assignee not found or inactive");
      assignedTo = String(u._id);
    }

    const now = new Date();
    const initialStatus: BriefStatus = assignedTo ? "assigned" : "created";
    const title = body.data.title?.trim() || `${src.title} (copy)`;

    // Whitelist the fields we copy. Anything stateful (workflow status,
    // audit log, comments, recurrence wiring, soft-delete markers) is reset.
    const clone = await ContentBrief.create({
      title,
      description: src.description,
      project: src.project,
      isGeneralMarketing: src.isGeneralMarketing,
      goal: src.goal,
      platform: src.platform,
      contentType: src.contentType,
      funnelStage: src.funnelStage,
      language: src.language,
      targetCountry: src.targetCountry,
      targetAudience: src.targetAudience,
      suggestedHashtags: src.suggestedHashtags,
      suggestedMentions: src.suggestedMentions,
      suggestedCTA: src.suggestedCTA,
      deadline: src.deadline,
      priority: src.priority,
      references: src.references,
      referenceMedia: src.referenceMedia,
      assignedTo,
      assignedAt: assignedTo ? now : undefined,
      status: initialStatus,
      statusChangedAt: now,
      createdBy: auth.ctx.userId,
      // Duplicates are always plain briefs — never templates and never linked
      // back to the source's template chain.
      isTemplate: false,
      activityLog: [
        {
          at: now,
          by: auth.ctx.user._id,
          action: "duplicated",
          toStatus: initialStatus,
          note: `Duplicated from ${String(src._id)}`,
        },
      ],
    });

    await logActivity({
      action: "brief.duplicated",
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
      targetType: "ContentBrief",
      targetId: clone._id,
      project: clone.project ?? undefined,
      message: `Duplicated brief "${src.title}" as "${clone.title}"`,
    });
    if (assignedTo) {
      await logActivity({
        action: "brief.assigned",
        actor: auth.ctx.userId,
        actorEmail: auth.ctx.email,
        targetType: "ContentBrief",
        targetId: clone._id,
        project: clone.project ?? undefined,
        message: `Assigned to ${assignedTo}`,
      });
    }
    void notifyBriefEvent({
      action: "brief.duplicated",
      briefId: String(clone._id),
      briefTitle: clone.title,
      actorEmail: auth.ctx.email,
      creatorId: clone.createdBy,
      assigneeId: clone.assignedTo ?? null,
      note: `Duplicated from "${src.title}"`,
    });
    return ok({ id: String(clone._id) }, 201);
  } catch (err) {
    return serverError(err);
  }
}
