import { requireAuth } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { Content } from "@/models/Content";
import { Project } from "@/models/Project";
import { User } from "@/models/User";
import { ActivityLog } from "@/models/ActivityLog";
import { ok, serverError } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    await connectDB();

    const baseFilter: Record<string, unknown> = { isDeleted: { $ne: true } };
    if (!hasPermission(auth.ctx.role, "content.read.any")) {
      const assignedProjects = auth.ctx.user.assignedProjects || [];
      baseFilter.$or = [
        { createdBy: auth.ctx.userId },
        { project: { $in: assignedProjects } },
        { isGeneralMarketing: true },
      ];
    }

    const [
      totalUsers,
      totalProjects,
      totalContent,
      byStatus,
      byPlatform,
      byProject,
      upcoming,
      recentActivity,
      publishingTrendsRaw,
    ] = await Promise.all([
      hasPermission(auth.ctx.role, "users.read") ? User.countDocuments({ status: "active" }) : 0,
      hasPermission(auth.ctx.role, "projects.read") ? Project.countDocuments({ isActive: true }) : 0,
      Content.countDocuments(baseFilter),
      Content.aggregate([{ $match: baseFilter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Content.aggregate([{ $match: baseFilter }, { $group: { _id: "$platform", count: { $sum: 1 } } }]),
      Content.aggregate([
        { $match: baseFilter },
        { $group: { _id: "$project", count: { $sum: 1 } } },
        { $lookup: { from: "projects", localField: "_id", foreignField: "_id", as: "project" } },
        { $unwind: { path: "$project", preserveNullAndEmptyArrays: true } },
        { $project: { count: 1, projectName: "$project.projectName", isGeneralMarketing: "$project.isGeneralMarketing" } },
        { $sort: { count: -1 } },
        { $limit: 12 },
      ]),
      Content.find({ ...baseFilter, status: { $in: ["scheduled", "approved"] }, publishDate: { $gte: new Date() } })
        .sort({ publishDate: 1 })
        .limit(10)
        .populate("project", "projectName slug isGeneralMarketing")
        .populate("createdBy", "firstName lastName"),
      hasPermission(auth.ctx.role, "activity.read")
        ? ActivityLog.find().sort({ createdAt: -1 }).limit(15).populate("actor", "firstName lastName email profileImage")
        : ActivityLog.find({ actor: auth.ctx.userId }).sort({ createdAt: -1 }).limit(15),
      Content.aggregate([
        {
          $match: {
            ...baseFilter,
            publishedAt: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$publishedAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const statusMap: Record<string, number> = {};
    for (const row of byStatus) statusMap[row._id] = row.count;

    return ok({
      totals: {
        users: totalUsers,
        projects: totalProjects,
        content: totalContent,
        draft: statusMap.draft || 0,
        under_review: statusMap.under_review || 0,
        scheduled: statusMap.scheduled || 0,
        published: statusMap.published || 0,
        failed: statusMap.failed || 0,
        approved: statusMap.approved || 0,
        rejected: statusMap.rejected || 0,
      },
      byStatus,
      byPlatform,
      byProject,
      upcoming,
      recentActivity,
      publishingTrends: publishingTrendsRaw,
    });
  } catch (err) {
    return serverError(err);
  }
}
