import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { scanAndSpawnDue } from "@/lib/brief-spawner";
import { ok, serverError } from "@/lib/api";

// Authenticated entry point for an external scheduler (Vercel Cron, GitHub
// Actions, etc.). Requires a shared secret in either the Authorization
// header (Bearer) or a `secret` query parameter. Bypasses the lazy-scan
// throttle.
export async function POST(req: NextRequest) {
  try {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
      return Response.json({ error: "CRON_SECRET not configured" }, { status: 500 });
    }
    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    const qp = req.nextUrl.searchParams.get("secret");
    if (bearer !== expected && qp !== expected) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const result = await scanAndSpawnDue({ force: true });
    return ok({ ...result, ranAt: new Date().toISOString() });
  } catch (err) {
    return serverError(err);
  }
}

// Allow GET for compatibility with schedulers that only issue GETs.
export const GET = POST;
