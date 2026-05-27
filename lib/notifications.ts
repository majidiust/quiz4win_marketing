// Application-level email notification helpers.
// All functions are fire-and-forget — errors are logged, never thrown.

import type { Types } from "mongoose";
import { connectDB } from "./db";
import { User } from "@/models/User";
import { sendBrevoEmail, type BrevoRecipient } from "./brevo";
import { env } from "./env";

// ---------- helpers ----------

async function resolveRecipients(
  ids: Array<Types.ObjectId | string | null | undefined>
): Promise<BrevoRecipient[]> {
  const valid = [...new Set(ids.filter(Boolean).map(String))];
  if (!valid.length) return [];
  await connectDB();
  const users = await User.find({ _id: { $in: valid }, status: "active" })
    .select("email firstName lastName")
    .lean();
  return users.map((u) => ({
    email: u.email as string,
    name: `${u.firstName} ${u.lastName}`.trim(),
  }));
}

const ACTION_LABELS: Record<string, string> = {
  "brief.created": "created",
  "brief.updated": "updated",
  "brief.assigned": "assigned to you",
  "brief.in_progress": "moved to In Progress",
  "brief.completed": "completed",
  "brief.archived": "archived",
  "brief.deleted": "deleted",
  "brief.commented": "commented on",
  "brief.duplicated": "duplicated",
  "brief.spawned": "auto-generated",
  "media.uploaded": "uploaded",
  "media.deleted": "deleted",
};

function briefHtml(opts: {
  recipientName: string;
  action: string;
  briefTitle: string;
  briefId: string;
  note?: string;
}): string {
  const url = `${env.appUrl}/briefs/${opts.briefId}`;
  const label = ACTION_LABELS[opts.action] ?? opts.action;
  return `<!DOCTYPE html>
<html lang="en">
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1a56db;margin-bottom:8px">Brief Notification</h2>
  <p>Hello ${opts.recipientName},</p>
  <p>The brief <strong>${opts.briefTitle}</strong> has been <strong>${label}</strong>.</p>
  ${opts.note ? `<p style="background:#f3f4f6;border-left:4px solid #1a56db;padding:8px 12px;border-radius:4px"><em>${opts.note}</em></p>` : ""}
  <p>
    <a href="${url}" style="display:inline-block;background:#1a56db;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;margin-top:8px">
      View Brief
    </a>
  </p>
  <p style="color:#9ca3af;font-size:12px;margin-top:32px">
    This is an automated notification from ${env.appName}. You are receiving this because you are involved with this brief.
  </p>
</body>
</html>`;
}

// ---------- public API ----------

/**
 * Notify the creator and/or assignee of a brief event.
 * The actor (the person who triggered the action) is excluded so they don't
 * receive a notification about their own action.
 */
export async function notifyBriefEvent(opts: {
  action: string;
  briefId: string;
  briefTitle: string;
  /** Email of the person who performed the action — they are excluded. */
  actorEmail: string;
  creatorId?: Types.ObjectId | string | null;
  assigneeId?: Types.ObjectId | string | null;
  note?: string;
}): Promise<void> {
  try {
    const recipients = await resolveRecipients([opts.creatorId, opts.assigneeId]);
    if (!recipients.length) return;

    const label = ACTION_LABELS[opts.action] ?? opts.action;
    const subject = `Brief "${opts.briefTitle}" has been ${label}`;

    for (const r of recipients) {
      if (r.email === opts.actorEmail) continue; // skip self-notification
      await sendBrevoEmail({
        to: [r],
        subject,
        htmlContent: briefHtml({
          recipientName: r.name || r.email,
          action: opts.action,
          briefTitle: opts.briefTitle,
          briefId: opts.briefId,
          note: opts.note,
        }),
      });
    }
  } catch (err) {
    console.error("[notifications] notifyBriefEvent error:", err);
  }
}

/**
 * Notify the uploader when a media file event occurs.
 */
export async function notifyMediaEvent(opts: {
  action: string;
  filename: string;
  uploaderEmail: string;
  uploaderName?: string;
}): Promise<void> {
  try {
    const label = ACTION_LABELS[opts.action] ?? opts.action;
    const subject = `Your file "${opts.filename}" has been ${label}`;
    const html = `<!DOCTYPE html>
<html lang="en">
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1a56db;margin-bottom:8px">Media Notification</h2>
  <p>Hello ${opts.uploaderName || opts.uploaderEmail},</p>
  <p>Your file <strong>${opts.filename}</strong> has been successfully <strong>${label}</strong>.</p>
  <p>
    <a href="${env.appUrl}/media" style="display:inline-block;background:#1a56db;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;margin-top:8px">
      View Media Library
    </a>
  </p>
  <p style="color:#9ca3af;font-size:12px;margin-top:32px">
    This is an automated notification from ${env.appName}.
  </p>
</body>
</html>`;
    await sendBrevoEmail({
      to: [{ email: opts.uploaderEmail, name: opts.uploaderName }],
      subject,
      htmlContent: html,
    });
  } catch (err) {
    console.error("[notifications] notifyMediaEvent error:", err);
  }
}
