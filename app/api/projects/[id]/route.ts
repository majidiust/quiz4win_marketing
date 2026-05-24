import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireAuth, requirePermission } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { badRequest, notFound, ok, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { id } = await ctx.params;
    await connectDB();
    const project = await Project.findById(id);
    if (!project) return notFound();
    return ok({ project });
  } catch (err) {
    return serverError(err);
  }
}

const UpdateBody = z.object({
  projectName: z.string().min(1).optional(),
  description: z.string().optional(),
  logo: z.string().optional(),
  brandColors: z.record(z.string(), z.string()).optional(),
  typography: z
    .object({
      headingFont: z.string().optional(),
      bodyFont: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  socialAccounts: z
    .array(
      z.object({
        platform: z.string(),
        handle: z.string().optional(),
        url: z.string().optional(),
        accountId: z.string().optional(),
      })
    )
    .optional(),
  defaultHashtags: z.array(z.string()).optional(),
  defaultCTA: z.string().optional(),
  targetLanguages: z.array(z.string()).optional(),
  targetCountries: z.array(z.string()).optional(),
  contentGuidelines: z.string().optional(),
  complianceNotes: z.string().optional(),
  isActive: z.boolean().optional(),
  isGeneralMarketing: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    const auth = await requirePermission("projects.update");
    if (!auth.ok) return auth.response;
    const { id } = await ctx.params;
    const body = UpdateBody.safeParse(await req.json().catch(() => null));
    if (!body.success) return badRequest("Invalid input", body.error.flatten());

    await connectDB();
    const project = await Project.findById(id);
    if (!project) return notFound();
    Object.assign(project, body.data);
    await project.save();
    await logActivity({
      action: "project.updated",
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
      targetType: "Project",
      targetId: project._id,
      project: project._id,
    });
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    const auth = await requirePermission("projects.delete");
    if (!auth.ok) return auth.response;
    const { id } = await ctx.params;
    await connectDB();
    const project = await Project.findById(id);
    if (!project) return notFound();
    project.isActive = false;
    await project.save();
    await logActivity({
      action: "project.deleted",
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
      targetType: "Project",
      targetId: project._id,
      project: project._id,
    });
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
