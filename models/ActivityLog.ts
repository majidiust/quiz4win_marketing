import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

const ActivityLogSchema = new Schema(
  {
    action: { type: String, enum: ACTIVITY_ACTIONS, required: true, index: true },
    actor: { type: Schema.Types.ObjectId, ref: "User", index: true },
    actorEmail: { type: String, default: "" },
    targetType: { type: String, default: "" }, // "User", "Project", "Content", ...
    targetId: { type: Schema.Types.ObjectId, index: true },
    project: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    message: { type: String, default: "" },
    meta: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true, collection: "quiz4win_marketing_activity_logs" }
);

ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ action: 1, createdAt: -1 });

export type ActivityLogDoc = InferSchemaType<typeof ActivityLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ActivityLog: Model<ActivityLogDoc> =
  (mongoose.models.ActivityLog as Model<ActivityLogDoc>) ||
  mongoose.model<ActivityLogDoc>("ActivityLog", ActivityLogSchema);
