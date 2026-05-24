import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  CONTENT_STATUS,
  CONTENT_TYPES,
  FUNNEL_STAGES,
  PLATFORMS,
  PRIORITIES,
} from "@/lib/constants";

const MediaRefSchema = new Schema(
  {
    mediaFile: { type: Schema.Types.ObjectId, ref: "MediaFile" },
    url: { type: String, default: "" },
    thumbnailUrl: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    altText: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const EditHistoryEntrySchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: "User" },
    changes: { type: Schema.Types.Mixed, default: {} },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const ActivityEntrySchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    fromStatus: { type: String, default: "" },
    toStatus: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const AnalyticsSchema = new Schema(
  {
    impressions: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 },
    engagementRate: { type: Number, default: 0 },
    lastSyncedAt: { type: Date },
  },
  { _id: false }
);

const ContentSchema = new Schema(
  {
    // Identifiers
    title: { type: String, required: true, trim: true },
    slug: { type: String, index: true, lowercase: true, trim: true },
    internalReferenceId: { type: String, index: true, default: "" },
    description: { type: String, default: "" },

    // Project relations
    project: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    isGeneralMarketing: { type: Boolean, default: false, index: true },

    // User relations
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },

    // Status & classification
    status: { type: String, enum: CONTENT_STATUS, default: "draft", index: true },
    contentType: { type: String, enum: CONTENT_TYPES, required: true, index: true },
    platform: { type: String, enum: PLATFORMS, required: true, index: true },
    priority: { type: String, enum: PRIORITIES, default: "normal" },
    funnelStage: { type: String, enum: FUNNEL_STAGES, index: true },

    // Content body
    caption: { type: String, default: "" },
    shortCaption: { type: String, default: "" },
    hashtags: { type: [String], default: [] },
    cta: { type: String, default: "" },
    targetUrl: { type: String, default: "" },
    language: { type: String, default: "" },
    targetCountry: { type: String, default: "" },
    targetAudience: { type: String, default: "" },
    campaignName: { type: String, default: "", index: true },
    campaignGoal: { type: String, default: "" },

    // Scheduling
    publishDate: { type: Date, index: true },
    publishTime: { type: String, default: "" }, // "HH:mm"
    timezone: { type: String, default: "UTC" },
    scheduledAt: { type: Date, index: true },

    // Media
    mediaFiles: { type: [MediaRefSchema], default: [] },
    thumbnail: { type: String, default: "" },
    altText: { type: String, default: "" },
    aspectRatio: { type: String, default: "" },
    duration: { type: Number },
    fileRequirements: { type: String, default: "" },

    // Social-specific fields
    storyText: { type: String, default: "" },
    reelScript: { type: String, default: "" },
    videoScript: { type: String, default: "" },
    firstComment: { type: String, default: "" },
    mentions: { type: [String], default: [] },
    locationTag: { type: String, default: "" },
    productTag: { type: String, default: "" },
    linkInBioReference: { type: String, default: "" },

    // Design / brand
    contentFormat: { type: String, default: "" },
    designNotes: { type: String, default: "" },
    brandGuidelinesNotes: { type: String, default: "" },
    complianceNotes: { type: String, default: "" },

    // Review
    reviewStatus: { type: String, default: "" },
    rejectionReason: { type: String, default: "" },
    reviewerComment: { type: String, default: "" },
    approvalDate: { type: Date },
    rejectionDate: { type: Date },

    // Publishing (external)
    publishedAt: { type: Date, index: true },
    deletedAt: { type: Date },
    failedAt: { type: Date },
    externalPlatformPostId: { type: String, default: "" },
    externalPublishStatus: { type: String, default: "" },
    externalPublishError: { type: String, default: "" },
    publishRetryCount: { type: Number, default: 0 },

    // Analytics
    analytics: { type: AnalyticsSchema, default: () => ({}) },

    // System
    statusChangedAt: { type: Date, default: Date.now },
    version: { type: Number, default: 1 },
    editHistory: { type: [EditHistoryEntrySchema], default: [] },
    activityLog: { type: [ActivityEntrySchema], default: [] },

    // Soft delete
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, collection: "quiz4win_marketing_content" }
);

ContentSchema.index({ status: 1, publishDate: 1 });
ContentSchema.index({ project: 1, status: 1 });
ContentSchema.index({ platform: 1, status: 1 });
ContentSchema.index({ createdBy: 1, status: 1 });
ContentSchema.index({ title: "text", caption: "text", campaignName: "text" });

export type ContentDoc = InferSchemaType<typeof ContentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Content: Model<ContentDoc> =
  (mongoose.models.Content as Model<ContentDoc>) ||
  mongoose.model<ContentDoc>("Content", ContentSchema);
