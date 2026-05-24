import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { badRequest, ok, serverError } from "@/lib/api";

const Body = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  profileImage: z.string().optional(),
});

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return badRequest("Invalid input");
    await connectDB();
    await User.updateOne({ _id: auth.ctx.userId }, { $set: body.data });
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
