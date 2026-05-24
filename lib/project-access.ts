import type { UserRole } from "./constants";
import type { UserDoc } from "@/models/User";

// Roles that bypass per-project assignment (can see/work on any project).
const GLOBAL_PROJECT_ROLES: ReadonlySet<UserRole> = new Set([
  "super_admin",
  "admin",
  "project_manager",
  "reviewer",
]);

export function hasGlobalProjectAccess(role: UserRole): boolean {
  return GLOBAL_PROJECT_ROLES.has(role);
}

// Only org-level roles may create / file content under "General Marketing".
export function canCreateGeneralMarketing(role: UserRole): boolean {
  return role === "super_admin" || role === "admin" || role === "project_manager";
}

export function userAssignedProjectIds(
  user: Pick<UserDoc, "assignedProjects">,
): string[] {
  return (user.assignedProjects || []).map((p) => String(p));
}

export function canAccessProject(
  role: UserRole,
  user: Pick<UserDoc, "assignedProjects">,
  projectId: string | null | undefined,
): boolean {
  if (!projectId) return false;
  if (hasGlobalProjectAccess(role)) return true;
  return userAssignedProjectIds(user).includes(String(projectId));
}

// Whether the given user may read the content document. Owners always can.
// Globally-scoped roles may read any. Otherwise: content must belong to one
// of the user's assigned projects, or be flagged as general marketing.
export function canReadContentForProject(
  role: UserRole,
  user: Pick<UserDoc, "assignedProjects"> & { _id: unknown },
  c: { createdBy: unknown; project?: unknown; isGeneralMarketing?: boolean },
): boolean {
  if (hasGlobalProjectAccess(role)) return true;
  if (String(c.createdBy) === String(user._id)) return true;
  if (c.isGeneralMarketing) return true;
  if (!c.project) return false;
  return userAssignedProjectIds(user).includes(String(c.project));
}
