import { clearAllSessionCookies } from "@/lib/auth/session";
import { getSessionFromCookies } from "@/lib/auth/session";
import { logActivity, extractClientMeta } from "@/lib/activity";
import { ok, serverError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (session) {
      const meta = extractClientMeta(req);
      await logActivity({
        action: "user.logout",
        actor: session.sub,
        actorEmail: session.email,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    }
    await clearAllSessionCookies();
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
