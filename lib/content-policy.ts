import type { UserRole } from "./constants";
import { EDITABLE_STATUSES, type ContentStatus } from "./constants";
import { hasPermission } from "./rbac";

interface ContentRefs {
  status: ContentStatus;
  createdBy: string;
  isDeleted?: boolean;
}

export function canEditContent(role: UserRole, userId: string, c: ContentRefs): boolean {
  // super_admin is unrestricted and can edit any content in any state,
  // including soft-deleted records (needed to fix mistakes / restore).
  if (role === "super_admin") return true;
  if (c.isDeleted) return false;
  // Approved/scheduled/published/archived/failed are non-editable for normal users.
  const isEditableStatus = EDITABLE_STATUSES.includes(c.status);
  if (hasPermission(role, "content.update.any")) {
    // Admins still cannot edit published/deleted content directly.
    if (c.status === "published" || c.status === "deleted") return false;
    return true;
  }
  if (!isEditableStatus) return false;
  // Owners only
  return c.createdBy === userId && hasPermission(role, "content.update.own");
}

export function canDeleteContent(role: UserRole, userId: string, c: ContentRefs): boolean {
  if (c.status === "published" && !hasPermission(role, "content.delete.any")) return false;
  if (hasPermission(role, "content.delete.any")) return true;
  return c.createdBy === userId && hasPermission(role, "content.delete.own");
}

const ALLOWED_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  generated: ["draft", "deleted", "archived"],
  draft: ["under_review", "deleted", "archived"],
  under_review: ["approved", "rejected", "draft"],
  approved: ["scheduled", "draft", "archived"],
  rejected: ["draft", "deleted", "archived"],
  scheduled: ["published", "approved", "failed", "draft"],
  published: ["archived"],
  failed: ["scheduled", "draft", "archived"],
  archived: ["draft"],
  deleted: ["draft"], // restore
};

export function canTransition(from: ContentStatus, to: ContentStatus, role?: UserRole): boolean {
  if (from === to) return true;
  // super_admin bypasses the workflow graph entirely and may move content
  // between any two states.
  if (role === "super_admin") return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function requiresReason(to: ContentStatus): boolean {
  return to === "rejected";
}
