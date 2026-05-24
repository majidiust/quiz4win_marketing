import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { Content } from "@/models/Content";
import { ok, serverError } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const sp = req.nextUrl.searchParams;

    const from = sp.get("from");
    const to = sp.get("to");
    const project = sp.get("project");
    const platform = sp.get("platform");
    const status = sp.get("status");
    const user = sp.get("user");

    await connectDB();
    const filter: Record<string, unknown> = { isDeleted: { $ne: true } };
    if (project) filter.project = project;
    if (platform) filter.platform = platform;
    if (status) filter.status = status;
    if (user) filter.createdBy = user;

    // Default to current month range if not provided.
    const start = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = to ? new Date(to) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

    filter.$or = [
      { publishDate: { $gte: start, $lte: end } },
      { scheduledAt: { $gte: start, $lte: end } },
      { publishedAt: { $gte: start, $lte: end } },
    ];

    if (!hasPermission(auth.ctx.role, "content.read.any")) {
      const assignedProjects = auth.ctx.user.assignedProjects || [];
      filter.$and = [
        { $or: filter.$or as unknown[] },
        {
          $or: [
            { createdBy: auth.ctx.userId },
            { project: { $in: assignedProjects } },
            { isGeneralMarketing: true },
          ],
        },
      ];
      delete filter.$or;
    }

    const items = await Content.find(filter)
      .select(
        "title slug status platform contentType project isGeneralMarketing publishDate publishTime scheduledAt publishedAt thumbnail mediaFiles createdBy campaignName priority"
      )
      .populate("project", "projectName slug isGeneralMarketing brandColors")
      .populate("createdBy", "firstName lastName email profileImage")
      .limit(500);

    return ok({ items, range: { from: start, to: end } });
  } catch (err) {
    return serverError(err);
  }
}
