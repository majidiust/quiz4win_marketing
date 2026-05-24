"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Trash2, UserPlus, Archive, CheckCircle2, RotateCcw, FileText, Repeat, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { BriefStatusBadge } from "@/components/brief-status-badge";
import { StatusBadge } from "@/components/status-badge";
import { CommentsSection } from "@/components/comments-section";
import { api } from "@/lib/fetcher";
import { useUser } from "@/components/providers/user-provider";
import {
  CONTENT_TYPE_LABELS, FUNNEL_STAGE_LABELS, PLATFORM_LABELS,
  WEEKDAY_LABELS, RECURRENCE_FREQ_LABELS,
  type BriefStatus, type ContentStatus, type ContentType, type FunnelStage, type Platform,
  type RecurrenceFreq, type Weekday,
} from "@/lib/constants";

interface UserRef { _id: string; firstName?: string; lastName?: string; email?: string; profileImage?: string }
interface BriefDoc {
  _id: string;
  title: string;
  description?: string;
  goal?: string;
  status: BriefStatus;
  platform?: Platform;
  contentType?: ContentType;
  funnelStage?: FunnelStage;
  priority?: string;
  language?: string;
  targetCountry?: string;
  targetAudience?: string;
  suggestedHashtags?: string[];
  suggestedMentions?: string[];
  suggestedCTA?: string;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
  isGeneralMarketing?: boolean;
  project?: { _id: string; projectName: string; slug?: string };
  createdBy?: UserRef;
  assignedTo?: UserRef | null;
  activityLog?: Array<{ at: string; action: string; fromStatus?: string; toStatus?: string; note?: string }>;
  isTemplate?: boolean;
  template?: string | { _id: string; title?: string } | null;
  recurrence?: {
    freq: RecurrenceFreq;
    interval?: number;
    byweekday?: Weekday[];
    bymonthday?: number;
    startsAt: string;
    endsAt?: string;
    timezone?: string;
  };
  nextRunAt?: string;
  lastRunAt?: string;
  occurrenceCount?: number;
  deadlineOffsetHours?: number;
}
interface SpawnedBrief {
  _id: string;
  title: string;
  status: BriefStatus;
  createdAt: string;
  deadline?: string;
  assignedTo?: UserRef | null;
}
interface ChildContent {
  _id: string;
  title: string;
  status: ContentStatus;
  contentType: ContentType;
  platform: Platform;
  updatedAt: string;
  createdBy?: UserRef;
}

const TRANSITIONS: Record<BriefStatus, { to: BriefStatus; label: string; icon: React.ComponentType<{ className?: string }>; variant?: "default" | "success" | "outline" | "warning" }[]> = {
  created: [{ to: "archived", label: "Archive", icon: Archive, variant: "outline" }],
  assigned: [{ to: "in_progress", label: "Mark in progress", icon: RotateCcw, variant: "default" }, { to: "created", label: "Unassign", icon: RotateCcw, variant: "outline" }, { to: "archived", label: "Archive", icon: Archive, variant: "outline" }],
  in_progress: [{ to: "completed", label: "Mark completed", icon: CheckCircle2, variant: "success" }, { to: "assigned", label: "Back to assigned", icon: RotateCcw, variant: "outline" }, { to: "archived", label: "Archive", icon: Archive, variant: "outline" }],
  completed: [{ to: "in_progress", label: "Reopen", icon: RotateCcw, variant: "outline" }, { to: "archived", label: "Archive", icon: Archive, variant: "outline" }],
  archived: [{ to: "created", label: "Restore", icon: RotateCcw, variant: "outline" }],
  template: [{ to: "archived", label: "Archive template", icon: Archive, variant: "outline" }],
};

