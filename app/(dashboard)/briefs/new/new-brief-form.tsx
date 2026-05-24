"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/fetcher";
import { useUser } from "@/components/providers/user-provider";
import {
  CONTENT_TYPES, CONTENT_TYPE_LABELS, PLATFORMS, PLATFORM_LABELS, PRIORITIES,
  FUNNEL_STAGES, FUNNEL_STAGE_LABELS,
  RECURRENCE_FREQ, RECURRENCE_FREQ_LABELS, WEEKDAYS, WEEKDAY_LABELS,
  type ContentType, type FunnelStage, type Platform, type Priority,
  type RecurrenceFreq, type Weekday,
} from "@/lib/constants";

interface ProjectOption { _id: string; projectName: string }
interface UserOption { _id: string; firstName?: string; lastName?: string; email: string; role: string }

const NONE = "__none__";

export function NewBriefForm() {
  const router = useRouter();
  const { user } = useUser();
  const canPostGeneral = !!user && ["super_admin", "admin", "project_manager"].includes(user.role);

  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const [assignees, setAssignees] = React.useState<UserOption[]>([]);
  const [saving, setSaving] = React.useState(false);

  const [form, setForm] = React.useState({
    title: "",
    description: "",
    goal: "",
    project: NONE,
    isGeneralMarketing: false,
    platform: "" as Platform | "",
    contentType: "" as ContentType | "",
    funnelStage: "" as FunnelStage | "",
    priority: "normal" as Priority,
    language: "",
    targetCountry: "",
    targetAudience: "",
    suggestedHashtags: "",
    suggestedMentions: "",
    suggestedCTA: "",
    deadline: "",
    assignedTo: NONE,
    // Recurrence (template) section. When `recurring` is on, the brief is
    // saved as a template that spawns instances at each occurrence.
    recurring: false,
    recFreq: "weekly" as RecurrenceFreq,
    recInterval: 1,
    recByweekday: [] as Weekday[],
    recBymonthday: "" as string,
    recStartsAt: "",
    recEndsAt: "",
    recTimezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC",
    deadlineOffsetHours: "" as string,
  });

  React.useEffect(() => {
    api<{ items: ProjectOption[] }>("/api/projects?limit=200")
      .then((r) => setProjects(r.items || []))
      .catch(() => setProjects([]));
    // Producers + general roles that can hold a brief.
    api<{ items: UserOption[] }>("/api/users?limit=200")
      .then((r) => setAssignees((r.items || []).filter((u) => ["content_producer", "marketing_user", "project_manager"].includes(u.role))))
      .catch(() => setAssignees([]));
  }, []);

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function submit() {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (!form.isGeneralMarketing && form.project === NONE) {
      toast.error(canPostGeneral ? "Pick a project or mark as General Marketing" : "Pick a project");
      return;
    }
    if (form.recurring && !form.recStartsAt) {
      toast.error("Pick when the recurrence should start");
      return;
    }
    setSaving(true);
    try {
      const recurrence = form.recurring
        ? {
            freq: form.recFreq,
            interval: Math.max(1, Number(form.recInterval) || 1),
            byweekday: form.recFreq === "weekly" && form.recByweekday.length ? form.recByweekday : undefined,
            bymonthday: form.recFreq === "monthly" && form.recBymonthday ? Number(form.recBymonthday) : undefined,
            startsAt: new Date(form.recStartsAt).toISOString(),
            endsAt: form.recEndsAt ? new Date(form.recEndsAt).toISOString() : undefined,
            timezone: form.recTimezone || "UTC",
          }
        : undefined;
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        goal: form.goal.trim() || undefined,
        isGeneralMarketing: form.isGeneralMarketing,
        project: form.isGeneralMarketing ? undefined : form.project === NONE ? undefined : form.project,
        platform: form.platform || undefined,
        contentType: form.contentType || undefined,
        funnelStage: form.funnelStage || undefined,
        priority: form.priority,
        language: form.language || undefined,
        targetCountry: form.targetCountry || undefined,
        targetAudience: form.targetAudience || undefined,
        suggestedHashtags: form.suggestedHashtags
          ? form.suggestedHashtags.split(/[,\s]+/).map((s) => s.replace(/^#/, "")).filter(Boolean)
          : undefined,
        suggestedMentions: form.suggestedMentions
          ? form.suggestedMentions.split(/[,\s]+/).map((s) => s.replace(/^@/, "")).filter(Boolean)
          : undefined,
        suggestedCTA: form.suggestedCTA || undefined,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
        assignedTo: form.assignedTo === NONE ? undefined : form.assignedTo,
        isTemplate: form.recurring || undefined,
        recurrence,
        deadlineOffsetHours:
          form.recurring && form.deadlineOffsetHours ? Number(form.deadlineOffsetHours) : undefined,
      };
      const res = await api<{ id: string }>("/api/briefs", { json: payload });
      toast.success(form.recurring ? "Recurring template created" : "Brief created");
      router.replace(`/briefs/${res.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create brief");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="New Brief"
        description="Define what should be produced. Producers will create content against this brief."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/briefs"><ArrowLeft className="h-4 w-4" /> Back</Link>
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Create brief"}
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader><CardTitle>Basics</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="Quiz launch teaser for IG" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Context, background, brand voice…" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Goal</Label>
            <Textarea rows={2} value={form.goal} onChange={(e) => setField("goal", e.target.value)} placeholder="Drive 1k pre-registrations in the next 7 days." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Scope</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Project</Label>
            <Select value={form.project} onValueChange={(v) => setField("project", v)} disabled={form.isGeneralMarketing}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {projects.map((p) => (<SelectItem key={p._id} value={p._id}>{p.projectName}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          {canPostGeneral ? (
            <div className="flex items-end gap-2">
              <Checkbox id="gm" checked={form.isGeneralMarketing} onCheckedChange={(v) => setField("isGeneralMarketing", !!v)} />
              <Label htmlFor="gm" className="cursor-pointer">General Marketing (no specific project)</Label>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>Platform</Label>
            <Select value={form.platform || NONE} onValueChange={(v) => setField("platform", v === NONE ? "" : v as Platform)}>
              <SelectTrigger><SelectValue placeholder="Any platform" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {PLATFORMS.map((p) => (<SelectItem key={p} value={p}>{PLATFORM_LABELS[p]}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Content type</Label>
            <Select value={form.contentType || NONE} onValueChange={(v) => setField("contentType", v === NONE ? "" : v as ContentType)}>
              <SelectTrigger><SelectValue placeholder="Any type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {CONTENT_TYPES.map((t) => (<SelectItem key={t} value={t}>{CONTENT_TYPE_LABELS[t]}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Funnel stage</Label>
            <Select value={form.funnelStage || NONE} onValueChange={(v) => setField("funnelStage", v === NONE ? "" : v as FunnelStage)}>
              <SelectTrigger><SelectValue placeholder="Any stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {FUNNEL_STAGES.map((s) => (<SelectItem key={s} value={s}>{FUNNEL_STAGE_LABELS[s]}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={(v) => setField("priority", v as Priority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (<SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Targeting & suggestions</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Language (ISO 639)</Label>
            <Input value={form.language} onChange={(e) => setField("language", e.target.value)} placeholder="en, fa, ar" />
          </div>
          <div className="space-y-1.5">
            <Label>Target country</Label>
            <Input value={form.targetCountry} onChange={(e) => setField("targetCountry", e.target.value)} placeholder="US, IR…" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Target audience</Label>
            <Textarea rows={2} value={form.targetAudience} onChange={(e) => setField("targetAudience", e.target.value)} placeholder="18–34, mobile-first, trivia fans" />
          </div>
          <div className="space-y-1.5">
            <Label>Suggested hashtags</Label>
            <Input value={form.suggestedHashtags} onChange={(e) => setField("suggestedHashtags", e.target.value)} placeholder="#trivia #quiz" />
          </div>
          <div className="space-y-1.5">
            <Label>Suggested mentions</Label>
            <Input value={form.suggestedMentions} onChange={(e) => setField("suggestedMentions", e.target.value)} placeholder="@partner @talent" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Suggested CTA</Label>
            <Input value={form.suggestedCTA} onChange={(e) => setField("suggestedCTA", e.target.value)} placeholder="Tap to play now" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Assignment & deadline</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Assign to</Label>
            <Select value={form.assignedTo} onValueChange={(v) => setField("assignedTo", v)}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {assignees.map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {`${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email} · {u.role.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Deadline</Label>
            <Input type="datetime-local" value={form.deadline} onChange={(e) => setField("deadline", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Repeat</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox id="rec" checked={form.recurring} onCheckedChange={(v) => setField("recurring", !!v)} />
            <Label htmlFor="rec" className="cursor-pointer">
              Repeat this brief on a schedule (creates a template that spawns new briefs)
            </Label>
          </div>
          {form.recurring ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select value={form.recFreq} onValueChange={(v) => setField("recFreq", v as RecurrenceFreq)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_FREQ.map((f) => (
                      <SelectItem key={f} value={f}>{RECURRENCE_FREQ_LABELS[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Every</Label>
                <Input type="number" min={1} max={365} value={form.recInterval}
                  onChange={(e) => setField("recInterval", Math.max(1, Number(e.target.value) || 1))} />
              </div>
              {form.recFreq === "weekly" ? (
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>On weekdays</Label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((d) => {
                      const active = form.recByweekday.includes(d);
                      return (
                        <button key={d} type="button"
                          onClick={() => setField("recByweekday", active ? form.recByweekday.filter((x) => x !== d) : [...form.recByweekday, d])}
                          className={`rounded-md border px-3 py-1 text-sm ${active ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>
                          {WEEKDAY_LABELS[d]}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">Leave empty to repeat on the same weekday as the start date.</p>
                </div>
              ) : null}
              {form.recFreq === "monthly" ? (
                <div className="space-y-1.5">
                  <Label>Day of month</Label>
                  <Input type="number" min={1} max={31} value={form.recBymonthday}
                    onChange={(e) => setField("recBymonthday", e.target.value)}
                    placeholder="Default: start day" />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label>Starts at *</Label>
                <Input type="datetime-local" value={form.recStartsAt} onChange={(e) => setField("recStartsAt", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Ends at</Label>
                <Input type="datetime-local" value={form.recEndsAt} onChange={(e) => setField("recEndsAt", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <Input value={form.recTimezone} onChange={(e) => setField("recTimezone", e.target.value)} placeholder="Asia/Tehran" />
              </div>
              <div className="space-y-1.5">
                <Label>Deadline per instance (hours after spawn)</Label>
                <Input type="number" min={0} value={form.deadlineOffsetHours}
                  onChange={(e) => setField("deadlineOffsetHours", e.target.value)}
                  placeholder="e.g. 24" />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
