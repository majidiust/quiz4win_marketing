import type { UserRole } from "./constants";

// Permission keys are stable strings describing capabilities.
export type Permission =
  | "users.read"
  | "users.create"
  | "users.update"
  | "users.disable"
  | "projects.read"
  | "projects.create"
  | "projects.update"
  | "projects.delete"
  | "briefs.read.any"
  | "briefs.read.own"
  | "briefs.create"
  | "briefs.update.own"
  | "briefs.update.any"
  | "briefs.assign"
  | "briefs.delete.any"
  | "briefs.archive"
  | "briefs.comment"
  | "content.read.any"
  | "content.read.own"
  | "content.create"
  | "content.update.own"
  | "content.update.any"
  | "content.submit"
  | "content.review"
  | "content.approve"
  | "content.reject"
  | "content.schedule"
  | "content.publish"
  | "content.delete.own"
  | "content.delete.any"
  | "content.archive"
  | "content.restore"
  | "content.comment"
  | "calendar.read"
  | "activity.read"
  | "settings.read"
  | "settings.update";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    "users.read","users.create","users.update","users.disable",
    "projects.read","projects.create","projects.update","projects.delete",
    "briefs.read.any","briefs.read.own","briefs.create","briefs.update.own","briefs.update.any",
    "briefs.assign","briefs.delete.any","briefs.archive","briefs.comment",
    "content.read.any","content.read.own","content.create","content.update.own","content.update.any",
    "content.submit","content.review","content.approve","content.reject","content.schedule","content.publish",
    "content.delete.own","content.delete.any","content.archive","content.restore","content.comment",
    "calendar.read","activity.read","settings.read","settings.update",
  ],
  admin: [
    "users.read","users.create","users.update","users.disable",
    // Project create/update/delete intentionally limited to super_admin so
    // brand/workspace configuration can only be changed by a single owner.
    "projects.read",
    "briefs.read.any","briefs.read.own","briefs.create","briefs.update.own","briefs.update.any",
    "briefs.assign","briefs.delete.any","briefs.archive","briefs.comment",
    "content.read.any","content.read.own","content.create","content.update.own","content.update.any",
    "content.submit","content.review","content.approve","content.reject","content.schedule","content.publish",
    "content.delete.own","content.delete.any","content.archive","content.restore","content.comment",
    "calendar.read","activity.read","settings.read","settings.update",
  ],
  project_manager: [
    "users.read",
    "projects.read",
    "briefs.read.any","briefs.read.own","briefs.create","briefs.update.own","briefs.update.any",
    "briefs.assign","briefs.archive","briefs.comment",
    "content.read.any","content.read.own","content.create","content.update.own","content.update.any",
    "content.submit","content.review","content.approve","content.reject","content.schedule",
    "content.delete.own","content.archive","content.comment",
    "calendar.read","activity.read",
  ],
  reviewer: [
    "projects.read",
    "briefs.read.any","briefs.update.own","briefs.comment",
    "content.read.any","content.read.own","content.review","content.approve","content.reject","content.comment",
    "calendar.read",
  ],
  content_producer: [
    "projects.read",
    "briefs.read.own","briefs.create","briefs.update.own","briefs.comment",
    "content.read.own","content.create","content.update.own",
    "content.submit","content.delete.own","content.comment",
    "calendar.read",
  ],
  publisher: [
    "projects.read",
    "briefs.read.any","briefs.update.own","briefs.comment",
    "content.read.any","content.read.own","content.schedule","content.publish","content.comment",
    "calendar.read",
  ],
  marketing_user: [
    "projects.read",
    "briefs.read.own","briefs.create","briefs.update.own","briefs.comment",
    "content.read.own","content.create","content.update.own",
    "content.submit","content.delete.own","content.comment",
    "calendar.read",
  ],
};

// super_admin is treated as a wildcard: any present or future Permission is
// granted automatically, regardless of whether it appears in ROLE_PERMISSIONS.
// This keeps the role genuinely unrestricted without having to remember to
// extend the matrix every time a new permission is added.
export function rolePermissions(role: UserRole): Permission[] {
  if (role === "super_admin") return ROLE_PERMISSIONS.super_admin.slice();
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(role: UserRole | undefined, perm: Permission): boolean {
  if (!role) return false;
  if (role === "super_admin") return true;
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export function hasAnyPermission(role: UserRole | undefined, perms: Permission[]): boolean {
  if (!role) return false;
  if (role === "super_admin") return true;
  return perms.some((p) => ROLE_PERMISSIONS[role]?.includes(p));
}
