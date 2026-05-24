"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, ClipboardList, X, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { BriefStatusBadge } from "@/components/brief-status-badge";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { api } from "@/lib/fetcher";
import { useUser } from "@/components/providers/user-provider";
import { BRIEF_STATUS, BRIEF_STATUS_LABELS, PLATFORMS, PLATFORM_LABELS, type BriefStatus, type Platform } from "@/lib/constants";

interface BriefListItem {
  _id: string;
  title: string;
  status: BriefStatus;
  platform?: Platform;
  deadline?: string;
  updatedAt: string;
  isGeneralMarketing?: boolean;
  project?: { projectName?: string };
  createdBy?: { firstName?: string; lastName?: string; email?: string };
  assignedTo?: { firstName?: string; lastName?: string; email?: string };
  isTemplate?: boolean;
  nextRunAt?: string;
}

interface BriefsResp { items: BriefListItem[]; total: number; page: number; limit: number }
interface ProjectOption { _id: string; projectName: string }
const ANY = "__any__";

export function BriefsClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const { hasPermission, user } = useUser();

  const [q, setQ] = React.useState(sp.get("q") || "");
  const [status, setStatus] = React.useState(sp.get("status") || ANY);
  const [platform, setPlatform] = React.useState(sp.get("platform") || ANY);
  const [project, setProject] = React.useState(sp.get("project") || ANY);
  // Scope toggle: "mine" (default) = created by me OR assigned to me.
  // "all" = everything I'm allowed to see (gated by briefs.read.any on the API).
  const canSeeAll = hasPermission("briefs.read.any");
  const [scope, setScope] = React.useState<"mine" | "all">(
    sp.get("scope") === "all" && canSeeAll ? "all" : "mine"
  );
  // "active" (default) = active only (templates excluded), "only" = templates,
  // "all" = both. Active-only matches the legacy view.
  const [templates, setTemplates] = React.useState<"active" | "only" | "all">(
    (sp.get("templates") as "only" | "all" | null) || "active"
  );
  const [page, setPage] = React.useState(parseInt(sp.get("page") || "1", 10));

  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const [data, setData] = React.useState<BriefsResp | null>(null);
  const [loading, setLoading] = React.useState(true);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    api<{ items: ProjectOption[] }>("/api/projects?limit=100")
      .then((r) => setProjects(r.items || []))
      .catch(() => setProjects([]));
  }, []);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status !== ANY) params.set("status", status);
    if (platform !== ANY) params.set("platform", platform);
    if (project !== ANY) params.set("project", project);
    if (scope === "all") params.set("scope", "all");
    if (templates === "only") params.set("templates", "only");
    else if (templates === "active") params.set("templates", "exclude");
    params.set("page", String(page));
    params.set("limit", "20");
    try {
      const res = await api<BriefsResp>(`/api/briefs?${params.toString()}`);
      setData(res);
      router.replace(`/briefs?${params.toString()}`, { scroll: false });
    } finally {
      setLoading(false);
    }
  }, [q, status, platform, project, scope, templates, page, router]);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchList, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchList]);

  function resetFilters() {
    setQ(""); setStatus(ANY); setPlatform(ANY); setProject(ANY); setScope("mine"); setTemplates("active"); setPage(1);
  }

  const hasActiveFilters = q || status !== ANY || platform !== ANY || project !== ANY || scope !== "mine" || templates !== "active";
  const canCreate = hasPermission("briefs.create");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Content Briefs"
        description="PM-authored briefs that producers create content against."
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/briefs/new"><Plus className="h-4 w-4" /> New Brief</Link>
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search title, goal, description…" className="pl-8" />
            </div>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any status</SelectItem>
                {BRIEF_STATUS.map((s) => (<SelectItem key={s} value={s}>{BRIEF_STATUS_LABELS[s]}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={platform} onValueChange={(v) => { setPlatform(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any platform</SelectItem>
                {PLATFORMS.map((p) => (<SelectItem key={p} value={p}>{PLATFORM_LABELS[p]}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={project} onValueChange={(v) => { setProject(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any project</SelectItem>
                {projects.map((p) => (<SelectItem key={p._id} value={p._id}>{p.projectName}</SelectItem>))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap items-center gap-2">
              {canSeeAll ? (
                <div className="inline-flex rounded-md border bg-background p-0.5" role="group" aria-label="Scope">
                  <Button
                    type="button"
                    size="sm"
                    variant={scope === "mine" ? "default" : "ghost"}
                    className="h-7 px-2.5"
                    onClick={() => { setScope("mine"); setPage(1); }}
                    disabled={!user}
                  >
                    Mine
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={scope === "all" ? "default" : "ghost"}
                    className="h-7 px-2.5"
                    onClick={() => { setScope("all"); setPage(1); }}
                  >
                    All
                  </Button>
                </div>
              ) : null}
              <Select value={templates} onValueChange={(v) => { setTemplates(v as "active" | "only" | "all"); setPage(1); }}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="only">Templates</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {hasActiveFilters ? (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={resetFilters}><X className="h-3.5 w-3.5" /> Clear filters</Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading && !data ? (
            <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !data || data.items.length === 0 ? (
            <EmptyState
              className="m-4"
              icon={<ClipboardList className="h-8 w-8" />}
              title="No briefs found"
              description={hasActiveFilters ? "Try clearing filters or changing search." : "Project managers can create briefs to delegate content production."}
              action={canCreate ? (<Button asChild><Link href="/briefs/new"><Plus className="h-4 w-4" />New Brief</Link></Button>) : null}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Platform</TableHead>
                  <TableHead className="hidden lg:table-cell">Project</TableHead>
                  <TableHead className="hidden lg:table-cell">Assigned to</TableHead>
                  <TableHead className="hidden xl:table-cell">Deadline / Next run</TableHead>
                  <TableHead className="hidden md:table-cell">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((b) => (
                  <TableRow key={b._id} className="cursor-pointer" onClick={() => router.push(`/briefs/${b._id}`)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2 max-w-[26ch] sm:max-w-[40ch]">
                        {b.isTemplate ? <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Recurring template" /> : null}
                        <span className="truncate">{b.title}</span>
                      </div>
                    </TableCell>
                    <TableCell><BriefStatusBadge status={b.status} /></TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{b.platform ? PLATFORM_LABELS[b.platform] : "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{b.project?.projectName || (b.isGeneralMarketing ? "General Marketing" : "—")}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{b.assignedTo ? `${b.assignedTo.firstName || ""} ${b.assignedTo.lastName || ""}`.trim() || b.assignedTo.email : "—"}</TableCell>
                    <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                      {b.isTemplate
                        ? (b.nextRunAt ? `Next: ${new Date(b.nextRunAt).toLocaleString()}` : "Paused")
                        : (b.deadline ? new Date(b.deadline).toLocaleDateString() : "—")}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{new Date(b.updatedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data ? (<Pagination page={data.page} total={data.total} limit={data.limit} onChange={setPage} />) : null}
    </div>
  );
}