function describeRecurrence(r: NonNullable<BriefDoc["recurrence"]>): string {
  const interval = r.interval && r.interval > 1 ? `every ${r.interval} ` : "";
  const unit = r.freq === "daily" ? "day" : r.freq === "weekly" ? "week" : "month";
  const plural = (r.interval || 1) > 1 ? "s" : "";
  let extra = "";
  if (r.freq === "weekly" && r.byweekday?.length) {
    extra = ` on ${r.byweekday.map((d) => WEEKDAY_LABELS[d]).join(", ")}`;
  } else if (r.freq === "monthly" && r.bymonthday) {
    extra = ` on day ${r.bymonthday}`;
  }
  const tz = r.timezone && r.timezone !== "UTC" ? ` (${r.timezone})` : "";
  return `Repeats ${interval}${unit}${plural}${extra}${tz}`;
}

export function BriefDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { user, hasPermission } = useUser();
  const [doc, setDoc] = React.useState<BriefDoc | null>(null);
  const [children, setChildren] = React.useState<ChildContent[]>([]);
  const [spawned, setSpawned] = React.useState<SpawnedBrief[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [assignees, setAssignees] = React.useState<UserRef[]>([]);
  const [transitionState, setTransitionState] = React.useState<{ to: BriefStatus } | null>(null);
  const [note, setNote] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [b, c] = await Promise.all([
        api<{ brief: BriefDoc }>(`/api/briefs/${id}`),
        api<{ items: ChildContent[] }>(`/api/briefs/${id}/contents`).catch(() => ({ items: [] })),
      ]);
      setDoc(b.brief);
      setChildren(c.items || []);
      // Fetch spawned instances for templates. Hidden from the regular list
      // by default (active filter excludes templates' children inadvertently
      // when the user is filtering; explicit fetch here keeps it complete).
      if (b.brief.isTemplate) {
        try {
          const s = await api<{ items: SpawnedBrief[] }>(
            `/api/briefs?template=${id}&templates=all&limit=50`
          );
          setSpawned(s.items || []);
        } catch {
          setSpawned([]);
        }
      } else {
        setSpawned([]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load brief");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    if (!hasPermission("briefs.assign")) return;
    api<{ items: UserRef[] }>("/api/users?limit=200")
      .then((r) => {
        const filtered = (r.items as Array<UserRef & { role?: string }> || []).filter((u) =>
          ["content_producer", "marketing_user", "project_manager"].includes(u.role || "")
        );
        setAssignees(filtered);
      })
      .catch(() => setAssignees([]));
  }, [hasPermission]);

  async function assign(userId: string | null) {
    try {
      await api(`/api/briefs/${id}/assign`, { json: { userId } });
      toast.success(userId ? "Assigned" : "Unassigned");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to assign");
    }
  }

  async function doTransition() {
    if (!transitionState) return;
    try {
      await api(`/api/briefs/${id}/transition`, { json: { toStatus: transitionState.to, note: note || undefined } });
      toast.success(`Moved to ${transitionState.to.replace(/_/g, " ")}`);
      setTransitionState(null);
      setNote("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transition failed");
    }
  }

  async function softDelete() {
    if (!confirm("Delete this brief?")) return;
    try {
      await api(`/api/briefs/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      router.replace("/briefs");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  if (loading || !doc) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const isOwner = !!(user && doc.createdBy && doc.createdBy._id === user.id);
  const canEdit = hasPermission("briefs.update.any") || (isOwner && hasPermission("briefs.update.own"));
  const canDelete = hasPermission("briefs.delete.any");
  const canAssign = hasPermission("briefs.assign");
  const canComment = hasPermission("briefs.comment");
  const canCreateContent = hasPermission("content.create") && doc.status !== "archived" && !doc.isGeneralMarketing
    ? true
    : hasPermission("content.create") && doc.isGeneralMarketing;
  const availableTransitions = (TRANSITIONS[doc.status] || []).filter(() => canEdit || canAssign);

  return (
    <div className="space-y-5">
      <PageHeader
        title={doc.title}
        description={`${doc.project?.projectName || (doc.isGeneralMarketing ? "General Marketing" : "—")}${doc.platform ? ` · ${PLATFORM_LABELS[doc.platform]}` : ""}${doc.contentType ? ` · ${CONTENT_TYPE_LABELS[doc.contentType]}` : ""}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/briefs"><ArrowLeft className="h-4 w-4" /> Back</Link>
            </Button>
            {canCreateContent ? (
              <Button asChild>
                <Link href={`/content/new?briefId=${doc._id}`}><Plus className="h-4 w-4" /> Create content</Link>
              </Button>
            ) : null}
            {canDelete ? (
              <Button variant="ghost" onClick={softDelete} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <BriefStatusBadge status={doc.status} />
        {doc.priority ? <Badge variant="muted" className="capitalize">{doc.priority}</Badge> : null}
        {doc.deadline ? <Badge variant="outline">Due {new Date(doc.deadline).toLocaleDateString()}</Badge> : null}
        {doc.isTemplate ? (
          <Badge variant="outline" className="gap-1"><Repeat className="h-3 w-3" /> Recurring template</Badge>
        ) : null}
        {doc.template && typeof doc.template !== "string" ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/briefs/${doc.template._id}`}>
              <Repeat className="h-3.5 w-3.5" /> From template
            </Link>
          </Button>
        ) : null}
        {availableTransitions.map((t) => {
          const Icon = t.icon;
          return (
            <Button
              key={t.to}
              size="sm"
              variant={t.variant === "success" ? "success" : t.variant === "outline" ? "outline" : t.variant === "warning" ? "warning" : "default"}
              onClick={() => setTransitionState({ to: t.to })}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </Button>
          );
        })}
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="contents">Content ({children.length})</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          {doc.isTemplate && doc.recurrence ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Repeat className="h-4 w-4" /> Recurrence</CardTitle>
                <CardDescription>{describeRecurrence(doc.recurrence)}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <Meta label="Frequency" value={RECURRENCE_FREQ_LABELS[doc.recurrence.freq]} />
                <Meta label="Interval" value={String(doc.recurrence.interval || 1)} />
                <Meta label="Starts at" value={new Date(doc.recurrence.startsAt).toLocaleString()} />
                <Meta label="Ends at" value={doc.recurrence.endsAt ? new Date(doc.recurrence.endsAt).toLocaleString() : "—"} />
                <Meta label="Timezone" value={doc.recurrence.timezone || "UTC"} />
                <Meta label="Next run" value={doc.nextRunAt ? new Date(doc.nextRunAt).toLocaleString() : "Paused"} />
                <Meta label="Last run" value={doc.lastRunAt ? new Date(doc.lastRunAt).toLocaleString() : "—"} />
                <Meta label="Spawned so far" value={String(doc.occurrenceCount || 0)} />
                {doc.deadlineOffsetHours ? (
                  <Meta label="Deadline per instance" value={`${doc.deadlineOffsetHours}h after spawn`} />
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {doc.isTemplate ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><PlayCircle className="h-4 w-4" /> Spawned instances</CardTitle>
                <CardDescription>Briefs that have been created from this template.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {spawned.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No instances spawned yet.</div>
                ) : (
                  <ul className="divide-y">
                    {spawned.map((s) => (
                      <li key={s._id}>
                        <Link href={`/briefs/${s._id}`} className="flex items-center gap-3 p-3 hover:bg-accent/30">
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{s.title}</div>
                            <div className="text-xs text-muted-foreground">
                              Spawned {new Date(s.createdAt).toLocaleString()}
                              {s.deadline ? ` · due ${new Date(s.deadline).toLocaleDateString()}` : ""}
                              {s.assignedTo ? ` · ${`${s.assignedTo.firstName || ""} ${s.assignedTo.lastName || ""}`.trim() || s.assignedTo.email}` : ""}
                            </div>
                          </div>
                          <BriefStatusBadge status={s.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader><CardTitle>Brief</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              {doc.description ? <Section label="Description">{doc.description}</Section> : null}
              {doc.goal ? <Section label="Goal">{doc.goal}</Section> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Meta label="Funnel stage" value={doc.funnelStage ? FUNNEL_STAGE_LABELS[doc.funnelStage] : "—"} />
                <Meta label="Language" value={doc.language || "—"} />
                <Meta label="Target country" value={doc.targetCountry || "—"} />
                <Meta label="Target audience" value={doc.targetAudience || "—"} />
                <Meta label="Suggested CTA" value={doc.suggestedCTA || "—"} />
                <Meta label="Hashtags" value={doc.suggestedHashtags?.length ? doc.suggestedHashtags.map((h) => `#${h}`).join(" ") : "—"} />
                <Meta label="Mentions" value={doc.suggestedMentions?.length ? doc.suggestedMentions.map((m) => `@${m}`).join(" ") : "—"} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assignment</CardTitle>
              <CardDescription>
                {doc.assignedTo
                  ? `Currently assigned to ${`${doc.assignedTo.firstName || ""} ${doc.assignedTo.lastName || ""}`.trim() || doc.assignedTo.email}`
                  : "Unassigned"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              {canAssign ? (
                <>
                  <Select value={doc.assignedTo?._id || "__none__"} onValueChange={(v) => assign(v === "__none__" ? null : v)}>
                    <SelectTrigger className="w-72"><SelectValue placeholder="Assign to…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Unassigned</SelectItem>
                      {assignees.map((u) => (
                        <SelectItem key={u._id} value={u._id}>
                          {`${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {doc.assignedTo ? (
                    <Button variant="outline" size="sm" onClick={() => assign(null)}>
                      <UserPlus className="h-3.5 w-3.5" /> Unassign
                    </Button>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">You don&apos;t have permission to assign briefs.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Metadata</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <Meta label="Created" value={new Date(doc.createdAt).toLocaleString()} />
              <Meta label="Updated" value={new Date(doc.updatedAt).toLocaleString()} />
              <Meta label="Created by" value={doc.createdBy ? `${doc.createdBy.firstName || ""} ${doc.createdBy.lastName || ""}`.trim() || doc.createdBy.email : "—"} />
              <Meta label="Deadline" value={doc.deadline ? new Date(doc.deadline).toLocaleString() : "—"} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contents" className="space-y-3">
          {children.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No content has been created against this brief yet.
              </CardContent>
            </Card>
          ) : (
            children.map((c) => (
              <Link key={c._id} href={`/content/${c._id}`} className="block">
                <Card className="hover:bg-accent/30">
                  <CardContent className="flex items-center gap-3 p-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{c.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {PLATFORM_LABELS[c.platform]} · {CONTENT_TYPE_LABELS[c.contentType]}
                        {c.createdBy ? ` · by ${`${c.createdBy.firstName || ""} ${c.createdBy.lastName || ""}`.trim() || c.createdBy.email}` : ""}
                      </div>
                    </div>
                    <StatusBadge status={c.status} />
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>

        <TabsContent value="comments">
          <CommentsSection
            endpoint={`/api/briefs/${id}/comments`}
            canComment={canComment}
            emptyHint="Start the discussion."
          />
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-4">
              {doc.activityLog && doc.activityLog.length ? (
                <ul className="space-y-2 text-sm">
                  {doc.activityLog.slice().reverse().map((e, i) => (
                    <li key={i} className="border-l-2 pl-3">
                      <div className="font-medium">{e.action}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(e.at).toLocaleString()}
                        {e.fromStatus && e.toStatus ? ` · ${e.fromStatus} → ${e.toStatus}` : ""}
                      </div>
                      {e.note ? <div className="mt-1">{e.note}</div> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!transitionState} onOpenChange={(o) => !o && setTransitionState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm transition</DialogTitle>
            <DialogDescription>
              Move brief to <span className="font-medium">{transitionState?.to?.replace(/_/g, " ")}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional context…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransitionState(null)}>Cancel</Button>
            <Button onClick={doTransition}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="whitespace-pre-wrap">{children}</div>
    </div>
  );
}
