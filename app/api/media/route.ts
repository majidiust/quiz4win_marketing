import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { MediaFile } from "@/models/MediaFile";
import { badRequest, ok, parsePagination, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";

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

    return ok({ media }, 201);
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
    return ok({ items, total, page, limit });
  } catch (err) {
    return serverError(err);
  }
}
