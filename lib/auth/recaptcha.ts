import { env } from "@/lib/env";

interface RecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
}

export async function verifyRecaptcha(token: string | undefined, expectedAction?: string): Promise<{ ok: boolean; score?: number; reason?: string }> {
  if (!env.recaptchaEnabled) return { ok: true };
  if (!env.recaptchaSecret) return { ok: true }; // not configured
  if (!token) return { ok: false, reason: "Missing reCAPTCHA token" };

  try {
    const body = new URLSearchParams({
      secret: env.recaptchaSecret,
      response: token,
    });
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data: RecaptchaResponse = await res.json();
    if (!data.success) return { ok: false, reason: (data["error-codes"] || []).join(",") || "recaptcha-failed" };
    if (expectedAction && data.action && data.action !== expectedAction) {
      return { ok: false, reason: "action-mismatch" };
    }
    if (typeof data.score === "number" && data.score < env.recaptchaMinScore) {
      return { ok: false, score: data.score, reason: "low-score" };
    }
    return { ok: true, score: data.score };
  } catch {
    return { ok: false, reason: "recaptcha-error" };
  }
}
