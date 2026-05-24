import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { MediaFile } from "@/models/MediaFile";
import { notFound, serverError } from "@/lib/api";
import { presignAttachmentDownload, storageConfigured } from "@/lib/storage";

// Issues a short-lived signed GET URL that asks the storage backend to
// respond with Content-Disposition: attachment, so the browser saves the
// file under its original name instead of opening it. Authenticated to the
// same standard as the rest of the media APIs.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/media/[id]/download">) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    if (!storageConfigured()) {
      return serverError(new Error("Storage is not configured on the server"));
    }
    const { id } = await ctx.params;
    await connectDB();
    const m = await MediaFile.findById(id).select("storageKey originalFilename");
    if (!m) return notFound();
    const url = await presignAttachmentDownload(m.storageKey, m.originalFilename || "download", 300);
    return NextResponse.redirect(url, 302);
  } catch (err) {
    return serverError(err);
  }
}
