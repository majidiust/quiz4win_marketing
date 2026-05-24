import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  BRIEF_STATUS,
  CONTENT_TYPES,
  FUNNEL_STAGES,
  PLATFORMS,
  PRIORITIES,
  RECURRENCE_FREQ,
  WEEKDAYS,
} from "@/lib/constants";

// Recurrence rule for a recurring brief template. Mirrors a tiny subset of
// RRULE (just freq / interval / byweekday / bymonthday + bounds). Anything
// more elaborate would warrant a dedicated package.
const RecurrenceSchema = new Schema(
  {
    freq: { type: String, enum: RECURRENCE_FREQ, required: true },
    interval: { type: Number, default: 1, min: 1 },
    byweekday: { type: [String], enum: WEEKDAYS, default: [] },
    bymonthday: { type: Number, min: 1, max: 31 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date },
    // IANA tz, e.g. "Asia/Tehran". Determines what "9am daily" means.
    timezone: { type: String, default: "UTC" },
  },
  { _id: false }
);

// Embedded comment thread used by the brief discussion UI. Same shape is
// reused on Content; both surfaces share the comment renderer.
const CommentSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true },
  },
  { _id: true }
);

// Lightweight status-change log so the brief detail page can render a
// timeline without joining ActivityLog.
const BriefActivitySchema = new Schema(
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

// Reference link entered by the PM (inspiration / spec / past campaign).
const ReferenceLinkSchema = new Schema(
  {
    label: { type: String, default: "" },
    url: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const ContentBriefSchema = new Schema(
  {
    // Identifiers
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    // Project relations — mirrors Content for scoping consistency.
    project: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    isGeneralMarketing: { type: Boolean, default: false, index: true },

    // Brief intent. These describe what kind of Content should be produced.
    goal: { type: String, default: "" },
    platform: { type: String, enum: PLATFORMS, index: true },
    contentType: { type: String, enum: CONTENT_TYPES, index: true },
    funnelStage: { type: String, enum: FUNNEL_STAGES, index: true },
    // Targeting locale — ISO 639. The text index below uses language_override
    // so this value is never interpreted as a stemmer hint (error 17262).
    language: { type: String, default: "" },
    targetCountry: { type: String, default: "" },
    targetAudience: { type: String, default: "" },
    // Suggested handles, mentions, hashtags the PM wants the producer to use.
    suggestedHashtags: { type: [String], default: [] },
    suggestedMentions: { type: [String], default: [] },
    suggestedCTA: { type: String, default: "" },

    // Scheduling intent.
    deadline: { type: Date, index: true },
    priority: { type: String, enum: PRIORITIES, default: "normal" },

    // Reference material the PM attaches.
    references: { type: [ReferenceLinkSchema], default: [] },
    referenceMedia: [{ type: Schema.Types.ObjectId, ref: "MediaFile", default: [] }],

    // Workflow.
    status: { type: String, enum: BRIEF_STATUS, default: "created", index: true },
    statusChangedAt: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", index: true },
    assignedAt: { type: Date },
    completedAt: { type: Date },

    // Discussion + audit trail.
    comments: { type: [CommentSchema], default: [] },
    activityLog: { type: [BriefActivitySchema], default: [] },

    // Soft delete (mirrors Content).
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },

    // ----- Recurrence -----
    // Templates spawn fresh briefs at each occurrence. They never transition
    // through the regular workflow themselves.
    isTemplate: { type: Boolean, default: false, index: true },
    // Back-reference from a spawned instance to the template it was cloned
    // from. Null for non-recurring briefs and for the templates themselves.
    template: { type: Schema.Types.ObjectId, ref: "ContentBrief", index: true },
    recurrence: { type: RecurrenceSchema, default: undefined },
    // Hours added to spawn time to compute each instance's deadline. Set on
    // the template; copied to each child as a concrete `deadline`.
    deadlineOffsetHours: { type: Number, min: 0 },
    // Cached scheduling cursor. The scanner reads templates with
    // `nextRunAt <= now` and spawns one instance per occurrence.
    nextRunAt: { type: Date, index: true },
    lastRunAt: { type: Date },
    occurrenceCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "quiz4win_marketing_content_briefs" }
);

ContentBriefSchema.index({ project: 1, status: 1 });
ContentBriefSchema.index({ assignedTo: 1, status: 1 });
ContentBriefSchema.index({ createdBy: 1, status: 1 });
ContentBriefSchema.index({ status: 1, deadline: 1 });
ContentBriefSchema.index({ isTemplate: 1, nextRunAt: 1 });

// Text search. language_override points at a non-existent field so our ISO
// 639 `language` value is never interpreted as a per-document stemmer hint.
// See AGENTS.md and scripts/fix-text-indexes.mjs.
ContentBriefSchema.index(
  { title: "text", description: "text", goal: "text" },
  { default_language: "none", language_override: "_textLanguage", name: "content_brief_text_index" }
);

export type ContentBriefDoc = InferSchemaType<typeof ContentBriefSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ContentBrief: Model<ContentBriefDoc> =
  (mongoose.models.ContentBrief as Model<ContentBriefDoc>) ||
  mongoose.model<ContentBriefDoc>("ContentBrief", ContentBriefSchema);
