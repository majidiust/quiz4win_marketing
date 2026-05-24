import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const SocialAccountSchema = new Schema(
  {
    platform: { type: String, required: true },
    handle: { type: String, default: "" },
    url: { type: String, default: "" },
    accountId: { type: String, default: "" },
  },
  { _id: false }
);

const ProjectSchema = new Schema(
  {
    projectName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    logo: { type: String, default: "" },
    description: { type: String, default: "" },

    brandColors: {
      primary: { type: String, default: "#6366f1" },
      secondary: { type: String, default: "#0ea5e9" },
      accent: { type: String, default: "#f59e0b" },
      neutral: { type: String, default: "#0f172a" },
    },

    typography: {
      headingFont: { type: String, default: "" },
      bodyFont: { type: String, default: "" },
      notes: { type: String, default: "" },
    },

    socialAccounts: { type: [SocialAccountSchema], default: [] },

    defaultHashtags: { type: [String], default: [] },
    defaultCTA: { type: String, default: "" },

    targetLanguages: { type: [String], default: [] },
    targetCountries: { type: [String], default: [] },

    contentGuidelines: { type: String, default: "" },
    complianceNotes: { type: String, default: "" },

    isActive: { type: Boolean, default: true, index: true },

    // Anyone can see general marketing projects regardless of assignedProjects.
    isGeneralMarketing: { type: Boolean, default: false, index: true },

    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "quiz4win_marketing_projects" }
);

ProjectSchema.index({ projectName: "text", description: "text" });

export type ProjectDoc = InferSchemaType<typeof ProjectSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Project: Model<ProjectDoc> =
  (mongoose.models.Project as Model<ProjectDoc>) ||
  mongoose.model<ProjectDoc>("Project", ProjectSchema);
