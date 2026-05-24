"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/fetcher";
import { useUser } from "@/components/providers/user-provider";
import { cn } from "@/lib/utils";
import { StepBasics } from "./wizard/step-basics";
import { StepCopy } from "./wizard/step-copy";
import { StepMedia } from "./wizard/step-media";
import { StepTargeting } from "./wizard/step-targeting";
import { NONE, type ProjectOption, type WizardState } from "./wizard/types";
import type { BriefStatus, ContentType, FunnelStage, Platform } from "@/lib/constants";

interface BriefPrefill {
  _id: string;
  title: string;
  status: BriefStatus;
  goal?: string;
  description?: string;
  platform?: Platform;
  contentType?: ContentType;
  funnelStage?: FunnelStage;
  language?: string;
  targetCountry?: string;
  targetAudience?: string;
  suggestedHashtags?: string[];
  suggestedCTA?: string;
  deadline?: string;
  isGeneralMarketing?: boolean;
  project?: { _id: string };
}

const STEPS = [
  { key: "basics", label: "Basics", description: "Title, project, format" },
  { key: "copy", label: "Copy", description: "Caption, hashtags, CTA" },
  { key: "media", label: "Media", description: "Upload assets" },
  { key: "targeting", label: "Targeting", description: "Audience and schedule" },
] as const;

