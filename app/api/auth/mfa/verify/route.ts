import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { decryptSecret, verifyTotp } from "@/lib/auth/mfa";
import { getMfaPendingPayload, setSessionCookie, clearAllSessionCookies } from "@/lib/auth/session";
import { logActivity, extractClientMeta } from "@/lib/activity";
import { badRequest, ok, serverError, unauthorized } from "@/lib/api";
import type { UserRole } from "@/lib/constants";

const Body = z.object({
  code: z.string().min(6).max(10),
});

export async function POST(req: Request) {
  try {
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return badRequest("Invalid input");

    const pending = await getMfaPendingPayload();
    if (!pending) return unauthorized("No MFA challenge in progress");

    await connectDB();
    const user = await User.findById(pending.sub).select("+mfaSecretEncrypted +mfaRecoveryCodes");
    if (!user || !user.mfaEnabled || !user.mfaSecretEncrypted) return unauthorized("MFA not configured");

    const secret = decryptSecret(user.mfaSecretEncrypted);
    let valid = verifyTotp(secret, body.data.code);

    // Allow single-use recovery codes
    if (!valid && Array.isArray(user.mfaRecoveryCodes) && user.mfaRecoveryCodes.length) {
      const normalized = body.data.code.replace(/\s+/g, "").toUpperCase();
      const idx = user.mfaRecoveryCodes.indexOf(normalized);
      if (idx !== -1) {
        valid = true;
        user.mfaRecoveryCodes.splice(idx, 1);
        await user.save();
      }
    }

    if (!valid) {
      await logActivity({ action: "user.login_failed", actor: user._id, actorEmail: user.email, message: "bad-mfa" });
      return unauthorized("Invalid code");
    }

    const meta = extractClientMeta(req);
    await clearAllSessionCookies();
    await setSessionCookie({
      sub: String(user._id),
      email: user.email,
      role: user.role as UserRole,
      tv: user.tokenVersion || 0,
    });
    await User.updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date(), lastLoginIp: meta.ip, lastLoginUserAgent: meta.userAgent } }
    );
    await logActivity({ action: "user.login", actor: user._id, actorEmail: user.email, ip: meta.ip, userAgent: meta.userAgent });

    return ok({
      user: {
        id: String(user._id),
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (err) {
    return serverError(err);
  }
}
