import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { MediaFile, type MediaFileDoc } from "@/models/MediaFile";
import { badRequest, ok, parsePagination, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { notifyMediaEvent } from "@/lib/notifications";
import { presignDownload, storageConfigured } from "@/lib/storage";

// Signed GET URLs expire; pick a window long enough to use across the wizard,
// list view, and a typical content review session without re-fetching.
const DISPLAY_URL_TTL_SECONDS = 60 * 60; // 1 hour

async function attachDisplayUrl<T extends Pick<MediaFileDoc, "storageKey"> & { toObject?: () => unknown }>(
  doc: T
): Promise<Record<string, unknown>> {
  const obj = (doc.toObject ? doc.toObject() : doc) as Record<string, unknown>;
  if (storageConfigured() && doc.storageKey) {
    try {
      obj.displayUrl = await presignDownload(doc.storageKey, DISPLAY_URL_TTL_SECONDS);
    } catch {
      // Fall back to the stored canonical url if signing fails.
    }
  }
  return obj;
}

const RegisterBody = z.object({
  originalFilename: z.string(),
  storageKey: z.string(),
  mimeType: z.string(),
  size: z.number(),
  url: z.string(),
  thumbnailUrl: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(),
  altText: z.string().optional(),
  project: z.string().optional(),
  content: z.string().optional(),
});

// Client calls this AFTER uploading the file to the presigned URL so the
// database mirrors what's now in object storage.
export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const body = RegisterBody.safeParse(await req.json().catch(() => null));
    if (!body.success) return badRequest("Invalid input", body.error.flatten());

    await connectDB();
    const media = await MediaFile.create({
      ...body.data,
      uploadedBy: auth.ctx.userId,
    });

    await logActivity({
      action: "media.uploaded",
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
      targetType: "MediaFile",
      targetId: media._id,
      message: body.data.originalFilename,
    });
    void notifyMediaEvent({
      action: "media.uploaded",
      filename: body.data.originalFilename,
      uploaderEmail: auth.ctx.email,
    });

    return ok({ media: await attachDisplayUrl(media) }, 201);
  } catch (err) {
    return serverError(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp);
    await connectDB();
    const filter: Record<string, unknown> = {};
    const project = sp.get("project");
    const mine = sp.get("mine") === "true";
    if (project) filter.project = project;
    if (mine) filter.uploadedBy = auth.ctx.userId;
    const [items, total] = await Promise.all([
      MediaFile.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      MediaFile.countDocuments(filter),
    ]);
    const withDisplay = await Promise.all(items.map((m) => attachDisplayUrl(m)));
    return ok({ items: withDisplay, total, page, limit });
  } catch (err) {
    return serverError(err);
  }
}
