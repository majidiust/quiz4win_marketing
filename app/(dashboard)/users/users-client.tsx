"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search, Users as UsersIcon, Shield, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { api } from "@/lib/fetcher";
import { useUser } from "@/components/providers/user-provider";
import { USER_ROLES, USER_ROLE_LABELS, USER_STATUS, type UserRole, type UserStatus } from "@/lib/constants";

interface UserItem {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  mfaEnabled?: boolean;
  lastLoginAt?: string;
  assignedProjects?: Array<{ _id: string; projectName: string }>;
  createdAt: string;
}

interface ListResp { items: UserItem[]; total: number; page: number; limit: number }

const ANY = "__any__";
const LIMIT = 20;

const STATUS_VARIANT: Record<UserStatus, "success" | "muted" | "warning"> = {
  active: "success",
  disabled: "muted",
  pending: "warning",
};

export function UsersClient() {
  const { hasPermission } = useUser();
  const [q, setQ] = React.useState("");
  const [role, setRole] = React.useState<string>(ANY);
  const [status, setStatus] = React.useState<string>(ANY);
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<ListResp | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (q.trim()) qs.set("q", q.trim());
      if (role !== ANY) qs.set("role", role);
      if (status !== ANY) qs.set("status", status);
      const res = await api<ListResp>(`/api/users?${qs.toString()}`);
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [page, q, role, status]);

  React.useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        description="Team members, roles and project access"
        actions={
          hasPermission("users.create") ? (
            <Button asChild><Link href="/users/new"><Plus className="h-4 w-4" /> New user</Link></Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by name or email…" className="pl-9" />
        </div>
        <Select value={role} onValueChange={(v) => { setRole(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="All roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All roles</SelectItem>
            {USER_ROLES.map((r) => <SelectItem key={r} value={r}>{USER_ROLE_LABELS[r]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All statuses</SelectItem>
            {USER_STATUS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<UsersIcon className="h-8 w-8" />}
                title="No users found"
                description="Adjust filters or invite a new team member."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden lg:table-cell">Projects</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">MFA</TableHead>
                  <TableHead className="hidden lg:table-cell">Last login</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((u) => (
                  <TableRow key={u._id} className="cursor-pointer" onClick={() => (window.location.href = `/users/${u._id}`)}>
                    <TableCell className="font-medium">{u.firstName} {u.lastName}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{u.email}</TableCell>
                    <TableCell><Badge variant="outline">{USER_ROLE_LABELS[u.role]}</Badge></TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(u.assignedProjects || []).slice(0, 3).map((p) => <Badge key={p._id} variant="muted" className="text-[10px]">{p.projectName}</Badge>)}
                        {(u.assignedProjects || []).length > 3 ? <span className="text-[10px] text-muted-foreground">+{(u.assignedProjects || []).length - 3}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[u.status]} className="capitalize">{u.status}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell">
                      {u.mfaEnabled ? <Shield className="h-4 w-4 text-success" /> : <ShieldOff className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data ? <Pagination page={data.page} total={data.total} limit={data.limit} onChange={setPage} /> : null}
    </div>
  );
}
