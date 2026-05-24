import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// Flexible key/value store for system-wide settings.
const SettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "quiz4win_marketing_settings" }
);

export type SettingDoc = InferSchemaType<typeof SettingSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Setting: Model<SettingDoc> =
  (mongoose.models.Setting as Model<SettingDoc>) ||
  mongoose.model<SettingDoc>("Setting", SettingSchema);
