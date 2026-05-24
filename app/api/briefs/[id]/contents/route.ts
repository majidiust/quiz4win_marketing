import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { ContentBrief } from "@/models/ContentBrief";
import { Content } from "@/models/Content";
import { forbidden, notFound, ok, serverError } from "@/lib/api";
import { canReadBrief } from "@/lib/brief-policy";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/briefs/[id]/contents">) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { id } = await ctx.params;
    await connectDB();
    const b = await ContentBrief.findById(id).select(
      "_id status createdBy assignedTo project isGeneralMarketing isDeleted"
    );
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
    const items = await Content.find({ brief: b._id, isDeleted: { $ne: true } })
      .sort({ updatedAt: -1 })
      .populate("createdBy", "firstName lastName email profileImage")
      .populate("assignedTo", "firstName lastName email profileImage")
      .lean();
    return ok({ items, total: items.length });
  } catch (err) {
    return serverError(err);
  }
}
