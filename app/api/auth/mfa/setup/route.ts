import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import {
  generateMfaSetup,
  encryptSecret,
  verifyTotp,
  generateRecoveryCodes,
} from "@/lib/auth/mfa";
import { badRequest, ok, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";

// GET: Begin enrollment - returns a fresh secret + QR; client must confirm via POST.
// Note: The temporary secret is returned to the client (and not persisted) until verified.
export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const setup = await generateMfaSetup(auth.ctx.email);
    return ok(setup);
  } catch (err) {
    return serverError(err);
  }
}

const ConfirmBody = z.object({
  secret: z.string().min(8),
  code: z.string().min(6).max(10),
});

// POST: Confirm enrollment with provided secret + code.
export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const body = ConfirmBody.safeParse(await req.json().catch(() => null));
    if (!body.success) return badRequest("Invalid input");

    if (!verifyTotp(body.data.secret, body.data.code)) {
      return badRequest("Invalid verification code");
    }
    await connectDB();
    const recoveryCodes = generateRecoveryCodes();
    await User.updateOne(
      { _id: auth.ctx.userId },
      {
        $set: {
          mfaEnabled: true,
          mfaSecretEncrypted: encryptSecret(body.data.secret),
          mfaRecoveryCodes: recoveryCodes,
        },
      }
    );
    await logActivity({
      action: "user.mfa_enabled",
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
    });
    return ok({ enabled: true, recoveryCodes });
  } catch (err) {
    return serverError(err);
  }
}

// DELETE: Disable MFA. Requires current TOTP code as proof of possession.
const DisableBody = z.object({ code: z.string().min(6).max(10).optional() });
export async function DELETE(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const body = DisableBody.safeParse(await req.json().catch(() => ({})));
    await connectDB();
    const u = await User.findById(auth.ctx.userId).select("+mfaSecretEncrypted");
    if (!u) return badRequest("User not found");
    if (u.mfaEnabled && u.mfaSecretEncrypted) {
      const { decryptSecret } = await import("@/lib/auth/mfa");
      const secret = decryptSecret(u.mfaSecretEncrypted);
      if (!body.success || !body.data.code || !verifyTotp(secret, body.data.code)) {
        return badRequest("Current MFA code is required");
      }
    }
    await User.updateOne(
      { _id: auth.ctx.userId },
      { $set: { mfaEnabled: false, mfaSecretEncrypted: "", mfaRecoveryCodes: [] } }
    );
    await logActivity({
      action: "user.mfa_disabled",
      actor: auth.ctx.userId,
      actorEmail: auth.ctx.email,
    });
    return ok({ enabled: false });
  } catch (err) {
    return serverError(err);
  }
}
