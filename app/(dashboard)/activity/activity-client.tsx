"use client";

import * as React from "react";
import { Activity as ActivityIcon, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { api } from "@/lib/fetcher";
import { ACTIVITY_ACTIONS, type ActivityAction } from "@/lib/constants";

interface ActivityItem {
  _id: string;
  action: ActivityAction | string;
  message?: string;
  actorEmail?: string;
  actor?: { firstName?: string; lastName?: string; email?: string; profileImage?: string };
  project?: { projectName?: string; slug?: string };
  targetType?: string;
  targetId?: string;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

interface ListResp { items: ActivityItem[]; total: number; page: number; limit: number }

const ANY = "__any__";
const LIMIT = 30;

const ACTION_VARIANT = (action: string): "success" | "destructive" | "warning" | "info" | "muted" | "default" => {
  if (action.includes("rejected") || action.includes("failed") || action.includes("deleted") || action.includes("disabled") || action.includes("login_failed")) return "destructive";
  if (action.includes("approved") || action.includes("published") || action.includes("enabled")) return "success";
  if (action.includes("submitted") || action.includes("scheduled")) return "info";
  if (action.includes("login") || action.includes("created") || action.includes("updated")) return "default";
  return "muted";
};

export function ActivityClient() {
  const [q, setQ] = React.useState("");
  const [action, setAction] = React.useState(ANY);
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<ListResp | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (q.trim()) qs.set("q", q.trim());
      if (action !== ANY) qs.set("action", action);
      const res = await api<ListResp>(`/api/activity?${qs.toString()}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page, q, action]);

  React.useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-5">
      <PageHeader title="Activity Log" description="Audit trail of important actions across the platform" />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by message or email…" className="pl-9" />
        </div>
        <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-56"><SelectValue placeholder="All actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All actions</SelectItem>
            {ACTIVITY_ACTIONS.map((a) => <SelectItem key={a} value={a} className="font-mono text-xs">{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={<ActivityIcon className="h-8 w-8" />} title="No activity" description="No log entries match your filters." />
            </div>
          ) : (
            <ul className="divide-y">
              {data.items.map((e) => {
                const actorName = e.actor ? `${e.actor.firstName || ""} ${e.actor.lastName || ""}`.trim() : "";
                return (
                  <li key={e._id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                    <Badge variant={ACTION_VARIANT(e.action)} className="font-mono text-[10px]">{e.action}</Badge>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">
                        <span className="font-medium">{actorName || e.actorEmail || "System"}</span>
                        {e.message ? <span className="text-muted-foreground"> · {e.message}</span> : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(e.createdAt).toLocaleString()}</span>
                        {e.actorEmail ? <span>· {e.actorEmail}</span> : null}
                        {e.project?.projectName ? <span>· {e.project.projectName}</span> : null}
                        {e.targetType ? <span>· {e.targetType}</span> : null}
                        {e.ip ? <span>· {e.ip}</span> : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {data ? <Pagination page={data.page} total={data.total} limit={data.limit} onChange={setPage} /> : null}
    </div>
  );
}
