"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/fetcher";
import { useUser } from "@/components/providers/user-provider";
import {
  CONTENT_STATUS, CONTENT_STATUS_LABELS, PLATFORMS, PLATFORM_LABELS,
  type ContentStatus, type Platform,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

interface CalendarItem {
  _id: string;
  title: string;
  status: ContentStatus;
  platform: Platform;
  publishDate?: string;
  scheduledAt?: string;
  publishedAt?: string;
  campaignName?: string;
  project?: { projectName?: string; brandColors?: { primary?: string } };
  isGeneralMarketing?: boolean;
}

interface ProjectOption { _id: string; projectName: string }

const ANY = "__any__";
const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59); }
function gridStart(d: Date) { const s = startOfMonth(d); return new Date(s.getFullYear(), s.getMonth(), s.getDate() - s.getDay()); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function dateKey(d: Date) { return d.toISOString().slice(0, 10); }

function effectiveDate(it: CalendarItem): Date | null {
  const v = it.scheduledAt || it.publishedAt || it.publishDate;
  return v ? new Date(v) : null;
}

export function CalendarClient() {
  const { hasPermission } = useUser();
  const [cursor, setCursor] = React.useState(() => startOfMonth(new Date()));
  const [items, setItems] = React.useState<CalendarItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const [filters, setFilters] = React.useState({ project: ANY, platform: ANY, status: ANY });
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);

  React.useEffect(() => {
    api<{ items: ProjectOption[] }>("/api/projects?limit=100").then((r) => setProjects(r.items || [])).catch(() => {});
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const from = gridStart(cursor).toISOString();
      const to = addDays(gridStart(cursor), 41).toISOString();
      const qs = new URLSearchParams({ from, to });
      if (filters.project !== ANY) qs.set("project", filters.project);
      if (filters.platform !== ANY) qs.set("platform", filters.platform);
      if (filters.status !== ANY) qs.set("status", filters.status);
      const res = await api<{ items: CalendarItem[] }>(`/api/calendar?${qs.toString()}`);
      setItems(res.items || []);
    } finally {
      setLoading(false);
    }
  }, [cursor, filters]);

  React.useEffect(() => { load(); }, [load]);

  const byDay = React.useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const d = effectiveDate(it);
      if (!d) continue;
      const key = dateKey(d);
      const arr = map.get(key) || [];
      arr.push(it);
      map.set(key, arr);
    }
    return map;
  }, [items]);

  const days: Date[] = React.useMemo(() => {
    const start = gridStart(cursor);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const today = new Date();
  const selectedItems = selectedDay ? (byDay.get(selectedDay) || []) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Content Calendar"
        description="Plan, schedule and review marketing content across projects"
        actions={
          hasPermission("content.create") ? (
            <Button asChild><Link href="/content/new"><Plus className="h-4 w-4" /> New content</Link></Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-md border">
          <Button variant="ghost" size="sm" className="rounded-none" onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="px-3 text-sm font-medium min-w-40 text-center">{monthLabel}</div>
          <Button variant="ghost" size="sm" className="rounded-none" onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>Today</Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Select value={filters.project} onValueChange={(v) => setFilters((f) => ({ ...f, project: v }))}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All projects</SelectItem>
              {projects.map((p) => <SelectItem key={p._id} value={p._id}>{p.projectName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.platform} onValueChange={(v) => setFilters((f) => ({ ...f, platform: v }))}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All platforms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All platforms</SelectItem>
              {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{PLATFORM_LABELS[p]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All statuses</SelectItem>
              {CONTENT_STATUS.map((s) => <SelectItem key={s} value={s}>{CONTENT_STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b text-xs font-medium text-muted-foreground">
            {WEEK_DAYS.map((d) => <div key={d} className="px-2 py-2 text-center">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr">
            {days.map((d, i) => {
              const key = dateKey(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const isToday = sameDay(d, today);
              const dayItems = byDay.get(key) || [];
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  className={cn(
                    "min-h-24 sm:min-h-28 border-b border-r p-1.5 text-left text-xs transition-colors hover:bg-muted/40",
                    !inMonth && "bg-muted/20 text-muted-foreground",
                    selectedDay === key && "bg-primary/5 ring-1 ring-primary/30",
                    i % 7 === 6 && "border-r-0"
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium", isToday && "bg-primary text-primary-foreground")}>{d.getDate()}</span>
                    {dayItems.length > 0 ? <span className="text-[10px] text-muted-foreground">{dayItems.length}</span> : null}
                  </div>
                  <div className="space-y-1">
                    {dayItems.slice(0, 3).map((it) => (
                      <div key={it._id} className="truncate rounded px-1 py-0.5 text-[10px]" style={{ background: it.project?.brandColors?.primary ? `${it.project.brandColors.primary}22` : undefined, color: it.project?.brandColors?.primary || undefined }}>
                        <span className="font-medium">{it.title}</span>
                      </div>
                    ))}
                    {dayItems.length > 3 ? <div className="text-[10px] text-muted-foreground">+{dayItems.length - 3} more</div> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedDay ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{new Date(selectedDay).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>Close</Button>
            </div>
            {selectedItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">No scheduled content for this day.</p>
            ) : (
              <ul className="divide-y">
                {selectedItems.map((it) => (
                  <li key={it._id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/content/${it._id}`} className="min-w-0 flex-1 hover:underline">
                      <div className="truncate text-sm font-medium">{it.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{it.project?.projectName || (it.isGeneralMarketing ? "General Marketing" : "—")} · {PLATFORM_LABELS[it.platform]}{it.campaignName ? ` · ${it.campaignName}` : ""}</div>
                    </Link>
                    <StatusBadge status={it.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {loading ? <div className="text-center text-xs text-muted-foreground">Loading…</div> : null}
    </div>
  );
}
