import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { USER_ROLES, USER_STATUS } from "@/lib/constants";

const UserSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    profileImage: { type: String, default: "" },
    role: { type: String, enum: USER_ROLES, required: true, default: "marketing_user" },
    status: { type: String, enum: USER_STATUS, default: "active", index: true },
    assignedProjects: [{ type: Schema.Types.ObjectId, ref: "Project", default: [] }],
    // MFA / TOTP
    mfaEnabled: { type: Boolean, default: false },
    mfaSecretEncrypted: { type: String, default: "", select: false },
    mfaRecoveryCodes: { type: [String], default: [], select: false },
    // Security/session
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
    lastLoginUserAgent: { type: String },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    // Token versioning to invalidate JWTs on password change
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "quiz4win_marketing_users" }
);

UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ assignedProjects: 1 });

UserSchema.virtual("fullName").get(function (this: { firstName: string; lastName: string }) {
  return `${this.firstName} ${this.lastName}`.trim();
});

UserSchema.set("toJSON", { virtuals: true });
UserSchema.set("toObject", { virtuals: true });

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: mongoose.Types.ObjectId };

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) ||
  mongoose.model<UserDoc>("User", UserSchema);
