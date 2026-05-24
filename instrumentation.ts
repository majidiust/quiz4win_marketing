// Next.js boot hook (file convention). `register()` runs once when a new
// server instance is initiated. We use it to start an in-process scheduler
// that periodically spawns recurring brief instances, so no external cron
// service is required inside Docker.
//
// See: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md

export async function register() {
  // Only run inside the Node.js server runtime. The edge runtime has no
  // long-lived process / DB access.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Skip during build to avoid touching the DB while emitting the bundle.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // Escape hatch so ops can disable the in-process scheduler (e.g. when
  // running the cron as a sidecar instead).
  if (process.env.DISABLE_RECURRING_BRIEFS_CRON === "true") return;

  // Defer to a Node-only module via dynamic import so the edge-runtime
  // analyzer never sees its `process.once` / setTimeout usage.
  const mod = await import("@/lib/recurring-briefs-scheduler");
  await mod.startRecurringBriefsScheduler();
}
