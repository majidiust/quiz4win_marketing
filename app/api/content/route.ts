import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireAuth, requirePermission } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { Content } from "@/models/Content";
import { ContentBrief, type ContentBriefDoc } from "@/models/ContentBrief";
import type { HydratedDocument } from "mongoose";
import { Project } from "@/models/Project";
import { badRequest, forbidden, ok, parsePagination, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { canReadBrief } from "@/lib/brief-policy";
import {
  CONTENT_STATUS,
  CONTENT_TYPES,
  FUNNEL_STAGES,
  PLATFORMS,
  PRIORITIES,
  type ContentStatus,
} from "@/lib/constants";
import { hasPermission } from "@/lib/rbac";
import {
  canAccessProject,
  canCreateGeneralMarketing,
  userAssignedProjectIds,
} from "@/lib/project-access";
import { slugify } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp);

    const q = sp.get("q")?.trim();
    const project = sp.get("project");
    const platform = sp.get("platform");
    const status = sp.get("status");
    const user = sp.get("user");
    const language = sp.get("language");
    const campaign = sp.get("campaign");
    const contentType = sp.get("contentType");
    const dateFrom = sp.get("dateFrom");
    const dateTo = sp.get("dateTo");
    const isGeneral = sp.get("general");
    const includeDeleted = sp.get("includeDeleted") === "true";
    // scope=mine restricts to content created by or assigned to the
    // requester. scope=all opens the view subject to permissions (see below).
    // Default is "mine" for everyone except super_admin, whose default is
    // "all" so they see the full library without flipping a toggle.
    const scopeParam = sp.get("scope");
    const scope =
      scopeParam === "all" ? "all"
      : scopeParam === "mine" ? "mine"
      : auth.ctx.role === "super_admin" ? "all" : "mine";

    await connectDB();

    const filter: Record<string, unknown> = {};
    if (!includeDeleted) filter.isDeleted = { $ne: true };
    if (project) filter.project = project;
    if (platform) filter.platform = platform;
    if (status) filter.status = status;
    if (user) filter.createdBy = user;
    if (language) filter.language = language;
    if (campaign) filter.campaignName = campaign;
    if (contentType) filter.contentType = contentType;
    if (isGeneral === "true") filter.isGeneralMarketing = true;
    if (dateFrom || dateTo) {
      filter.publishDate = {} as Record<string, Date>;
      if (dateFrom) (filter.publishDate as Record<string, Date>).$gte = new Date(dateFrom);
      if (dateTo) (filter.publishDate as Record<string, Date>).$lte = new Date(dateTo);
    }
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ title: re }, { caption: re }, { campaignName: re }, { internalReferenceId: re }];
    }

    // Scoping:
    // - scope=mine (default): personal queue, regardless of role. Anything
    //   the requester created or is assigned to.
    // - scope=all + content.read.any: see everything subject to filters.
    // - scope=all without content.read.any: project-scoped fallback
    //   (own + assigned + general marketing). A project filter outside the
    //   assigned set is intersected with own/assigned so users can never
    //   widen their view.
    const canSeeAny = hasPermission(auth.ctx.role, "content.read.any");
    const applyScope = (clauses: Record<string, unknown>[]) => {
      if (filter.$or) {
        const text = filter.$or;
        delete filter.$or;
        (filter as Record<string, unknown>).$and = [{ $or: text }, { $or: clauses }];
      } else {
        filter.$or = clauses;
      }
    };
    if (scope === "mine") {
      applyScope([
        { createdBy: auth.ctx.userId },
        { assignedTo: auth.ctx.userId },
      ]);
    } else if (!canSeeAny) {
      const assigned = userAssignedProjectIds(auth.ctx.user);
      if (project && !assigned.includes(String(project))) {
        applyScope([
          { createdBy: auth.ctx.userId, project },
          { assignedTo: auth.ctx.userId, project },
        ]);
      } else {
        const fallback: Record<string, unknown>[] = [
          { createdBy: auth.ctx.userId },
          { assignedTo: auth.ctx.userId },
          { isGeneralMarketing: true },
        ];
        if (assigned.length) fallback.push({ project: { $in: assigned } });
        applyScope(fallback);
      }
    }

    const [items, total] = await Promise.all([
      Content.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("project", "projectName slug logo isGeneralMarketing")
        .populate("createdBy", "firstName lastName email profileImage"),
      Content.countDocuments(filter),
    ]);
    return ok({ items, total, page, limit });
  } catch (err) {
    return serverError(err);
  }
}

const CreateBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  internalReferenceId: z.string().optional(),
  project: z.string().optional(),
  isGeneralMarketing: z.boolean().optional(),
  brief: z.string().optional(),
  contentType: z.enum(CONTENT_TYPES),
  platform: z.enum(PLATFORMS),
  status: z.enum(CONTENT_STATUS).optional(),
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
  publishDate: z.string().datetime().optional(),
  publishTime: z.string().optional(),
  timezone: z.string().optional(),
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

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("content.create");
    if (!auth.ok) return auth.response;
    const body = CreateBody.safeParse(await req.json().catch(() => null));
    if (!body.success) return badRequest("Invalid input", body.error.flatten());

    await connectDB();

    // Every piece of content must belong to a project, or be flagged as
    // general marketing by a role authorised to do so.
    const wantsGeneral = !!body.data.isGeneralMarketing;
    if (!wantsGeneral && !body.data.project) {
      return badRequest("A project is required (or mark as General Marketing)");
    }
    if (wantsGeneral && !canCreateGeneralMarketing(auth.ctx.role)) {
      return forbidden("You are not allowed to create General Marketing content");
    }

    let projectId: string | undefined;
    if (!wantsGeneral && body.data.project) {
      const project = await Project.findById(body.data.project).select("_id isGeneralMarketing");
      if (!project) return badRequest("Project not found");
      if (project.isGeneralMarketing && !canCreateGeneralMarketing(auth.ctx.role)) {
        return forbidden("You are not allowed to post to the General Marketing project");
      }
      if (!canAccessProject(auth.ctx.role, auth.ctx.user, String(project._id))) {
        return forbidden("You are not assigned to this project");
      }
      projectId = String(project._id);
    }

    // If a brief is provided, verify the caller can see it. We then snap the
    // brief out of "created"/"assigned" into "in_progress" once the first
    // child content lands.
    let briefDoc: HydratedDocument<ContentBriefDoc> | null = null;
    if (body.data.brief) {
      briefDoc = await ContentBrief.findById(body.data.brief);
      if (!briefDoc) return badRequest("Brief not found");
      if (
        !canReadBrief(auth.ctx.role, auth.ctx.user, {
          status: briefDoc.status,
          createdBy: briefDoc.createdBy,
          assignedTo: briefDoc.assignedTo,
          project: briefDoc.project,
          isGeneralMarketing: briefDoc.isGeneralMarketing,
          isDeleted: briefDoc.isDeleted,
        })
      ) {
        return forbidden("You do not have access to this brief");
      }
    }

    const initialStatus: ContentStatus = body.data.status || "draft";
    const slug = slugify(body.data.title);

    const content = await Content.create({
      ...body.data,
      project: projectId,
      isGeneralMarketing: wantsGeneral,
      brief: briefDoc?._id,
      slug,
      publishDate: body.data.publishDate ? new Date(body.data.publishDate) : undefined,
      status: initialStatus,
      createdBy: auth.ctx.userId,
      statusChangedAt: new Date(),
      activityLog: [{ action: "created", by: auth.ctx.userId, toStatus: initialStatus }],
    });
    await logActivity({
      action: "content.created",
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
      targetType: "Content",
      targetId: content._id,
      project: content.project ?? undefined,
      message: `Created content "${content.title}"`,
    });
    if (briefDoc && (briefDoc.status === "created" || briefDoc.status === "assigned")) {
      const now = new Date();
      briefDoc.status = "in_progress";
      briefDoc.statusChangedAt = now;
      briefDoc.activityLog = briefDoc.activityLog || [];
      briefDoc.activityLog.push({
        at: now,
        by: auth.ctx.user._id,
        action: "auto:content_created",
        toStatus: "in_progress",
      });
      await briefDoc.save();
      await logActivity({
        action: "brief.in_progress",
        actor: auth.ctx.userId,
        actorEmail: auth.ctx.email,
        targetType: "ContentBrief",
        targetId: briefDoc._id,
        project: briefDoc.project ?? undefined,
        message: `Auto-advanced to in_progress (content ${String(content._id)})`,
      });
    }
    return ok({ id: String(content._id) }, 201);
  } catch (err) {
    return serverError(err);
  }
}
