import type { UserRole } from "./constants";
import type { BriefStatus } from "./constants";
import { hasPermission } from "./rbac";
import type { UserDoc } from "@/models/User";
import { hasGlobalProjectAccess, userAssignedProjectIds } from "./project-access";

interface BriefRefs {
  status: BriefStatus;
  createdBy: unknown;
  assignedTo?: unknown;
  project?: unknown;
  isGeneralMarketing?: boolean;
  isDeleted?: boolean;
}

// Read access mirrors Content: global roles see everything; producers see
// briefs assigned to them or in their assigned projects (and general
// marketing). Soft-deleted briefs are hidden unless callers ask explicitly.
export function canReadBrief(
  role: UserRole,
  user: Pick<UserDoc, "assignedProjects"> & { _id: unknown },
  b: BriefRefs
): boolean {
  if (b.isDeleted) return false;
  if (hasPermission(role, "briefs.read.any") || hasGlobalProjectAccess(role)) return true;
  const uid = String(user._id);
  if (String(b.createdBy) === uid) return true;
  if (b.assignedTo && String(b.assignedTo) === uid) return true;
  if (!hasPermission(role, "briefs.read.own")) return false;
  if (b.isGeneralMarketing) return true;
  if (!b.project) return false;
  return userAssignedProjectIds(user).includes(String(b.project));
}

export function canEditBrief(role: UserRole, userId: string, b: BriefRefs): boolean {
  if (b.isDeleted) return false;
  if (b.status === "completed" || b.status === "archived") {
    return hasPermission(role, "briefs.update.any");
  }
  if (hasPermission(role, "briefs.update.any")) return true;
  return String(b.createdBy) === userId && hasPermission(role, "briefs.update.own");
}

export function canDeleteBrief(role: UserRole, _userId: string, _b: BriefRefs): boolean {
  return hasPermission(role, "briefs.delete.any");
}

export function canAssignBrief(role: UserRole): boolean {
  return hasPermission(role, "briefs.assign");
}

const ALLOWED_BRIEF_TRANSITIONS: Record<BriefStatus, BriefStatus[]> = {
  created: ["assigned", "archived"],
  assigned: ["in_progress", "created", "archived"],
  in_progress: ["completed", "assigned", "archived"],
  completed: ["archived", "in_progress"],
  archived: ["created"],
  // Templates don't participate in the regular workflow; the only allowed
  // transition is archiving (which also stops further spawns).
  template: ["archived"],
};

export function canTransitionBrief(from: BriefStatus, to: BriefStatus): boolean {
  if (from === to) return true;
  return ALLOWED_BRIEF_TRANSITIONS[from]?.includes(to) ?? false;
}

// Permission gate per destination status. Matches the content transition
// pattern in app/api/content/[id]/transition/route.ts.
export function canPerformBriefTransition(role: UserRole, to: BriefStatus): boolean {
  switch (to) {
    case "assigned":
      return hasPermission(role, "briefs.assign");
    case "in_progress":
      // Set automatically by content creation, or manually by PM.
      return hasPermission(role, "briefs.update.any") || hasPermission(role, "briefs.assign");
    case "completed":
      return hasPermission(role, "briefs.update.any");
    case "archived":
      return hasPermission(role, "briefs.archive");
    case "created":
      return hasPermission(role, "briefs.update.any");
    default:
      return false;
  }
}
