import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const MediaFileSchema = new Schema(
  {
    originalFilename: { type: String, required: true },
    storageKey: { type: String, required: true, unique: true, index: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    thumbnailUrl: { type: String, default: "" },
    width: { type: Number },
    height: { type: Number },
    duration: { type: Number }, // seconds for video/audio
    altText: { type: String, default: "" },

    project: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    content: { type: Schema.Types.ObjectId, ref: "Content", index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true, collection: "quiz4win_marketing_media_files" }
);

export type MediaFileDoc = InferSchemaType<typeof MediaFileSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const MediaFile: Model<MediaFileDoc> =
  (mongoose.models.MediaFile as Model<MediaFileDoc>) ||
  mongoose.model<MediaFileDoc>("MediaFile", MediaFileSchema);
