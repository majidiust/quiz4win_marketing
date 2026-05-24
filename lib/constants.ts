// Shared, type-safe domain constants used by both client and server.

export const USER_ROLES = [
  "super_admin",
  "admin",
  "project_manager",
  "reviewer",
  "marketing_user",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  project_manager: "Project Manager",
  reviewer: "Reviewer",
  marketing_user: "Digital Marketing User",
};

export const USER_STATUS = ["active", "disabled", "pending"] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export const CONTENT_STATUS = [
  "generated",
  "draft",
  "under_review",
  "approved",
  "rejected",
  "scheduled",
  "published",
  "deleted",
  "failed",
  "archived",
] as const;
export type ContentStatus = (typeof CONTENT_STATUS)[number];

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  generated: "Generated",
  draft: "Draft",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  scheduled: "Scheduled",
  published: "Published",
  deleted: "Deleted",
  failed: "Failed",
  archived: "Archived",
};

export const EDITABLE_STATUSES: ContentStatus[] = [
  "generated",
  "draft",
  "rejected",
  "under_review",
];

export const CONTENT_TYPES = [
  "instagram_post",
  "instagram_story",
  "instagram_reel",
  "instagram_carousel",
  "tiktok_video",
  "facebook_post",
  "facebook_story",
  "youtube_shorts",
  "linkedin_post",
  "twitter_post",
  "blog_post",
  "banner",
  "campaign_asset",
  "push_notification",
  "email_newsletter",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  instagram_post: "Instagram Post",
  instagram_story: "Instagram Story",
  instagram_reel: "Instagram Reel",
  instagram_carousel: "Instagram Carousel",
  tiktok_video: "TikTok Video",
  facebook_post: "Facebook Post",
  facebook_story: "Facebook Story",
  youtube_shorts: "YouTube Shorts",
  linkedin_post: "LinkedIn Post",
  twitter_post: "X / Twitter Post",
  blog_post: "Blog Post",
  banner: "Banner",
  campaign_asset: "Campaign Asset",
  push_notification: "Push Notification",
  email_newsletter: "Email Newsletter",
};

export const PLATFORMS = [
  "instagram",
  "tiktok",
  "facebook",
  "youtube",
  "linkedin",
  "twitter",
  "website",
  "email",
  "push",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  twitter: "X / Twitter",
  website: "Website",
  email: "Email",
  push: "Push Notification",
};

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ACTIVITY_ACTIONS = [
  "user.login",
  "user.login_failed",
  "user.logout",
  "user.created",
  "user.updated",
  "user.disabled",
  "user.enabled",
  "user.password_reset",
  "user.mfa_enabled",
  "user.mfa_disabled",
  "project.created",
  "project.updated",
  "project.deleted",
  "content.created",
  "content.updated",
  "content.submitted",
  "content.approved",
  "content.rejected",
  "content.scheduled",
  "content.published",
  "content.publish_failed",
  "content.deleted",
  "content.restored",
  "content.archived",
  "media.uploaded",
  "media.deleted",
  "settings.updated",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];
