import { z } from "zod";
import { requirePermission } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { Setting } from "@/models/Setting";
import { badRequest, ok, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";

export async function GET() {
  try {
    const auth = await requirePermission("settings.read");
    if (!auth.ok) return auth.response;
    await connectDB();
    const items = await Setting.find();
    const map: Record<string, unknown> = {};
    for (const s of items) map[s.key] = s.value;
    return ok({ settings: map });
  } catch (err) {
    return serverError(err);
  }
}

const Body = z.object({
  settings: z.record(z.string(), z.any()),
});

export async function PUT(req: Request) {
  try {
    const auth = await requirePermission("settings.update");
    if (!auth.ok) return auth.response;
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return badRequest("Invalid input");
    await connectDB();
    const ops = Object.entries(body.data.settings).map(([key, value]) =>
      Setting.updateOne(
        { key },
        { $set: { value, updatedBy: auth.ctx.userId } },
        { upsert: true }
      )
    );
    await Promise.all(ops);
    await logActivity({
      action: "settings.updated",
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
    });
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
