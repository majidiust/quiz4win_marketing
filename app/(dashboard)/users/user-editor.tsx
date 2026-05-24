"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, ShieldOff, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/fetcher";
import { useUser } from "@/components/providers/user-provider";
import { USER_ROLES, USER_ROLE_LABELS, USER_STATUS, type UserRole, type UserStatus } from "@/lib/constants";

interface ProjectOption { _id: string; projectName: string }
interface UserDoc {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  mfaEnabled?: boolean;
  profileImage?: string;
  assignedProjects?: Array<{ _id: string; projectName: string } | string>;
  lastLoginAt?: string;
  createdAt: string;
}

export function UserEditor({ mode, id }: { mode: "create" | "edit"; id?: string }) {
  const router = useRouter();
  const { user: me, hasPermission } = useUser();
  const [loading, setLoading] = React.useState(mode === "edit");
  const [saving, setSaving] = React.useState(false);
  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const [doc, setDoc] = React.useState<UserDoc | null>(null);
  const [form, setForm] = React.useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "marketing_user" as UserRole,
    status: "active" as UserStatus,
    password: "",
    profileImage: "",
    assignedProjects: [] as string[],
  });

  React.useEffect(() => {
    api<{ items: ProjectOption[] }>("/api/projects?limit=200").then((r) => setProjects(r.items || [])).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (mode !== "edit" || !id) return;
    setLoading(true);
    api<{ user: UserDoc }>(`/api/users/${id}`)
      .then((r) => {
        const u = r.user;
        setDoc(u);
        setForm({
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          role: u.role,
          status: u.status,
          password: "",
          profileImage: u.profileImage || "",
          assignedProjects: (u.assignedProjects || []).map((p) => (typeof p === "string" ? p : p._id)),
        });
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [mode, id]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleProject(pid: string) {
    setForm((f) => ({
      ...f,
      assignedProjects: f.assignedProjects.includes(pid)
        ? f.assignedProjects.filter((x) => x !== pid)
        : [...f.assignedProjects, pid],
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (mode === "create") {
        if (!form.password || form.password.length < 8) {
          toast.error("Password must be at least 8 characters");
          setSaving(false);
          return;
        }
        const res = await api<{ id: string }>("/api/users", {
          json: {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim().toLowerCase(),
            password: form.password,
            role: form.role,
            status: form.status,
            assignedProjects: form.assignedProjects,
          },
        });
        toast.success("User created");
        router.replace(`/users/${res.id}`);
      } else {
        await api(`/api/users/${id}`, {
          method: "PATCH",
          json: {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            role: form.role,
            status: form.status,
            assignedProjects: form.assignedProjects,
            profileImage: form.profileImage || "",
            ...(form.password ? { password: form.password } : {}),
          },
        });
        toast.success("Saved");
        setForm((f) => ({ ...f, password: "" }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDisable() {
    if (!id) return;
    if (!confirm("Disable this user? They will be signed out from all sessions.")) return;
    try {
      await api(`/api/users/${id}`, { method: "DELETE" });
      toast.success("User disabled");
      router.replace("/users");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const isSelf = mode === "edit" && me?.id === id;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <PageHeader
        title={mode === "create" ? "New User" : `${form.firstName} ${form.lastName}`.trim() || "User"}
        description={mode === "create" ? "Invite a teammate with a role and project access." : form.email}
        actions={
          <>
            <Button type="button" variant="outline" asChild><Link href="/users"><ArrowLeft className="h-4 w-4" /> Back</Link></Button>
            {mode === "edit" && hasPermission("users.disable") && !isSelf && doc?.status !== "disabled" ? (
              <Button type="button" variant="ghost" onClick={onDisable} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                <ShieldOff className="h-4 w-4" /> Disable
              </Button>
            ) : null}
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" required><Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required /></Field>
              <Field label="Last name" required><Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required /></Field>
              <Field label="Email" required>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} disabled={mode === "edit"} required />
              </Field>
              <Field label="Profile image URL"><Input value={form.profileImage} onChange={(e) => set("profileImage", e.target.value)} placeholder="https://…" /></Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle>Access</CardTitle><CardDescription>Role and account status</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Role">
              <Select value={form.role} onValueChange={(v) => set("role", v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{USER_ROLES.map((r) => <SelectItem key={r} value={r}>{USER_ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => set("status", v as UserStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{USER_STATUS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            {mode === "edit" && doc ? (
              <div className="space-y-1.5 rounded-md border p-3 text-xs">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">MFA</span>{doc.mfaEnabled ? <Badge variant="success">Enabled</Badge> : <Badge variant="muted">Disabled</Badge>}</div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Last login</span><span>{doc.lastLoginAt ? new Date(doc.lastLoginAt).toLocaleString() : "—"}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Joined</span><span>{new Date(doc.createdAt).toLocaleDateString()}</span></div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle>Assigned projects</CardTitle><CardDescription>The user can only access content for these projects (plus General Marketing)</CardDescription></CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <p className="text-xs text-muted-foreground">No projects available.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {projects.map((p) => {
                  const checked = form.assignedProjects.includes(p._id);
                  return (
                    <label key={p._id} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/40">
                      <input type="checkbox" checked={checked} onChange={() => toggleProject(p._id)} className="h-4 w-4 rounded border-input" />
                      <span className="truncate">{p.projectName}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle><KeyRound className="inline h-4 w-4 mr-1" /> Password</CardTitle><CardDescription>{mode === "create" ? "Set the initial password" : "Leave blank to keep current password"}</CardDescription></CardHeader>
          <CardContent>
            <Field label={mode === "create" ? "Password" : "New password"} required={mode === "create"}>
              <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder={mode === "edit" ? "Leave blank to keep current" : ""} minLength={mode === "create" ? 8 : undefined} />
            </Field>
            {mode === "edit" ? <p className="mt-2 text-[11px] text-muted-foreground">Changing the password will sign the user out from all sessions.</p> : null}
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}{required ? <span className="ml-0.5 text-destructive">*</span> : null}</Label>
      {children}
    </div>
  );
}
