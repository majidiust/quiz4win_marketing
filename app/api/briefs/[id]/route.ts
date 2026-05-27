import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { ContentBrief } from "@/models/ContentBrief";
import { User } from "@/models/User";
import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { notifyBriefEvent } from "@/lib/notifications";
import { canDeleteBrief, canEditBrief, canReadBrief } from "@/lib/brief-policy";
import {
  CONTENT_TYPES,
  FUNNEL_STAGES,
  PLATFORMS,
  PRIORITIES,
  RECURRENCE_FREQ,
  WEEKDAYS,
} from "@/lib/constants";
import { computeNextRunAt } from "@/lib/brief-recurrence";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/briefs/[id]">) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { id } = await ctx.params;
    await connectDB();
    const b = await ContentBrief.findById(id)
      .populate("project", "projectName slug logo brandColors isGeneralMarketing")
      .populate("createdBy", "firstName lastName email profileImage")
      .populate("assignedTo", "firstName lastName email profileImage")
      .populate("comments.by", "firstName lastName email profileImage")
      .populate("referenceMedia", "_id originalFilename mimeType storageKey size");
    if (!b) return notFound();
    const projectId = (b.project as { _id?: unknown } | null)?._id ?? b.project;
    if (
      !canReadBrief(auth.ctx.role, auth.ctx.user, {
        status: b.status,
        createdBy: b.createdBy,
        assignedTo: b.assignedTo,
        project: projectId,
        isGeneralMarketing: b.isGeneralMarketing,
        isDeleted: b.isDeleted,
      })
    ) {
      return forbidden("You do not have access to this brief");
    }
    return ok({ brief: b });
  } catch (err) {
    return serverError(err);
  }
}

const UpdateBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  goal: z.string().optional(),
  platform: z.enum(PLATFORMS).optional(),
  contentType: z.enum(CONTENT_TYPES).optional(),
  funnelStage: z.enum(FUNNEL_STAGES).optional(),
  language: z.string().optional(),
  targetCountry: z.string().optional(),
  targetAudience: z.string().optional(),
  suggestedHashtags: z.array(z.string()).optional(),
  suggestedMentions: z.array(z.string()).optional(),
  suggestedCTA: z.string().optional(),
  deadline: z.string().optional(),
  priority: z.enum(PRIORITIES).optional(),
  references: z
    .array(z.object({ label: z.string().optional(), url: z.string().url() }))
    .optional(),
  referenceMedia: z.array(z.string()).optional(),
  assignedTo: z.string().optional().nullable(),
  // Recurrence updates (templates only). Setting recurrence to null clears
  // the rule and turns the template back into a regular brief.
  recurrence: z
    .object({
      freq: z.enum(RECURRENCE_FREQ),
      interval: z.number().int().min(1).max(365).optional(),
      byweekday: z.array(z.enum(WEEKDAYS)).optional(),
      bymonthday: z.number().int().min(1).max(31).optional(),
      startsAt: z.string(),
      endsAt: z.string().optional().nullable(),
      timezone: z.string().optional(),
    })
    .optional()
    .nullable(),
  deadlineOffsetHours: z.number().min(0).max(24 * 365).optional().nullable(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/briefs/[id]">) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { id } = await ctx.params;
    const body = UpdateBody.safeParse(await req.json().catch(() => null));
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
    if (
      !canEditBrief(auth.ctx.role, auth.ctx.userId, {
        status: b.status,
        createdBy: b.createdBy,
        isDeleted: b.isDeleted,
      })
    ) {
      return forbidden("This brief cannot be edited at its current status");
    }

    const changes: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body.data)) {
      if (v === undefined) continue;
      if (k === "deadline" && typeof v === "string") changes[k] = new Date(v);
      else if (k === "assignedTo") {
        if (v === null || v === "") changes.assignedTo = null;
        else {
          const u = await User.findById(v).select("_id status");
          if (!u || u.status !== "active") return badRequest("Assignee not found or inactive");
          changes.assignedTo = u._id;
          if (!b.assignedAt) changes.assignedAt = new Date();
        }
      } else if (k === "recurrence") {
        // Only templates carry a recurrence rule. Editing recurrence on a
        // non-template would be a no-op at best and a footgun at worst.
        if (!b.isTemplate) continue;
        if (v === null) {
          changes.recurrence = undefined;
          changes.nextRunAt = undefined;
        } else {
          const r = v as {
            freq: typeof RECURRENCE_FREQ[number]; interval?: number;
            byweekday?: typeof WEEKDAYS[number][]; bymonthday?: number;
            startsAt: string; endsAt?: string | null; timezone?: string;
          };
          const rule = {
            freq: r.freq,
            interval: r.interval ?? 1,
            byweekday: r.byweekday ?? [],
            bymonthday: r.bymonthday,
            startsAt: new Date(r.startsAt),
            endsAt: r.endsAt ? new Date(r.endsAt) : undefined,
            timezone: r.timezone || "UTC",
          };
          changes.recurrence = rule;
          changes.nextRunAt = computeNextRunAt(
            { ...rule, endsAt: rule.endsAt ?? null },
            b.lastRunAt ?? null
          ) ?? undefined;
        }
      } else if (k === "deadlineOffsetHours") {
        changes.deadlineOffsetHours = v === null ? undefined : v;
      } else changes[k] = v;
    }
    Object.assign(b, changes);
    await b.save();

    await logActivity({
      action: "brief.updated",
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
      targetType: "ContentBrief",
      targetId: b._id,
      project: b.project ?? undefined,
    });
    void notifyBriefEvent({
      action: "brief.updated",
      briefId: String(b._id),
      briefTitle: b.title,
      actorEmail: auth.ctx.email,
      creatorId: b.createdBy,
      assigneeId: b.assignedTo ?? null,
    });
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/briefs/[id]">) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { id } = await ctx.params;
    await connectDB();
    const b = await ContentBrief.findById(id);
    if (!b) return notFound();
    if (!canDeleteBrief(auth.ctx.role, auth.ctx.userId, { status: b.status, createdBy: b.createdBy })) {
      return forbidden("You cannot delete this brief");
    }
    b.isDeleted = true;
    b.deletedAt = new Date();
    b.deletedBy = auth.ctx.user._id;
    await b.save();
    await logActivity({
      action: "brief.deleted",
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
      targetType: "ContentBrief",
      targetId: b._id,
      project: b.project ?? undefined,
    });
    void notifyBriefEvent({
      action: "brief.deleted",
      briefId: String(b._id),
      briefTitle: b.title,
      actorEmail: auth.ctx.email,
      creatorId: b.createdBy,
      assigneeId: b.assignedTo ?? null,
    });
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
