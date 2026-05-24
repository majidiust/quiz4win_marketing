"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { api } from "@/lib/fetcher";
import { useUser } from "@/components/providers/user-provider";
import { CONTENT_STATUS, CONTENT_STATUS_LABELS, PLATFORMS, PLATFORM_LABELS, CONTENT_TYPES, CONTENT_TYPE_LABELS, type ContentStatus, type Platform, type ContentType } from "@/lib/constants";

interface ContentListItem {
  _id: string;
  title: string;
  status: ContentStatus;
  platform: Platform;
  contentType: ContentType;
  campaignName?: string;
  publishDate?: string;
  updatedAt: string;
  isGeneralMarketing?: boolean;
  project?: { projectName?: string; slug?: string; isGeneralMarketing?: boolean };
  createdBy?: { firstName?: string; lastName?: string; email?: string };
}

interface ContentResp {
  items: ContentListItem[];
  total: number;
  page: number;
  limit: number;
}

interface ProjectOption { _id: string; projectName: string }

const ANY = "__any__";

export function ContentLibraryClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const { hasPermission, user } = useUser();

  const [q, setQ] = React.useState(sp.get("q") || "");
  const [status, setStatus] = React.useState(sp.get("status") || ANY);
  const [platform, setPlatform] = React.useState(sp.get("platform") || ANY);
  const [contentType, setContentType] = React.useState(sp.get("contentType") || ANY);
  const [project, setProject] = React.useState(sp.get("project") || ANY);
  // Scope: "mine" = created by or assigned to the user. "all" = everything
  // the user is allowed to see (gated by content.read.any). Default is
  // "mine" for everyone except super_admin, who defaults to "all".
  const canSeeAll = hasPermission("content.read.any");
  const defaultScope: "mine" | "all" = user?.role === "super_admin" ? "all" : "mine";
  const [scope, setScope] = React.useState<"mine" | "all">(
    sp.get("scope") === "all" && canSeeAll
      ? "all"
      : sp.get("scope") === "mine"
      ? "mine"
      : defaultScope
  );
  const [page, setPage] = React.useState(parseInt(sp.get("page") || "1", 10));

  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const [data, setData] = React.useState<ContentResp | null>(null);
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
    if (contentType !== ANY) params.set("contentType", contentType);
    if (project !== ANY) params.set("project", project);
    if (scope === "all") params.set("scope", "all");
    params.set("page", String(page));
    params.set("limit", "20");
    try {
      const res = await api<ContentResp>(`/api/content?${params.toString()}`);
      setData(res);
      // Reflect in URL
      router.replace(`/content?${params.toString()}`, { scroll: false });
    } finally {
      setLoading(false);
    }
  }, [q, status, platform, contentType, project, scope, page, router]);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchList, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchList]);

  function resetFilters() {
    setQ("");
    setStatus(ANY);
    setPlatform(ANY);
    setContentType(ANY);
    setProject(ANY);
    setScope(defaultScope);
    setPage(1);
  }

  const hasActiveFilters = q || status !== ANY || platform !== ANY || contentType !== ANY || project !== ANY || scope !== defaultScope;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Content Library"
        description="All content across projects with full filtering and search."
        actions={
          hasPermission("content.create") ? (
            <Button asChild>
              <Link href="/content/new"><Plus className="h-4 w-4" /> New Content</Link>
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                placeholder="Search title, caption, campaign…"
                className="pl-8"
              />
            </div>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any status</SelectItem>
                {CONTENT_STATUS.map((s) => (
                  <SelectItem key={s} value={s}>{CONTENT_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={platform} onValueChange={(v) => { setPlatform(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any platform</SelectItem>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>{PLATFORM_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={contentType} onValueChange={(v) => { setContentType(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any type</SelectItem>
                {CONTENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{CONTENT_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={project} onValueChange={(v) => { setProject(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p._id} value={p._id}>{p.projectName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {canSeeAll ? (
              <div className="inline-flex rounded-md border bg-background p-0.5" role="group" aria-label="Scope">
                <Button
                  type="button"
                  size="sm"
                  variant={scope === "mine" ? "default" : "ghost"}
                  className="h-7 px-2.5"
                  onClick={() => { setScope("mine"); setPage(1); }}
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
            ) : <span />}
            {hasActiveFilters ? (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <X className="h-3.5 w-3.5" /> Clear filters
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading && !data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !data || data.items.length === 0 ? (
            <EmptyState
              className="m-4"
              icon={<FileText className="h-8 w-8" />}
              title="No content found"
              description={hasActiveFilters ? "Try clearing filters or changing search." : "Create your first piece of content to get started."}
              action={
                hasPermission("content.create") ? (
                  <Button asChild><Link href="/content/new"><Plus className="h-4 w-4" />New Content</Link></Button>
                ) : null
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Platform</TableHead>
                  <TableHead className="hidden lg:table-cell">Project</TableHead>
                  <TableHead className="hidden lg:table-cell">Author</TableHead>
                  <TableHead className="hidden xl:table-cell">Publish</TableHead>
                  <TableHead className="hidden md:table-cell">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((c) => (
                  <TableRow key={c._id} className="cursor-pointer" onClick={() => router.push(`/content/${c._id}`)}>
                    <TableCell className="font-medium">
                      <div className="max-w-[26ch] truncate sm:max-w-[40ch]">{c.title}</div>
                      <div className="text-xs text-muted-foreground">{CONTENT_TYPE_LABELS[c.contentType] || c.contentType}</div>
                    </TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{PLATFORM_LABELS[c.platform] || c.platform}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{c.project?.projectName || (c.isGeneralMarketing ? "General Marketing" : "—")}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {c.createdBy ? `${c.createdBy.firstName || ""} ${c.createdBy.lastName || ""}`.trim() || c.createdBy.email : "—"}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">{c.publishDate ? new Date(c.publishDate).toLocaleString() : "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{new Date(c.updatedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data ? (
        <Pagination page={data.page} total={data.total} limit={data.limit} onChange={setPage} />
      ) : null}
    </div>
  );
}
