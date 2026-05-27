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
    const mineLegacy = sp.get("mine") === "true";
    const includeDeleted = sp.get("includeDeleted") === "true";
    // Templates filter: "only" / "exclude" / null (include both).
    const templates = sp.get("templates");
    // scope=mine restricts to briefs created by or assigned to the requester.
    // scope=all opens the view subject to permissions. The legacy
    // `mine=true` query is still treated as scope=mine. Default is "mine"
    // for everyone except super_admin, whose default is "all".
    const scopeParam = sp.get("scope");
    const scope = mineLegacy
      ? "mine"
      : scopeParam === "all" ? "all"
      : scopeParam === "mine" ? "mine"
      : auth.ctx.role === "super_admin" ? "all" : "mine";

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
    if (templates === "only") filter.isTemplate = true;
    else if (templates === "exclude") filter.isTemplate = { $ne: true };
    const templateId = sp.get("template");
    if (templateId) filter.template = templateId;
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ title: re }, { description: re }, { goal: re }];
    }

    // Scoping:
    // - scope=mine (default): personal queue, regardless of role. Anything
    //   the requester created or is assigned to.
    // - scope=all + briefs.read.any: see everything subject to filters.
    // - scope=all without briefs.read.any: project-scoped fallback
    //   (own + assigned + general marketing + assigned projects).
    const canSeeAny = hasPermission(auth.ctx.role, "briefs.read.any");
    const applyScope = (clauses: Record<string, unknown>[]) => {
      if (filter.$or) {
        const text = filter.$or;
        delete filter.$or;
        filter.$and = [{ $or: text }, { $or: clauses }];
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
      const fallback: Record<string, unknown>[] = [
        { createdBy: auth.ctx.userId },
        { assignedTo: auth.ctx.userId },
        { isGeneralMarketing: true },
      ];
      if (assigned.length) fallback.push({ project: { $in: assigned } });
      applyScope(fallback);
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

// The brief editor sends `null` (not `undefined`) for any field the user
// left blank, so optional fields that the form might clear are declared
// `.nullish()` to accept both. Empty strings are normalised to undefined
// for the enum fields so Zod does not reject them.
const emptyToUndef = <T>(v: T) => (v === "" ? undefined : v);

const CreateBody = z.object({
  title: z.string().min(1),
  description: z.string().nullish(),
  project: z.string().nullish(),
  isGeneralMarketing: z.boolean().optional(),
  goal: z.string().nullish(),
  platform: z.preprocess(emptyToUndef, z.enum(PLATFORMS).nullish()),
  contentType: z.preprocess(emptyToUndef, z.enum(CONTENT_TYPES).nullish()),
  funnelStage: z.preprocess(emptyToUndef, z.enum(FUNNEL_STAGES).nullish()),
  language: z.string().nullish(),
  targetCountry: z.string().nullish(),
  targetAudience: z.string().nullish(),
  suggestedHashtags: z.array(z.string()).nullish(),
  suggestedMentions: z.array(z.string()).nullish(),
  suggestedCTA: z.string().nullish(),
  deadline: z.string().nullish(),
  priority: z.enum(PRIORITIES).optional(),
  references: z
    .array(z.object({ label: z.string().optional(), url: z.string().url() }))
    .nullish(),
  referenceMedia: z.array(z.string()).nullish(),
  assignedTo: z.string().nullish(),
  status: z.enum(BRIEF_STATUS).optional(),
  // Recurrence: when present, the brief is created as a template that will
  // spawn instances on each occurrence.
  isTemplate: z.boolean().optional(),
  recurrence: RecurrenceBody.nullish(),
  deadlineOffsetHours: z.number().min(0).max(24 * 365).nullish(),
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

    // Strip nulls before spreading so Mongoose falls back to schema defaults
    // (the editor sends null for any blank field, which would otherwise reach
    // enum/array paths as a literal null).
    const cleaned = Object.fromEntries(
      Object.entries(body.data).filter(([, v]) => v !== null)
    );

    const brief = await ContentBrief.create({
      ...cleaned,
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
      deadlineOffsetHours: isTemplate && body.data.deadlineOffsetHours != null
        ? body.data.deadlineOffsetHours
        : undefined,
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