export function NewContentForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const briefId = sp.get("briefId") || "";
  const { user } = useUser();
  // Only org-level roles may file content under General Marketing.
  const canPostGeneral = !!user && ["super_admin", "admin", "project_manager"].includes(user.role);
  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const [projectsLoading, setProjectsLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [brief, setBrief] = React.useState<BriefPrefill | null>(null);

  const [state, setState] = React.useState<WizardState>({
    title: "",
    description: "",
    project: NONE,
    isGeneralMarketing: false,
    contentType: "instagram_post",
    platform: "instagram",
    priority: "normal",
    funnelStage: "",
    caption: "",
    shortCaption: "",
    hashtags: "",
    cta: "",
    targetUrl: "",
    language: "",
    targetCountry: "",
    targetAudience: "",
    campaignName: "",
    campaignGoal: "",
    publishDate: "",
    media: [],
  });

  React.useEffect(() => {
    api<{ items: ProjectOption[] }>("/api/projects?limit=100&includeGeneral=false")
      .then((r) => setProjects(r.items || []))
      .catch(() => setProjects([]))
      .finally(() => setProjectsLoading(false));
  }, []);

  // When started from /briefs/[id], pre-fill the wizard with the brief's
  // metadata so the producer doesn't have to retype targeting and platform.
  React.useEffect(() => {
    if (!briefId) return;
    api<{ brief: BriefPrefill }>(`/api/briefs/${briefId}`)
      .then(({ brief: b }) => {
        setBrief(b);
        setState((s) => ({
          ...s,
          title: s.title || b.title,
          description: s.description || b.description || "",
          contentType: (b.contentType as WizardState["contentType"]) || s.contentType,
          platform: (b.platform as WizardState["platform"]) || s.platform,
          funnelStage: (b.funnelStage as WizardState["funnelStage"]) || s.funnelStage,
          language: s.language || b.language || "",
          targetCountry: s.targetCountry || b.targetCountry || "",
          targetAudience: s.targetAudience || b.targetAudience || "",
          cta: s.cta || b.suggestedCTA || "",
          hashtags: s.hashtags || (b.suggestedHashtags?.length ? b.suggestedHashtags.map((h) => `#${h}`).join(" ") : ""),
          isGeneralMarketing: !!b.isGeneralMarketing,
          project: b.project?._id || s.project,
          publishDate: s.publishDate || (b.deadline ? new Date(b.deadline).toISOString().slice(0, 16) : ""),
        }));
      })
      .catch(() => toast.error("Could not load brief — starting blank"));
  }, [briefId]);

  const set = React.useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  }, []);

  // Per-step validation gating the Next / Submit buttons. Keeps the user
  // honest without showing destructive toasts on every keystroke.
  function validateStep(idx: number): string | null {
    if (idx === 0) {
      if (!state.title.trim()) return "Title is required";
      if (state.project === NONE && !state.isGeneralMarketing) {
        return canPostGeneral ? "Select a project or mark as General Marketing" : "Select a project";
      }
      if (state.isGeneralMarketing && !canPostGeneral) return "You are not allowed to create General Marketing content";
      if (!state.funnelStage) return "Pick a funnel stage";
    }
    return null;
  }

  function next() {
    const err = validateStep(stepIndex);
    if (err) { toast.error(err); return; }
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  }

  function prev() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  async function onSubmit() {
    for (let i = 0; i < STEPS.length; i++) {
      const err = validateStep(i);
      if (err) { setStepIndex(i); toast.error(err); return; }
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: state.title.trim(),
        description: state.description.trim() || undefined,
        contentType: state.contentType,
        platform: state.platform,
        priority: state.priority,
        funnelStage: state.funnelStage || undefined,
        caption: state.caption || undefined,
        shortCaption: state.shortCaption || undefined,
        hashtags: state.hashtags
          ? state.hashtags.split(/[,\s]+/).map((s) => s.replace(/^#/, "")).filter(Boolean)
          : undefined,
        cta: state.cta || undefined,
        targetUrl: state.targetUrl || undefined,
        language: state.language || undefined,
        targetCountry: state.targetCountry || undefined,
        targetAudience: state.targetAudience || undefined,
        campaignName: state.campaignName || undefined,
        campaignGoal: state.campaignGoal || undefined,
        publishDate: state.publishDate ? new Date(state.publishDate).toISOString() : undefined,
        isGeneralMarketing: state.isGeneralMarketing,
        project: state.isGeneralMarketing ? undefined : state.project === NONE ? undefined : state.project,
        brief: briefId || undefined,
        mediaFiles: state.media.length
          ? state.media.map((m, i) => ({
              mediaFile: m.mediaFile,
              url: m.url,
              thumbnailUrl: m.thumbnailUrl || undefined,
              mimeType: m.mimeType,
              altText: m.altText || undefined,
              order: i,
            }))
          : undefined,
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

  const isLast = stepIndex === STEPS.length - 1;

  return (
    <div className="space-y-5">
      <PageHeader
        title="New Content"
        description="Walk through the four steps to create a ready-to-review draft."
        actions={
          <Button type="button" variant="outline" asChild>
            <Link href="/content"><ArrowLeft className="h-4 w-4" /> Back</Link>
          </Button>
        }
      />

      {brief ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <ClipboardList className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Creating content for brief</span>
            <Link href={`/briefs/${brief._id}`} className="font-medium hover:underline">{brief.title}</Link>
          </CardContent>
        </Card>
      ) : null}

      <Stepper current={stepIndex} onJump={(i) => i < stepIndex && setStepIndex(i)} />

      <Card>
        <CardContent className="p-5">
          {stepIndex === 0 ? (
            <StepBasics state={state} set={set} projects={projects} projectsLoading={projectsLoading} canPostGeneral={canPostGeneral} />
          ) : stepIndex === 1 ? (
            <StepCopy state={state} set={set} />
          ) : stepIndex === 2 ? (
            <StepMedia state={state} set={set} userId={user?.id} />
          ) : (
            <StepTargeting state={state} set={set} />
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={prev} disabled={stepIndex === 0 || submitting}>
          <ArrowLeft className="h-4 w-4" /> Previous
        </Button>
        {isLast ? (
          <Button type="button" onClick={onSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {submitting ? "Creating…" : "Create draft"}
          </Button>
        ) : (
          <Button type="button" onClick={next} disabled={submitting}>
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Stepper({ current, onJump }: { current: number; onJump: (i: number) => void }) {
  return (
    <ol className="grid grid-cols-1 gap-2 rounded-lg border bg-card p-3 sm:grid-cols-4">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => onJump(i)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                active ? "bg-primary/10" : done ? "hover:bg-muted" : "opacity-70",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                  active ? "border-primary bg-primary text-primary-foreground" :
                  done ? "border-primary/60 bg-primary/10 text-primary" :
                  "border-border bg-background text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-none">{s.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{s.description}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
