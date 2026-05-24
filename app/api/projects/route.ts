import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireAuth, requirePermission } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { badRequest, ok, parsePagination, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { slugify } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp);
    const q = sp.get("q")?.trim();
    const status = sp.get("status");
    const includeGeneral = sp.get("includeGeneral") !== "false";

    await connectDB();
    const filter: Record<string, unknown> = {};
    if (q) filter.$text = { $search: q };
    if (status === "active") filter.isActive = true;
    if (status === "inactive") filter.isActive = false;

    // Non-admin users only see their assigned projects + general marketing.
    const role = auth.ctx.role;
    if (role !== "super_admin" && role !== "admin" && role !== "project_manager") {
      const assigned = auth.ctx.user.assignedProjects || [];
      const or: Record<string, unknown>[] = [{ _id: { $in: assigned } }];
      if (includeGeneral) or.push({ isGeneralMarketing: true });
      filter.$or = or;
    }

    const [items, total] = await Promise.all([
      Project.find(filter).sort({ isGeneralMarketing: -1, projectName: 1 }).skip(skip).limit(limit),
      Project.countDocuments(filter),
    ]);
    return ok({ items, total, page, limit });
  } catch (err) {
    return serverError(err);
  }
}

const CreateBody = z.object({
  projectName: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  logo: z.string().url().optional().or(z.literal("")),
  brandColors: z
    .object({
      primary: z.string().optional(),
      secondary: z.string().optional(),
      accent: z.string().optional(),
      neutral: z.string().optional(),
    })
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

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("projects.create");
    if (!auth.ok) return auth.response;
    const body = CreateBody.safeParse(await req.json().catch(() => null));
    if (!body.success) return badRequest("Invalid input", body.error.flatten());

    await connectDB();
    let slug = body.data.slug ? slugify(body.data.slug) : slugify(body.data.projectName);
    let n = 1;
    while (await Project.exists({ slug })) {
      slug = `${slugify(body.data.projectName)}-${++n}`;
    }
    const project = await Project.create({
      ...body.data,
      slug,
      createdBy: auth.ctx.userId,
    });
    await logActivity({
      action: "project.created",
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
      targetType: "Project",
      targetId: project._id,
      project: project._id,
      message: `Created project ${project.projectName}`,
    });
    return ok({ id: String(project._id), slug: project.slug }, 201);
  } catch (err) {
    return serverError(err);
  }
}
