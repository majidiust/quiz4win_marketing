import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { Content } from "@/models/Content";
import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { canEditContent, canDeleteContent } from "@/lib/content-policy";
import { canReadContentForProject } from "@/lib/project-access";
import { CONTENT_TYPES, FUNNEL_STAGES, PLATFORMS, PRIORITIES } from "@/lib/constants";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/content/[id]">) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { id } = await ctx.params;
    await connectDB();
    const c = await Content.findById(id)
      .populate("project", "projectName slug logo brandColors isGeneralMarketing")
      .populate("createdBy", "firstName lastName email profileImage")
      .populate("assignedTo", "firstName lastName email profileImage")
      .populate("reviewedBy", "firstName lastName email")
      .populate("approvedBy", "firstName lastName email")
      .populate("rejectedBy", "firstName lastName email");
    if (!c) return notFound();
    // Use the raw project id (populated docs expose _id), falling back to the
    // raw scalar if populate failed.
    const projectId = (c.project as { _id?: unknown } | null)?._id ?? c.project;
    if (
      !canReadContentForProject(auth.ctx.role, auth.ctx.user, {
        createdBy: c.createdBy,
        project: projectId,
        isGeneralMarketing: c.isGeneralMarketing,
      })
    ) {
      return forbidden("You do not have access to this content");
    }
    return ok({ content: c });
  } catch (err) {
    return serverError(err);
  }
}

const UpdateBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  internalReferenceId: z.string().optional(),
  contentType: z.enum(CONTENT_TYPES).optional(),
  platform: z.enum(PLATFORMS).optional(),
  priority: z.enum(PRIORITIES).optional(),
  funnelStage: z.enum(FUNNEL_STAGES).optional(),
  caption: z.string().optional(),
  shortCaption: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  cta: z.string().optional(),
  targetUrl: z.string().optional(),
  language: z.string().optional(),
  targetCountry: z.string().optional(),
  targetAudience: z.string().optional(),
  campaignName: z.string().optional(),
  campaignGoal: z.string().optional(),
  publishDate: z.string().optional(),
  publishTime: z.string().optional(),
  timezone: z.string().optional(),
  storyText: z.string().optional(),
  reelScript: z.string().optional(),
  videoScript: z.string().optional(),
  firstComment: z.string().optional(),
  mentions: z.array(z.string()).optional(),
  locationTag: z.string().optional(),
  productTag: z.string().optional(),
  linkInBioReference: z.string().optional(),
  contentFormat: z.string().optional(),
  designNotes: z.string().optional(),
  brandGuidelinesNotes: z.string().optional(),
  complianceNotes: z.string().optional(),
  altText: z.string().optional(),
  aspectRatio: z.string().optional(),
  duration: z.number().optional(),
  fileRequirements: z.string().optional(),
  assignedTo: z.string().optional(),
  mediaFiles: z
    .array(
      z.object({
        mediaFile: z.string().optional(),
        url: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        mimeType: z.string().optional(),
        altText: z.string().optional(),
        order: z.number().optional(),
      })
    )
    .optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/content/[id]">) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { id } = await ctx.params;
    const body = UpdateBody.safeParse(await req.json().catch(() => null));
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
    if (
      !canEditContent(auth.ctx.role, auth.ctx.userId, {
        status: c.status,
        createdBy: String(c.createdBy),
        isDeleted: c.isDeleted,
      })
    ) {
      return forbidden("This content cannot be edited at its current status");
    }

    const changes: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body.data)) {
      if (v !== undefined) {
        if (k === "publishDate" && typeof v === "string") {
          changes[k] = new Date(v);
        } else {
          changes[k] = v;
        }
      }
    }
    Object.assign(c, changes);
    c.version = (c.version || 1) + 1;
    c.editHistory = c.editHistory || [];
    c.editHistory.push({ at: new Date(), by: auth.ctx.user._id, changes });
    await c.save();

    await logActivity({
      action: "content.updated",
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
      targetType: "Content",
      targetId: c._id,
      project: c.project ?? undefined,
    });
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/content/[id]">) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { id } = await ctx.params;
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
    if (
      !canDeleteContent(auth.ctx.role, auth.ctx.userId, {
        status: c.status,
        createdBy: String(c.createdBy),
      })
    ) {
      return forbidden("You cannot delete this content");
    }
    c.isDeleted = true;
    c.deletedAt = new Date();
    c.deletedBy = auth.ctx.user._id;
    c.status = "deleted";
    c.statusChangedAt = new Date();
    c.activityLog = c.activityLog || [];
    c.activityLog.push({ at: new Date(), by: auth.ctx.user._id, action: "deleted", toStatus: "deleted" });
    await c.save();
    await logActivity({
      action: "content.deleted",
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
      targetType: "Content",
      targetId: c._id,
      project: c.project ?? undefined,
    });
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
