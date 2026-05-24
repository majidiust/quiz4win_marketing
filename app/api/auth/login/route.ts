import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { verifyPassword } from "@/lib/auth/password";
import { signMfaChallengeToken } from "@/lib/auth/jwt";
import { setSessionCookie, setMfaPendingCookie } from "@/lib/auth/session";
import { verifyRecaptcha } from "@/lib/auth/recaptcha";
import { bootstrapAdminIfNeeded } from "@/lib/bootstrap";
import { logActivity, extractClientMeta } from "@/lib/activity";
import { env } from "@/lib/env";
import { badRequest, ok, serverError, unauthorized } from "@/lib/api";
import type { UserRole } from "@/lib/constants";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  recaptchaToken: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    await bootstrapAdminIfNeeded();
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return badRequest("Invalid input", body.error.flatten());

    const captcha = await verifyRecaptcha(body.data.recaptchaToken, "login");
    if (!captcha.ok) return badRequest("reCAPTCHA verification failed");

    await connectDB();
    const meta = extractClientMeta(req);
    const user = await User.findOne({ email: body.data.email.toLowerCase() }).select(
      "+passwordHash +mfaSecretEncrypted"
    );

    if (!user) {
      await logActivity({ action: "user.login_failed", actorEmail: body.data.email, ip: meta.ip, userAgent: meta.userAgent, message: "no-such-user" });
      return unauthorized("Invalid email or password");
    }

    if (user.status !== "active") {
      await logActivity({ action: "user.login_failed", actor: user._id, actorEmail: user.email, message: `status:${user.status}`, ip: meta.ip, userAgent: meta.userAgent });
      return unauthorized("Account is not active");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return unauthorized(`Account locked. Try again later.`);
    }

    const passwordOk = await verifyPassword(body.data.password, user.passwordHash);
    if (!passwordOk) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const update: Record<string, unknown> = { failedLoginAttempts: attempts };
      if (attempts >= env.security.maxLoginAttempts) {
        update.lockedUntil = new Date(Date.now() + env.security.loginLockoutMinutes * 60 * 1000);
        update.failedLoginAttempts = 0;
      }
      await User.updateOne({ _id: user._id }, { $set: update });
      await logActivity({ action: "user.login_failed", actor: user._id, actorEmail: user.email, message: "bad-password", ip: meta.ip, userAgent: meta.userAgent });
      return unauthorized("Invalid email or password");
    }

    // Successful password step
    await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockedUntil: null } });

    if (user.mfaEnabled && user.mfaSecretEncrypted) {
      const challenge = signMfaChallengeToken(String(user._id), user.email, user.role as UserRole, user.tokenVersion || 0);
      await setMfaPendingCookie(challenge);
      return ok({ mfaRequired: true });
    }

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
      mfaRequired: false,
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
