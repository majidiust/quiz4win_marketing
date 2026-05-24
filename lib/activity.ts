import { connectDB } from "./db";
import { ActivityLog } from "@/models/ActivityLog";
import type { ActivityAction } from "./constants";
import type { Types } from "mongoose";

export interface LogActivityInput {
  action: ActivityAction;
  actor?: Types.ObjectId | string;
  actorEmail?: string;
  targetType?: string;
  targetId?: Types.ObjectId | string;
  project?: Types.ObjectId | string;
  message?: string;
  meta?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await connectDB();
    await ActivityLog.create(input);
  } catch (err) {
    // Never throw from activity logging — it must not block business operations.
    console.error("[activity] failed to write log:", err);
  }
}

export function extractClientMeta(req: Request): { ip: string; userAgent: string } {
  const h = req.headers;
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "";
  const userAgent = h.get("user-agent") || "";
  return { ip, userAgent };
}
