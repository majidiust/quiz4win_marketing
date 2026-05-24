"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { FolderKanban, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { api } from "@/lib/fetcher";
import { useUser } from "@/components/providers/user-provider";

interface ProjectItem {
  _id: string;
  projectName: string;
  slug: string;
  description?: string;
  logo?: string;
  isActive: boolean;
  isGeneralMarketing?: boolean;
  brandColors?: { primary?: string; secondary?: string; accent?: string };
  defaultHashtags?: string[];
  updatedAt: string;
}

interface ListResp { items: ProjectItem[]; total: number; page: number; limit: number }

const LIMIT = 12;

export function ProjectsClient() {
  const { hasPermission } = useUser();
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("active");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<ListResp | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT), status });
      if (q.trim()) qs.set("q", q.trim());
      const res = await api<ListResp>(`/api/projects?${qs.toString()}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page, status, q]);

  React.useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Projects"
        description="Brands and campaigns served by the marketing team"
        actions={
          hasPermission("projects.create") ? (
            <Button asChild><Link href="/projects/new"><Plus className="h-4 w-4" /> New project</Link></Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search projects…" className="pl-9" />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-8 w-8" />}
          title="No projects yet"
          description="Create your first project to start organizing brand assets and campaigns."
          action={hasPermission("projects.create") ? (
            <Button asChild><Link href="/projects/new"><Plus className="h-4 w-4" /> New project</Link></Button>
          ) : null}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((p) => (
              <Link key={p._id} href={`/projects/${p._id}`}>
                <Card className="h-full transition-colors hover:border-primary/40 hover:shadow-md">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted text-sm font-semibold uppercase" style={{ background: p.brandColors?.primary ? `${p.brandColors.primary}22` : undefined, color: p.brandColors?.primary }}>
                        {p.logo ? (
                          <Image src={p.logo} alt={p.projectName} width={48} height={48} className="h-full w-full object-cover" unoptimized />
                        ) : (
                          <span>{p.projectName.slice(0, 2)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-semibold">{p.projectName}</h3>
                          {p.isGeneralMarketing ? <Badge variant="info">General</Badge> : null}
                          {!p.isActive ? <Badge variant="muted">Inactive</Badge> : null}
                        </div>
                        <p className="text-xs text-muted-foreground">/{p.slug}</p>
                      </div>
                    </div>
                    {p.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p> : null}
                    <div className="flex flex-wrap gap-1.5">
                      {(p.defaultHashtags || []).slice(0, 4).map((h) => (
                        <span key={h} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">#{h}</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <Pagination page={data.page} total={data.total} limit={data.limit} onChange={setPage} />
        </>
      )}
    </div>
  );
}
