import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { ActivityLog } from "@/models/ActivityLog";
import { ok, parsePagination, serverError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission("activity.read");
    if (!auth.ok) return auth.response;
    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp);

    const filter: Record<string, unknown> = {};
    const action = sp.get("action");
    const actor = sp.get("actor");
    const project = sp.get("project");
    const dateFrom = sp.get("dateFrom");
    const dateTo = sp.get("dateTo");
    const q = sp.get("q")?.trim();
    if (action) filter.action = action;
    if (actor) filter.actor = actor;
    if (project) filter.project = project;
    if (dateFrom || dateTo) {
      filter.createdAt = {} as Record<string, Date>;
      if (dateFrom) (filter.createdAt as Record<string, Date>).$gte = new Date(dateFrom);
      if (dateTo) (filter.createdAt as Record<string, Date>).$lte = new Date(dateTo);
    }
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ message: re }, { actorEmail: re }];
    }

    await connectDB();
    const [items, total] = await Promise.all([
      ActivityLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("actor", "firstName lastName email profileImage")
        .populate("project", "projectName slug"),
      ActivityLog.countDocuments(filter),
    ]);
    return ok({ items, total, page, limit });
  } catch (err) {
    return serverError(err);
  }
}
