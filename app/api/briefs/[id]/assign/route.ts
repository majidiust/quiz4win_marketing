import { z } from "zod";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { ContentBrief } from "@/models/ContentBrief";
import { User } from "@/models/User";
import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { canReadBrief } from "@/lib/brief-policy";

const Body = z.object({ userId: z.string().nullable() });

export async function POST(req: NextRequest, ctx: RouteContext<"/api/briefs/[id]/assign">) {
  try {
    const auth = await requirePermission("briefs.assign");
    if (!auth.ok) return auth.response;
    const { id } = await ctx.params;
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return badRequest("Invalid input");

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

    const now = new Date();
    if (body.data.userId === null) {
      // Unassign.
      b.assignedTo = undefined;
      b.assignedAt = undefined;
      if (b.status === "assigned") {
        b.status = "created";
        b.statusChangedAt = now;
      }
    } else {
      const u = await User.findById(body.data.userId).select("_id status");
      if (!u || u.status !== "active") return badRequest("Assignee not found or inactive");
      b.assignedTo = u._id;
      b.assignedAt = now;
      // Bump to `assigned` if the brief is still freshly created.
      if (b.status === "created") {
        b.status = "assigned";
        b.statusChangedAt = now;
      }
    }
    b.activityLog = b.activityLog || [];
    b.activityLog.push({
      at: now,
      by: auth.ctx.user._id,
      action: body.data.userId === null ? "unassigned" : "assigned",
      toStatus: b.status,
      note: body.data.userId === null ? "" : String(body.data.userId),
    });
    await b.save();

    await logActivity({
      action: "brief.assigned",
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
      targetType: "ContentBrief",
      targetId: b._id,
      project: b.project ?? undefined,
      message: body.data.userId === null ? "Unassigned" : `Assigned to ${body.data.userId}`,
    });
    return ok({ success: true, status: b.status });
  } catch (err) {
    return serverError(err);
  }
}
