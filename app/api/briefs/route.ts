import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireAuth, requirePermission } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { ContentBrief } from "@/models/ContentBrief";
import { Project } from "@/models/Project";
import { User } from "@/models/User";
import { badRequest, forbidden, ok, parsePagination, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import {
  BRIEF_STATUS,
  CONTENT_TYPES,
  FUNNEL_STAGES,
  PLATFORMS,
  PRIORITIES,
  RECURRENCE_FREQ,
  WEEKDAYS,
  type BriefStatus,
} from "@/lib/constants";
import { hasPermission } from "@/lib/rbac";
import {
  canAccessProject,
  canCreateGeneralMarketing,
  userAssignedProjectIds,
} from "@/lib/project-access";
import { computeNextRunAt } from "@/lib/brief-recurrence";
import { scanAndSpawnDue } from "@/lib/brief-spawner";

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
    const assignedTo = sp.get("assignedTo");
    const createdBy = sp.get("createdBy");
    const contentType = sp.get("contentType");
    const isGeneral = sp.get("general");
    const mine = sp.get("mine") === "true";
    const includeDeleted = sp.get("includeDeleted") === "true";
    // Templates filter: "only" / "exclude" / null (include both).
    const templates = sp.get("templates");

    await connectDB();

    // Lazy spawn: piggyback on briefs list reads so missed cron ticks still
    // catch up. Throttled internally to ~once/minute per server instance.
    void scanAndSpawnDue().catch(() => {});

    const filter: Record<string, unknown> = {};
    if (!includeDeleted) filter.isDeleted = { $ne: true };
    if (project) filter.project = project;
    if (platform) filter.platform = platform;
    if (status) filter.status = status;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (createdBy) filter.createdBy = createdBy;
    if (contentType) filter.contentType = contentType;
    if (isGeneral === "true") filter.isGeneralMarketing = true;
    if (mine) filter.assignedTo = auth.ctx.userId;
    if (templates === "only") filter.isTemplate = true;
    else if (templates === "exclude") filter.isTemplate = { $ne: true };
    const templateId = sp.get("template");
    if (templateId) filter.template = templateId;
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ title: re }, { description: re }, { goal: re }];
    }

    // Scope: anyone without briefs.read.any only sees briefs they created,
    // briefs assigned to them, or briefs whose project they are assigned to.
    if (!hasPermission(auth.ctx.role, "briefs.read.any")) {
      const assigned = userAssignedProjectIds(auth.ctx.user);
      const scope: Record<string, unknown>[] = [
        { createdBy: auth.ctx.userId },
        { assignedTo: auth.ctx.userId },
        { isGeneralMarketing: true },
      ];
      if (assigned.length) scope.push({ project: { $in: assigned } });
      if (filter.$or) {
        const text = filter.$or;
        delete filter.$or;
        filter.$and = [{ $or: text }, { $or: scope }];
      } else {
        filter.$or = scope;
      }
    }

    const [items, total] = await Promise.all([
      ContentBrief.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("project", "projectName slug logo isGeneralMarketing")
        .populate("createdBy", "firstName lastName email profileImage")
        .populate("assignedTo", "firstName lastName email profileImage")
        .lean(),
      ContentBrief.countDocuments(filter),
    ]);
    return ok({ items, total, page, limit });
  } catch (err) {
    return serverError(err);
  }
}

const RecurrenceBody = z.object({
  freq: z.enum(RECURRENCE_FREQ),
  interval: z.number().int().min(1).max(365).optional(),
  byweekday: z.array(z.enum(WEEKDAYS)).optional(),
  bymonthday: z.number().int().min(1).max(31).optional(),
  startsAt: z.string(),
  endsAt: z.string().optional().nullable(),
  timezone: z.string().optional(),
});

const CreateBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  project: z.string().optional(),
  isGeneralMarketing: z.boolean().optional(),
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
  assignedTo: z.string().optional(),
  status: z.enum(BRIEF_STATUS).optional(),
  // Recurrence: when present, the brief is created as a template that will
  // spawn instances on each occurrence.
  isTemplate: z.boolean().optional(),
  recurrence: RecurrenceBody.optional(),
  deadlineOffsetHours: z.number().min(0).max(24 * 365).optional(),
});

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("briefs.create");
    if (!auth.ok) return auth.response;
    const body = CreateBody.safeParse(await req.json().catch(() => null));
    if (!body.success) return badRequest("Invalid input", body.error.flatten());

    await connectDB();
    const wantsGeneral = !!body.data.isGeneralMarketing;
    if (!wantsGeneral && !body.data.project) {
      return badRequest("A project is required (or mark as General Marketing)");
    }
    if (wantsGeneral && !canCreateGeneralMarketing(auth.ctx.role)) {
      return forbidden("You are not allowed to create General Marketing briefs");
    }

    let projectId: string | undefined;
    if (!wantsGeneral && body.data.project) {
      const project = await Project.findById(body.data.project).select("_id isGeneralMarketing");
      if (!project) return badRequest("Project not found");
      if (!canAccessProject(auth.ctx.role, auth.ctx.user, String(project._id))) {
        return forbidden("You are not assigned to this project");
      }
      projectId = String(project._id);
    }

    let assignedTo: string | undefined;
    if (body.data.assignedTo) {
      const u = await User.findById(body.data.assignedTo).select("_id status");
      if (!u || u.status !== "active") return badRequest("Assignee not found or inactive");
      assignedTo = String(u._id);
    }

    // A brief is treated as a template when isTemplate is true AND a
    // recurrence rule was supplied. Templates never enter the regular
    // workflow; their status stays as "template".
    const isTemplate = !!body.data.isTemplate && !!body.data.recurrence;
    const recurrenceRule = isTemplate && body.data.recurrence
      ? {
          freq: body.data.recurrence.freq,
          interval: body.data.recurrence.interval ?? 1,
          byweekday: body.data.recurrence.byweekday ?? [],
          bymonthday: body.data.recurrence.bymonthday,
          startsAt: new Date(body.data.recurrence.startsAt),
          endsAt: body.data.recurrence.endsAt ? new Date(body.data.recurrence.endsAt) : undefined,
          timezone: body.data.recurrence.timezone || "UTC",
        }
      : undefined;
    const nextRunAt = recurrenceRule
      ? (computeNextRunAt({ ...recurrenceRule, endsAt: recurrenceRule.endsAt ?? null }, null) ?? undefined)
      : undefined;

    const initialStatus: BriefStatus = isTemplate
      ? "template"
      : body.data.status || (assignedTo ? "assigned" : "created");
    const now = new Date();

    const brief = await ContentBrief.create({
      ...body.data,
      project: projectId,
      isGeneralMarketing: wantsGeneral,
      assignedTo,
      assignedAt: assignedTo ? now : undefined,
      deadline: body.data.deadline ? new Date(body.data.deadline) : undefined,
      status: initialStatus,
      statusChangedAt: now,
      createdBy: auth.ctx.userId,
      isTemplate,
      recurrence: recurrenceRule,
      deadlineOffsetHours: isTemplate ? body.data.deadlineOffsetHours : undefined,
      nextRunAt,
      activityLog: [{ action: "created", by: auth.ctx.userId, toStatus: initialStatus }],
    });
    await logActivity({
      action: "brief.created",
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
      targetType: "ContentBrief",
      targetId: brief._id,
      project: brief.project ?? undefined,
      message: `Created brief "${brief.title}"`,
    });
    if (assignedTo) {
      await logActivity({
        action: "brief.assigned",
        actor: auth.ctx.userId,
        actorEmail: auth.ctx.email,
        targetType: "ContentBrief",
        targetId: brief._id,
        project: brief.project ?? undefined,
        message: `Assigned to ${assignedTo}`,
      });
    }
    return ok({ id: String(brief._id) }, 201);
  } catch (err) {
    return serverError(err);
  }
}
