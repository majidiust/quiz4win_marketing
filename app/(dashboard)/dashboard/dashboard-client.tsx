"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, FolderKanban, Users, Clock, CheckCircle2, AlertTriangle, CalendarDays } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/fetcher";
import { useUser } from "@/components/providers/user-provider";
import {
  CONTENT_STATUS_LABELS,
  PLATFORM_LABELS,
  type ContentStatus,
  type Platform,
} from "@/lib/constants";
import { StatusChart, PlatformChart, TrendsChart } from "./charts";

interface Stats {
  totals: Record<string, number>;
  byStatus: { _id: ContentStatus; count: number }[];
  byPlatform: { _id: Platform; count: number }[];
  byProject: { _id: string; count: number; projectName?: string; isGeneralMarketing?: boolean }[];
  upcoming: Array<{
    _id: string;
    title: string;
    publishDate?: string;
    status: ContentStatus;
    platform: Platform;
    project?: { projectName?: string; isGeneralMarketing?: boolean };
  }>;
  recentActivity: Array<{
    _id: string;
    action: string;
    actor?: { firstName?: string; lastName?: string; email?: string };
    actorEmail?: string;
    createdAt: string;
    message?: string;
  }>;
  publishingTrends: { _id: string; count: number }[];
}

export function DashboardClient() {
  const { user } = useUser();
  const [data, setData] = React.useState<Stats | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api<Stats>("/api/dashboard/stats")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back${user ? `, ${user.firstName}` : ""}`}
        description="Operational overview of your marketing pipeline."
      />

      {error ? (
        <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Content" value={data?.totals.content} icon={FileText} accent="text-primary" />
        <KpiCard label="Awaiting Review" value={data?.totals.under_review} icon={Clock} accent="text-warning" />
        <KpiCard label="Scheduled" value={data?.totals.scheduled} icon={CalendarDays} accent="text-info" />
        <KpiCard label="Published" value={data?.totals.published} icon={CheckCircle2} accent="text-success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Publishing trends</CardTitle>
            <CardDescription>Published content over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? <TrendsChart data={data.publishingTrends} /> : <Skeleton className="h-64 w-full" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status breakdown</CardTitle>
            <CardDescription>Pipeline distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? <StatusChart data={data.byStatus} /> : <Skeleton className="h-64 w-full" />}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By platform</CardTitle>
            <CardDescription>Content per destination platform</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? <PlatformChart data={data.byPlatform} /> : <Skeleton className="h-64 w-full" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By project</CardTitle>
            <CardDescription>Top projects by content volume</CardDescription>
          </CardHeader>
          <CardContent>
            {!data ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}
              </div>
            ) : data.byProject.length === 0 ? (
              <EmptyHint text="No project data yet." />
            ) : (
              <ul className="space-y-1.5">
                {data.byProject.map((p) => {
                  const total = Math.max(1, data.byProject[0]?.count || 1);
                  const pct = Math.round((p.count / total) * 100);
                  return (
                    <li key={p._id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate">
                          {p.projectName || (p.isGeneralMarketing ? "General Marketing" : "—")}
                        </span>
                        <span className="text-muted-foreground tabular-nums">{p.count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming posts</CardTitle>
              <CardDescription>Scheduled & approved content</CardDescription>
            </div>
            <Link href="/calendar" className="text-xs font-medium text-primary hover:underline">Calendar →</Link>
          </CardHeader>
          <CardContent>
            {!data ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : data.upcoming.length === 0 ? (
              <EmptyHint text="No upcoming content scheduled." />
            ) : (
              <ul className="divide-y">
                {data.upcoming.map((c) => (
                  <li key={c._id} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <Link href={`/content/${c._id}`} className="block truncate text-sm font-medium hover:underline">
                        {c.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span>{c.project?.projectName || "General Marketing"}</span>
                        <span>·</span>
                        <span>{PLATFORM_LABELS[c.platform]}</span>
                        {c.publishDate ? (
                          <>
                            <span>·</span>
                            <span>{new Date(c.publishDate).toLocaleString()}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Latest team actions</CardDescription>
            </div>
            <Link href="/activity" className="text-xs font-medium text-primary hover:underline">View all →</Link>
          </CardHeader>
          <CardContent>
            {!data ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : data.recentActivity.length === 0 ? (
              <EmptyHint text="No activity yet." />
            ) : (
              <ul className="divide-y">
                {data.recentActivity.slice(0, 8).map((a) => {
                  const who = a.actor ? `${a.actor.firstName || ""} ${a.actor.lastName || ""}`.trim() || a.actor.email : a.actorEmail || "System";
                  return (
                    <li key={a._id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm">
                          <span className="font-medium">{who}</span>{" "}
                          <span className="text-muted-foreground">· {a.action.replace(/_/g, " ")}</span>
                        </div>
                        {a.message ? <div className="truncate text-xs text-muted-foreground">{a.message}</div> : null}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(a.createdAt).toLocaleString()}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {(data?.totals.users || data?.totals.projects) ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniCard label="Active users" value={data.totals.users} icon={Users} />
          <MiniCard label="Active projects" value={data.totals.projects} icon={FolderKanban} />
          <MiniCard label="Drafts" value={data.totals.draft} icon={FileText} />
          <MiniCard label="Failed publishes" value={data.totals.failed} icon={AlertTriangle} accent="text-destructive" />
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, accent }: { label: string; value?: number; icon: React.ComponentType<{ className?: string }>; accent?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums">
            {value === undefined ? <Skeleton className="h-7 w-16" /> : value.toLocaleString()}
          </div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${accent || "text-foreground"}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function MiniCard({ label, value, icon: Icon, accent }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; accent?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-9 w-9 items-center justify-center rounded-md bg-muted ${accent || "text-foreground"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-base font-semibold tabular-nums">{value.toLocaleString()}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <div className="py-6 text-center text-sm text-muted-foreground">{text}</div>;
}

// Helper for status badges in case status isn't a known ContentStatus
export function _statusName(s: string) {
  return (CONTENT_STATUS_LABELS as Record<string, string>)[s] || s;
}

// Stop unused-warning
void Badge;
