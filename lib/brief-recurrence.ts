import type { RecurrenceFreq, Weekday } from "@/lib/constants";
import { WEEKDAYS } from "@/lib/constants";

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  interval: number;
  byweekday?: Weekday[];
  bymonthday?: number;
  startsAt: Date;
  endsAt?: Date | null;
  timezone: string;
}

// Wall-clock parts of an instant expressed in a given IANA timezone. We use
// these to do calendar arithmetic without dragging in a date library; for
// DST-observing zones the result can drift by up to an hour across a DST
// boundary, which is acceptable for daily/weekly/monthly cadences.
interface WallClock {
  year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number; // 0=Sun..6=Sat
}

const PARTS = ["year", "month", "day", "hour", "minute", "second", "weekday"] as const;
type PartKey = (typeof PARTS)[number];

function wallClock(instant: Date, tz: string): WallClock {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    weekday: "short", hour12: false,
  });
  const parts: Partial<Record<PartKey, string>> = {};
  for (const p of fmt.formatToParts(instant)) {
    if ((PARTS as readonly string[]).includes(p.type)) parts[p.type as PartKey] = p.value;
  }
  const wkMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: parts.hour === "24" ? 0 : Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: wkMap[parts.weekday as string] ?? 0,
  };
}

// Build a UTC instant from wall-clock components interpreted in `tz`. Uses
// the standard "format-then-correct" round-trip.
function utcFromWallClock(wc: Omit<WallClock, "weekday">, tz: string): Date {
  const naive = Date.UTC(wc.year, wc.month - 1, wc.day, wc.hour, wc.minute, wc.second);
  const seen = wallClock(new Date(naive), tz);
  const seenUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second);
  return new Date(naive - (seenUtc - naive));
}

function addDays(wc: Omit<WallClock, "weekday">, days: number, tz: string): Date {
  return utcFromWallClock({ ...wc, day: wc.day + days }, tz);
}

function weekdayIndex(w: Weekday): number {
  return WEEKDAYS.indexOf(w);
}

// Compute the next occurrence strictly after `after` (or at/after `startsAt`
// if `after` is null). Returns null when the rule has ended.
export function computeNextRunAt(rule: RecurrenceRule, after: Date | null): Date | null {
  if (rule.endsAt && after && after >= rule.endsAt) return null;
  const tz = rule.timezone || "UTC";
  const start = rule.startsAt;
  const cursor = after && after >= start ? after : new Date(start.getTime() - 1);
  const base = wallClock(start, tz);
  const interval = Math.max(1, rule.interval || 1);

  if (rule.freq === "daily") {
    const cur = wallClock(cursor, tz);
    const next = addDays({ ...base, year: cur.year, month: cur.month, day: cur.day }, interval, tz);
    if (next <= cursor) return addDays({ ...base, year: cur.year, month: cur.month, day: cur.day + interval * 2 }, 0, tz);
    return rule.endsAt && next > rule.endsAt ? null : next;
  }

  if (rule.freq === "weekly") {
    const allowed = (rule.byweekday && rule.byweekday.length ? rule.byweekday : [WEEKDAYS[base.weekday]]).map(weekdayIndex).sort((a, b) => a - b);
    // Walk forward day-by-day from cursor + 1, up to interval * 7 + 7 days.
    for (let i = 1; i <= interval * 7 + 7; i++) {
      const probe = addDays(wallClock(cursor, tz), i, tz);
      const probeWc = wallClock(probe, tz);
      if (!allowed.includes(probeWc.weekday)) continue;
      // Validate this week is on-interval relative to startsAt's week.
      const weeksSince = Math.floor((probe.getTime() - start.getTime()) / (7 * 86400_000));
      if (weeksSince % interval !== 0 && weeksSince >= 0) continue;
      const fixed = utcFromWallClock({ ...probeWc, hour: base.hour, minute: base.minute, second: base.second }, tz);
      if (fixed > cursor) return rule.endsAt && fixed > rule.endsAt ? null : fixed;
    }
    return null;
  }

  // monthly
  const cur = wallClock(cursor, tz);
  const day = rule.bymonthday || base.day;
  for (let k = 0; k < 36; k++) {
    const targetMonth0 = (cur.month - 1) + k + 1; // 0-based, advance at least 1
    const year = cur.year + Math.floor(targetMonth0 / 12);
    const month = (targetMonth0 % 12) + 1;
    // Skip months that aren't on-interval relative to startsAt.
    const monthsSince = (year - base.year) * 12 + (month - base.month);
    if (monthsSince < 0 || monthsSince % interval !== 0) continue;
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const clampedDay = Math.min(day, lastDayOfMonth);
    const candidate = utcFromWallClock({ year, month, day: clampedDay, hour: base.hour, minute: base.minute, second: base.second }, tz);
    if (candidate > cursor && (!rule.endsAt || candidate <= rule.endsAt)) return candidate;
  }
  return null;
}

// Pretty-print a recurrence rule for the UI. Kept small; localisation can
// wrap this later.
export function describeRecurrence(r: RecurrenceRule): string {
  const everyN = r.interval > 1 ? `every ${r.interval} ` : "";
  const base = r.freq === "daily" ? `${everyN}day${r.interval > 1 ? "s" : ""}`
    : r.freq === "weekly" ? `${everyN}week${r.interval > 1 ? "s" : ""}`
    : `${everyN}month${r.interval > 1 ? "s" : ""}`;
  let extra = "";
  if (r.freq === "weekly" && r.byweekday?.length) {
    extra = ` on ${r.byweekday.join(", ")}`;
  } else if (r.freq === "monthly" && r.bymonthday) {
    extra = ` on day ${r.bymonthday}`;
  }
  const tz = r.timezone && r.timezone !== "UTC" ? ` (${r.timezone})` : "";
  return `Repeats ${base}${extra}${tz}`;
}
