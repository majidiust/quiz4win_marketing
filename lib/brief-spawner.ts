import type { HydratedDocument } from "mongoose";
import { ContentBrief, type ContentBriefDoc } from "@/models/ContentBrief";
import { logActivity } from "@/lib/activity";
import { computeNextRunAt, type RecurrenceRule } from "@/lib/brief-recurrence";

// Fields copied from a template into each spawned instance. Workflow fields
// (status, assignedTo, dates, comments, history) are always reset.
const CLONED_FIELDS = [
  "title", "description", "goal", "project", "isGeneralMarketing",
  "platform", "contentType", "funnelStage", "language",
  "targetCountry", "targetAudience",
  "suggestedHashtags", "suggestedMentions", "suggestedCTA",
  "priority", "references", "referenceMedia",
] as const;

interface SpawnResult {
  instance: HydratedDocument<ContentBriefDoc>;
  template: HydratedDocument<ContentBriefDoc>;
}

// Clone a template into a fresh brief instance and advance the template's
// scheduling cursor. Returns the new instance + the updated template.
export async function spawnTemplateInstance(
  template: HydratedDocument<ContentBriefDoc>,
  occurrenceAt: Date
): Promise<SpawnResult> {
  if (!template.isTemplate || !template.recurrence) {
    throw new Error("Brief is not a recurring template");
  }
  const data: Record<string, unknown> = {};
  for (const k of CLONED_FIELDS) data[k] = (template as unknown as Record<string, unknown>)[k];

  const now = new Date();
  const deadline = template.deadlineOffsetHours
    ? new Date(occurrenceAt.getTime() + template.deadlineOffsetHours * 3_600_000)
    : undefined;

  const initialStatus = template.assignedTo ? "assigned" : "created";

  const instance = await ContentBrief.create({
    ...data,
    template: template._id,
    assignedTo: template.assignedTo ?? undefined,
    assignedAt: template.assignedTo ? now : undefined,
    deadline,
    status: initialStatus,
    statusChangedAt: now,
    createdBy: template.createdBy,
    isTemplate: false,
    activityLog: [
      { action: "spawned_from_template", by: template.createdBy, toStatus: initialStatus, note: `Occurrence at ${occurrenceAt.toISOString()}` },
    ],
  });

  // Advance template scheduling cursor.
  template.lastRunAt = occurrenceAt;
  template.occurrenceCount = (template.occurrenceCount || 0) + 1;
  template.nextRunAt = computeNextRunAt(toRule(template), occurrenceAt) ?? undefined;
  await template.save();

  await logActivity({
    action: "brief.spawned",
    actor: template.createdBy,
    targetType: "ContentBrief",
    targetId: instance._id,
    project: instance.project ?? undefined,
    message: `Spawned from template "${template.title}"`,
  });

  return { instance, template };
}

function toRule(t: HydratedDocument<ContentBriefDoc>): RecurrenceRule {
  const r = t.recurrence!;
  return {
    freq: r.freq,
    interval: r.interval || 1,
    byweekday: r.byweekday as RecurrenceRule["byweekday"],
    bymonthday: r.bymonthday ?? undefined,
    startsAt: r.startsAt,
    endsAt: r.endsAt ?? null,
    timezone: r.timezone || "UTC",
  };
}

// In-memory throttle so the lazy on-read scan doesn't run more than once per
// minute per server instance. The cron endpoint bypasses this.
let lastScanAt = 0;
const SCAN_THROTTLE_MS = 60_000;

export async function scanAndSpawnDue(options: { force?: boolean } = {}): Promise<{ spawned: number; skipped: number }> {
  const now = Date.now();
  if (!options.force && now - lastScanAt < SCAN_THROTTLE_MS) {
    return { spawned: 0, skipped: -1 };
  }
  lastScanAt = now;

  const due = await ContentBrief.find({
    isTemplate: true,
    isDeleted: { $ne: true },
    nextRunAt: { $ne: null, $lte: new Date() },
  }).limit(50);

  let spawned = 0;
  for (const tpl of due) {
    try {
      // Guard against rules that ended between scans.
      if (tpl.recurrence?.endsAt && tpl.nextRunAt && tpl.nextRunAt > tpl.recurrence.endsAt) {
        tpl.nextRunAt = undefined;
        await tpl.save();
        continue;
      }
      if (!tpl.nextRunAt) continue;
      await spawnTemplateInstance(tpl, tpl.nextRunAt);
      spawned++;
    } catch {
      // Don't let a single bad template block the rest.
    }
  }
  return { spawned, skipped: due.length - spawned };
}
