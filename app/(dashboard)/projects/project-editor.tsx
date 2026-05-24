"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/fetcher";
import { useUser } from "@/components/providers/user-provider";

interface ProjectDoc {
  _id: string;
  projectName: string;
  slug: string;
  description?: string;
  logo?: string;
  brandColors?: { primary?: string; secondary?: string; accent?: string; neutral?: string };
  typography?: { headingFont?: string; bodyFont?: string; notes?: string };
  defaultHashtags?: string[];
  defaultCTA?: string;
  targetLanguages?: string[];
  targetCountries?: string[];
  contentGuidelines?: string;
  complianceNotes?: string;
  isActive: boolean;
  isGeneralMarketing?: boolean;
}

export function ProjectEditor({ mode, id }: { mode: "create" | "edit"; id?: string }) {
  const router = useRouter();
  const { hasPermission } = useUser();
  // Only roles holding projects.create / projects.update may submit the form.
  // For other roles the page renders as a read-only inspector.
  const canMutate = hasPermission(mode === "create" ? "projects.create" : "projects.update");
  const [loading, setLoading] = React.useState(mode === "edit");
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    projectName: "",
    slug: "",
    description: "",
    logo: "",
    primary: "#6366f1",
    secondary: "#0ea5e9",
    accent: "#f59e0b",
    neutral: "#0f172a",
    headingFont: "",
    bodyFont: "",
    typographyNotes: "",
    defaultHashtags: "",
    defaultCTA: "",
    targetLanguages: "",
    targetCountries: "",
    contentGuidelines: "",
    complianceNotes: "",
    isActive: true,
    isGeneralMarketing: false,
  });

  React.useEffect(() => {
    if (mode !== "edit" || !id) return;
    setLoading(true);
    api<{ project: ProjectDoc }>(`/api/projects/${id}`)
      .then((r) => {
        const p = r.project;
        setForm({
          projectName: p.projectName || "",
          slug: p.slug || "",
          description: p.description || "",
          logo: p.logo || "",
          primary: p.brandColors?.primary || "#6366f1",
          secondary: p.brandColors?.secondary || "#0ea5e9",
          accent: p.brandColors?.accent || "#f59e0b",
          neutral: p.brandColors?.neutral || "#0f172a",
          headingFont: p.typography?.headingFont || "",
          bodyFont: p.typography?.bodyFont || "",
          typographyNotes: p.typography?.notes || "",
          defaultHashtags: (p.defaultHashtags || []).join(" "),
          defaultCTA: p.defaultCTA || "",
          targetLanguages: (p.targetLanguages || []).join(", "),
          targetCountries: (p.targetCountries || []).join(", "),
          contentGuidelines: p.contentGuidelines || "",
          complianceNotes: p.complianceNotes || "",
          isActive: p.isActive,
          isGeneralMarketing: !!p.isGeneralMarketing,
        });
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [mode, id]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.projectName.trim()) {
      toast.error("Project name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        projectName: form.projectName.trim(),
        slug: form.slug.trim() || undefined,
        description: form.description.trim() || undefined,
        logo: form.logo.trim() || undefined,
        brandColors: { primary: form.primary, secondary: form.secondary, accent: form.accent, neutral: form.neutral },
        typography: { headingFont: form.headingFont, bodyFont: form.bodyFont, notes: form.typographyNotes },
        defaultHashtags: form.defaultHashtags ? form.defaultHashtags.split(/[,\s]+/).map((s) => s.replace(/^#/, "")).filter(Boolean) : [],
        defaultCTA: form.defaultCTA || undefined,
        targetLanguages: form.targetLanguages ? form.targetLanguages.split(/[,\s]+/).filter(Boolean) : [],
        targetCountries: form.targetCountries ? form.targetCountries.split(/[,\s]+/).filter(Boolean) : [],
        contentGuidelines: form.contentGuidelines || undefined,
        complianceNotes: form.complianceNotes || undefined,
        isActive: form.isActive,
        isGeneralMarketing: form.isGeneralMarketing,
      };
      if (mode === "create") {
        const res = await api<{ id: string }>("/api/projects", { json: payload });
        toast.success("Project created");
        router.replace(`/projects/${res.id}`);
      } else {
        await api(`/api/projects/${id}`, { method: "PATCH", json: payload });
        toast.success("Saved");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!id) return;
    if (!confirm("Deactivate this project? It will be marked inactive (soft delete).")) return;
    try {
      await api(`/api/projects/${id}`, { method: "DELETE" });
      toast.success("Project deactivated");
      router.replace("/projects");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
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

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <PageHeader
        title={mode === "create" ? "New Project" : form.projectName || "Project"}
        description={mode === "create" ? "Set up a new brand or campaign workspace." : "Edit project details, brand assets and defaults."}
        actions={
          <>
            <Button type="button" variant="outline" asChild><Link href="/projects"><ArrowLeft className="h-4 w-4" /> Back</Link></Button>
            {mode === "edit" && hasPermission("projects.delete") ? (
              <Button type="button" variant="ghost" onClick={onDelete} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-4 w-4" /> Deactivate
              </Button>
            ) : null}
            {canMutate ? (
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving…" : "Save"}
              </Button>
            ) : null}
          </>
        }
      />
      {mode === "edit" && !canMutate ? (
        <p className="text-sm text-muted-foreground">
          Read-only view. Only super admins can change project settings.
        </p>
      ) : null}

      <fieldset disabled={!canMutate} className="contents">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle>Basics</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Project name" required><Input value={form.projectName} onChange={(e) => set("projectName", e.target.value)} /></Field>
              <Field label="Slug" hint="Auto-generated if left blank"><Input value={form.slug} onChange={(e) => set("slug", e.target.value)} disabled={mode === "edit"} /></Field>
            </div>
            <Field label="Description"><Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
            <Field label="Logo URL"><Input value={form.logo} onChange={(e) => set("logo", e.target.value)} placeholder="https://…" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>Active</span>
                <Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} />
              </label>
              <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>General Marketing</span>
                <Switch checked={form.isGeneralMarketing} onCheckedChange={(v) => set("isGeneralMarketing", v)} />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle>Brand colors</CardTitle><CardDescription>Used across previews and calendar chips</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <ColorField label="Primary" value={form.primary} onChange={(v) => set("primary", v)} />
            <ColorField label="Secondary" value={form.secondary} onChange={(v) => set("secondary", v)} />
            <ColorField label="Accent" value={form.accent} onChange={(v) => set("accent", v)} />
            <ColorField label="Neutral" value={form.neutral} onChange={(v) => set("neutral", v)} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle>Defaults &amp; targeting</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Default hashtags" hint="Space or comma separated"><Input value={form.defaultHashtags} onChange={(e) => set("defaultHashtags", e.target.value)} placeholder="#brand #launch" /></Field>
            <Field label="Default CTA"><Input value={form.defaultCTA} onChange={(e) => set("defaultCTA", e.target.value)} placeholder="Learn more" /></Field>
            <Field label="Target languages" hint="Comma separated ISO codes"><Input value={form.targetLanguages} onChange={(e) => set("targetLanguages", e.target.value)} placeholder="en, es, pt" /></Field>
            <Field label="Target countries" hint="Comma separated ISO codes"><Input value={form.targetCountries} onChange={(e) => set("targetCountries", e.target.value)} placeholder="US, BR, ES" /></Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle>Typography</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Heading font"><Input value={form.headingFont} onChange={(e) => set("headingFont", e.target.value)} placeholder="Inter, Geist…" /></Field>
            <Field label="Body font"><Input value={form.bodyFont} onChange={(e) => set("bodyFont", e.target.value)} /></Field>
            <Field label="Notes"><Textarea rows={2} value={form.typographyNotes} onChange={(e) => set("typographyNotes", e.target.value)} /></Field>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-3"><CardTitle>Guidelines &amp; compliance</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Content guidelines"><Textarea rows={5} value={form.contentGuidelines} onChange={(e) => set("contentGuidelines", e.target.value)} placeholder="Voice, tone, do's & don'ts…" /></Field>
            <Field label="Compliance notes"><Textarea rows={5} value={form.complianceNotes} onChange={(e) => set("complianceNotes", e.target.value)} placeholder="Legal disclaimers, region-specific rules…" /></Field>
          </CardContent>
        </Card>
      </div>
      </fieldset>
    </form>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}{required ? <span className="ml-0.5 text-destructive">*</span> : null}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-9 cursor-pointer rounded border bg-transparent" />
      <div className="flex-1">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}
