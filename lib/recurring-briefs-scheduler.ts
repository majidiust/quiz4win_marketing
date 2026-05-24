// In-process scheduler for recurring brief spawns. Loaded only from the
// Node.js runtime via instrumentation.ts. Kept in a separate file so the
// Next.js edge-runtime analyzer never sees `process.once` / setTimeout
// patterns it would warn about.

export async function startRecurringBriefsScheduler() {
  const { connectDB } = await import("@/lib/db");
  const { scanAndSpawnDue } = await import("@/lib/brief-spawner");

  const intervalMs = Math.max(
    15_000,
    Number(process.env.RECURRING_BRIEFS_INTERVAL_MS) || 60_000
  );
  const startupDelayMs = Math.max(
    0,
    Number(process.env.RECURRING_BRIEFS_STARTUP_DELAY_MS) || 5_000
  );

  // Single-flight tick: chain the next run only after the previous one
  // settles so a slow scan never overlaps with itself.
  //
  // NOTE: in a multi-replica deployment each replica would run its own
  // scheduler. The spawn path is not protected by a distributed lock, so
  // multiple replicas may race and spawn duplicates. Either keep this to a
  // single container, set DISABLE_RECURRING_BRIEFS_CRON=true on all but one
  // replica, or front the scan with a Mongo-level lock if you scale out.
  let stopped = false;
  async function tick() {
    if (stopped) return;
    try {
      await connectDB();
      const res = await scanAndSpawnDue({ force: true });
      if (res.spawned > 0) {
        console.log(`[recurring-briefs] spawned ${res.spawned} instance(s)`);
      }
    } catch (err) {
      console.error(
        "[recurring-briefs] scan failed:",
        err instanceof Error ? err.message : err
      );
    } finally {
      if (!stopped) setTimeout(tick, intervalMs).unref?.();
    }
  }

  setTimeout(tick, startupDelayMs).unref?.();

  const stop = () => {
    stopped = true;
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);

  console.log(
    `[recurring-briefs] in-process scheduler registered (every ${intervalMs}ms, starting in ${startupDelayMs}ms)`
  );
}
