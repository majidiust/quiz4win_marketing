import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { badRequest, ok, serverError } from "@/lib/api";
import { buildStorageKey, presignUpload, publicUrlFor, storageConfigured } from "@/lib/storage";

const Body = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  prefix: z.string().optional(),
});

// Returns a presigned URL so the browser can PUT directly to S3-compatible storage.
export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    if (!storageConfigured()) return badRequest("Storage is not configured on the server");

    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return badRequest("Invalid input");

    const key = buildStorageKey(body.data.prefix || `uploads/${auth.ctx.userId}`, body.data.filename);
    const uploadUrl = await presignUpload(key, body.data.contentType);
    return ok({ uploadUrl, key, publicUrl: publicUrlFor(key) });
  } catch (err) {
    return serverError(err);
  }
}
