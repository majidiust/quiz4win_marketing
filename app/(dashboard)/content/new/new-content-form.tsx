"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/fetcher";
import { useUser } from "@/components/providers/user-provider";
import { CONTENT_TYPES, CONTENT_TYPE_LABELS, PLATFORMS, PLATFORM_LABELS, PRIORITIES, type ContentType, type Platform, type Priority } from "@/lib/constants";

interface ProjectOption {
  _id: string;
  projectName: string;
  isGeneralMarketing?: boolean;
  defaultHashtags?: string[];
  defaultCTA?: string;
}

const NONE = "__none__";

export function NewContentForm() {
  const router = useRouter();
  const { user } = useUser();
  // Only org-level roles may file content under General Marketing.
  const canPostGeneral = !!user && ["super_admin", "admin", "project_manager"].includes(user.role);
  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const [projectsLoading, setProjectsLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  const [form, setForm] = React.useState({
    title: "",
    description: "",
    project: NONE,
    isGeneralMarketing: false,
    contentType: "instagram_post" as ContentType,
    platform: "instagram" as Platform,
    priority: "normal" as Priority,
    caption: "",
    hashtags: "",
    cta: "",
    targetUrl: "",
    language: "",
    targetCountry: "",
    campaignName: "",
    publishDate: "",
  });

  React.useEffect(() => {
    api<{ items: ProjectOption[] }>("/api/projects?limit=100&includeGeneral=false")
      .then((r) => setProjects(r.items || []))
      .catch(() => setProjects([]))
      .finally(() => setProjectsLoading(false));
  }, []);

  // Projects the user can actually post into (excludes the General Marketing
  // project; that has its own dedicated toggle).
  const selectableProjects = React.useMemo(
    () => projects.filter((p) => !p.isGeneralMarketing),
    [projects],
  );

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (form.project === NONE && !form.isGeneralMarketing) {
      toast.error(canPostGeneral
        ? "Select a project or mark as General Marketing"
        : "Select a project");
      return;
    }
    if (form.isGeneralMarketing && !canPostGeneral) {
      toast.error("You are not allowed to create General Marketing content");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        contentType: form.contentType,
        platform: form.platform,
        priority: form.priority,
        caption: form.caption || undefined,
        hashtags: form.hashtags ? form.hashtags.split(/[,\s]+/).map((s) => s.replace(/^#/, "")).filter(Boolean) : undefined,
        cta: form.cta || undefined,
        targetUrl: form.targetUrl || undefined,
        language: form.language || undefined,
        targetCountry: form.targetCountry || undefined,
        campaignName: form.campaignName || undefined,
        publishDate: form.publishDate ? new Date(form.publishDate).toISOString() : undefined,
        isGeneralMarketing: form.isGeneralMarketing,
        project: form.isGeneralMarketing ? undefined : form.project === NONE ? undefined : form.project,
      };
      const res = await api<{ id: string }>("/api/content", { json: payload });
      toast.success("Content draft created");
      router.replace(`/content/${res.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <PageHeader
        title="New Content"
        description="Create a content draft. You can fill in additional details after creation."
        actions={
          <>
            <Button type="button" variant="outline" asChild>
              <Link href="/content"><ArrowLeft className="h-4 w-4" /> Back</Link>
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? "Creating…" : "Create draft"}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-4 p-5">
            <Field label="Title" required>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Compelling, clear headline" />
            </Field>
            <Field label="Short description">
              <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional internal description / brief" />
            </Field>
            <Field label="Caption / body">
              <Textarea rows={4} value={form.caption} onChange={(e) => set("caption", e.target.value)} placeholder="Main caption or body copy" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Hashtags" hint="Comma or space separated">
                <Input value={form.hashtags} onChange={(e) => set("hashtags", e.target.value)} placeholder="#brand #campaign" />
              </Field>
              <Field label="CTA">
                <Input value={form.cta} onChange={(e) => set("cta", e.target.value)} placeholder="Shop now, Learn more…" />
              </Field>
            </div>
            <Field label="Target URL">
              <Input value={form.targetUrl} onChange={(e) => set("targetUrl", e.target.value)} placeholder="https://…" />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <Field
              label="Project"
              required
              hint={
                projectsLoading
                  ? "Loading projects…"
                  : selectableProjects.length === 0 && !canPostGeneral
                    ? "You have not been assigned to any projects. Ask an administrator to grant project access."
                    : "Choose the project this content belongs to. You only see projects you are assigned to."
              }
            >
              <div className="space-y-2">
                <Select
                  value={form.project}
                  onValueChange={(v) => { set("project", v); if (v !== NONE) set("isGeneralMarketing", false); }}
                  disabled={form.isGeneralMarketing || projectsLoading || selectableProjects.length === 0}
                >
                  <SelectTrigger><SelectValue placeholder={selectableProjects.length === 0 ? "No projects available" : "Select project"} /></SelectTrigger>
                  <SelectContent>
                    {selectableProjects.map((p) => (
                      <SelectItem key={p._id} value={p._id}>{p.projectName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {canPostGeneral ? (
                  <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>General marketing</span>
                    <Switch checked={form.isGeneralMarketing} onCheckedChange={(v) => { set("isGeneralMarketing", v); if (v) set("project", NONE); }} />
                  </label>
                ) : null}
              </div>
            </Field>
            <Field label="Content type">
              <Select value={form.contentType} onValueChange={(v) => set("contentType", v as ContentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((t) => <SelectItem key={t} value={t}>{CONTENT_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Platform">
              <Select value={form.platform} onValueChange={(v) => set("platform", v as Platform)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{PLATFORM_LABELS[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onValueChange={(v) => set("priority", v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Planned publish date">
              <Input type="datetime-local" value={form.publishDate} onChange={(e) => set("publishDate", e.target.value)} />
            </Field>
            <div className="grid gap-4 grid-cols-2">
              <Field label="Language"><Input value={form.language} onChange={(e) => set("language", e.target.value)} placeholder="en, es…" /></Field>
              <Field label="Country"><Input value={form.targetCountry} onChange={(e) => set("targetCountry", e.target.value)} placeholder="US, BR…" /></Field>
            </div>
            <Field label="Campaign name"><Input value={form.campaignName} onChange={(e) => set("campaignName", e.target.value)} placeholder="Optional" /></Field>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required ? <span className="ml-0.5 text-destructive">*</span> : null}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
