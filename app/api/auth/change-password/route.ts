import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import { badRequest, ok, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { clearAllSessionCookies } from "@/lib/auth/session";

const Body = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return badRequest("Invalid input");
    const strength = validatePasswordStrength(body.data.newPassword);
    if (!strength.ok) return badRequest(strength.message);

    await connectDB();
    const user = await User.findById(auth.ctx.userId).select("+passwordHash");
    if (!user) return badRequest("User not found");
    const matches = await verifyPassword(body.data.currentPassword, user.passwordHash);
    if (!matches) return badRequest("Current password is incorrect");

    user.passwordHash = await hashPassword(body.data.newPassword);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await logActivity({
      action: "user.password_reset",
      actor: user._id,
      actorEmail: user.email,
      message: "self change-password",
    });

    // Force re-login by clearing cookies.
    await clearAllSessionCookies();
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
