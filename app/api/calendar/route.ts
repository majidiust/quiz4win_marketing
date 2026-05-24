import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { Content } from "@/models/Content";
import { ContentBrief } from "@/models/ContentBrief";
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
    // Calendar surfaces both content (by publish date) and briefs (by
    // deadline). Either can be hidden via ?kinds=content or ?kinds=brief.
    const kinds = (sp.get("kinds") || "content,brief").split(",");
    const wantContent = kinds.includes("content");
    const wantBriefs = kinds.includes("brief");

    await connectDB();

    // Default to current month range if not provided.
    const start = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = to ? new Date(to) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

    // ---- Content side ----
    const contentItems = wantContent
      ? await fetchContent({ start, end, project, platform, status, user, auth })
      : [];

    // ---- Brief side ----
    // Status enum differs between Content and Brief, so a status filter that
    // came in for content is intentionally ignored when fetching briefs.
    const briefItems = wantBriefs
      ? await fetchBriefs({ start, end, project, platform, user, auth })
      : [];

    // Merge into a single list. The frontend discriminates on `kind`.
    const items = [
      ...contentItems.map((c) => ({ ...c, kind: "content" as const })),
      ...briefItems.map((b) => ({ ...b, kind: "brief" as const })),
    ];

    return ok({ items, range: { from: start, to: end } });
  } catch (err) {
    return serverError(err);
  }
}

type AuthArg = Awaited<ReturnType<typeof requireAuth>> & { ok: true };

async function fetchContent(args: {
  start: Date; end: Date;
  project: string | null; platform: string | null; status: string | null; user: string | null;
  auth: AuthArg;
}) {
  const { start, end, project, platform, status, user, auth } = args;
  const filter: Record<string, unknown> = { isDeleted: { $ne: true } };
  if (project) filter.project = project;
  if (platform) filter.platform = platform;
  if (status) filter.status = status;
  if (user) filter.createdBy = user;

  const dateRange = [
    { publishDate: { $gte: start, $lte: end } },
    { scheduledAt: { $gte: start, $lte: end } },
    { publishedAt: { $gte: start, $lte: end } },
  ];

  // Mirror the same scoping logic as GET /api/content:
  //   super_admin and anyone with content.read.any → unrestricted.
  //   Everyone else → only items they created or are assigned to.
  if (hasPermission(auth.ctx.role, "content.read.any")) {
    filter.$or = dateRange;
  } else {
    filter.$and = [
      { $or: dateRange },
      { $or: [{ createdBy: auth.ctx.userId }, { assignedTo: auth.ctx.userId }] },
    ];
  }

  return Content.find(filter)
    .select(
      "title slug status platform contentType project isGeneralMarketing publishDate publishTime scheduledAt publishedAt thumbnail mediaFiles createdBy assignedTo campaignName priority"
    )
    .populate("project", "projectName slug isGeneralMarketing brandColors")
    .populate("createdBy", "firstName lastName email profileImage")
    .limit(500)
    .lean();
}

async function fetchBriefs(args: {
  start: Date; end: Date;
  project: string | null; platform: string | null; user: string | null;
  auth: AuthArg;
}) {
  const { start, end, project, platform, user, auth } = args;
  // Templates spawn instances and never themselves need a slot on the
  // calendar — only the spawned children carry a real deadline.
  const filter: Record<string, unknown> = {
    isDeleted: { $ne: true },
    isTemplate: { $ne: true },
    deadline: { $gte: start, $lte: end },
  };
  if (project) filter.project = project;
  if (platform) filter.platform = platform;
  if (user) filter.createdBy = user;

  // Mirror the same scoping logic as GET /api/briefs:
  //   super_admin and anyone with briefs.read.any → unrestricted.
  //   Everyone else → only briefs they created or are assigned to.
  if (!hasPermission(auth.ctx.role, "briefs.read.any")) {
    filter.$or = [
      { createdBy: auth.ctx.userId },
      { assignedTo: auth.ctx.userId },
    ];
  }

  return ContentBrief.find(filter)
    .select(
      "title status platform contentType project isGeneralMarketing deadline assignedTo createdBy priority"
    )
    .populate("project", "projectName slug isGeneralMarketing brandColors")
    .populate("createdBy", "firstName lastName email profileImage")
    .populate("assignedTo", "firstName lastName email profileImage")
    .limit(500)
    .lean();
}
