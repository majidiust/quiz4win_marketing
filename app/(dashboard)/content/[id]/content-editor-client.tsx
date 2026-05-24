"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, Send, CheckCircle2, XCircle, CalendarClock, Trash2, Archive, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/fetcher";
import { useUser } from "@/components/providers/user-provider";
import {
  CONTENT_TYPE_LABELS, PLATFORM_LABELS, type ContentStatus, type ContentType, type Platform,
} from "@/lib/constants";
import { ContentDetailsForm, type EditableContent } from "./content-details-form";
import { ContentHistory } from "./content-history";

interface ContentDoc extends EditableContent {
  _id: string;
  status: ContentStatus;
  contentType: ContentType;
  platform: Platform;
  isGeneralMarketing?: boolean;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  scheduledAt?: string;
  publishDate?: string;
  rejectionReason?: string;
  reviewerComment?: string;
  externalPublishError?: string;
  project?: { _id: string; projectName: string; slug?: string; isGeneralMarketing?: boolean };
  createdBy?: { _id: string; firstName?: string; lastName?: string; email?: string };
  approvedBy?: { firstName?: string; lastName?: string };
  rejectedBy?: { firstName?: string; lastName?: string };
  activityLog?: Array<{ at: string; action: string; fromStatus?: string; toStatus?: string; note?: string; by?: string }>;
}

const TRANSITIONS: Record<ContentStatus, { to: ContentStatus; label: string; icon: React.ComponentType<{ className?: string }>; variant?: "default" | "success" | "destructive" | "warning" | "outline"; requirePermission?: string; requireOwnerOrPerm?: string }[]> = {
  generated: [
    { to: "draft", label: "Move to Draft", icon: Sparkles, variant: "outline" },
  ],
  draft: [
    { to: "under_review", label: "Submit for review", icon: Send, variant: "default", requireOwnerOrPerm: "content.submit" },
  ],
  under_review: [
    { to: "approved", label: "Approve", icon: CheckCircle2, variant: "success", requirePermission: "content.approve" },
    { to: "rejected", label: "Reject", icon: XCircle, variant: "destructive", requirePermission: "content.reject" },
    { to: "draft", label: "Return to draft", icon: RotateCcw, variant: "outline" },
  ],
  approved: [
    { to: "scheduled", label: "Schedule", icon: CalendarClock, variant: "default", requirePermission: "content.schedule" },
    { to: "draft", label: "Reopen", icon: RotateCcw, variant: "outline" },
  ],
  scheduled: [
    { to: "published", label: "Mark published", icon: CheckCircle2, variant: "success", requirePermission: "content.publish" },
    { to: "approved", label: "Unschedule", icon: RotateCcw, variant: "outline", requirePermission: "content.schedule" },
    { to: "failed", label: "Mark failed", icon: XCircle, variant: "warning", requirePermission: "content.publish" },
  ],
  rejected: [
    { to: "draft", label: "Reopen as draft", icon: RotateCcw, variant: "outline" },
  ],
  failed: [
    { to: "scheduled", label: "Retry schedule", icon: CalendarClock, variant: "default", requirePermission: "content.schedule" },
    { to: "draft", label: "Back to draft", icon: RotateCcw, variant: "outline" },
  ],
  published: [
    { to: "archived", label: "Archive", icon: Archive, variant: "outline", requirePermission: "content.archive" },
  ],
  archived: [
    { to: "draft", label: "Restore", icon: RotateCcw, variant: "outline", requirePermission: "content.restore" },
  ],
  deleted: [
    { to: "draft", label: "Restore", icon: RotateCcw, variant: "outline", requirePermission: "content.restore" },
  ],
};

export function ContentEditorClient({ id }: { id: string }) {
  const router = useRouter();
  const { user, hasPermission } = useUser();
  const [doc, setDoc] = React.useState<ContentDoc | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [transitionState, setTransitionState] = React.useState<{ to: ContentStatus } | null>(null);
  const [reason, setReason] = React.useState("");
  const [scheduledAt, setScheduledAt] = React.useState("");
  const formRef = React.useRef<{ getValues: () => Partial<EditableContent> } | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ content: ContentDoc }>(`/api/content/${id}`);
      setDoc(res.content);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => { load(); }, [load]);

  const isOwner = !!(user && doc?.createdBy && doc.createdBy._id === user.id);
  const isEditable = !!doc && !doc.isDeleted && (
    hasPermission("content.update.any") ||
    (isOwner && hasPermission("content.update.own") && ["generated", "draft", "rejected", "under_review"].includes(doc.status))
  );
  const canDelete = !!doc && (
    hasPermission("content.delete.any") ||
    (isOwner && hasPermission("content.delete.own") && doc.status !== "published")
  );

  async function save() {
    if (!doc || !formRef.current) return;
    setSaving(true);
    try {
      const values = formRef.current.getValues();
      await api(`/api/content/${id}`, { method: "PATCH", json: values });
      toast.success("Saved");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function doTransition() {
    if (!transitionState || !doc) return;
    try {
      await api(`/api/content/${id}/transition`, {
        json: {
          toStatus: transitionState.to,
          reason: reason || undefined,
          scheduledAt: transitionState.to === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        },
      });
      toast.success(`Moved to ${transitionState.to.replace(/_/g, " ")}`);
      setTransitionState(null);
      setReason("");
      setScheduledAt("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transition failed");
    }
  }

  async function softDelete() {
    if (!confirm("Delete this content? It will be moved to deleted state and can be restored.")) return;
    try {
      await api(`/api/content/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      router.replace("/content");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  if (loading || !doc) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const availableTransitions = (TRANSITIONS[doc.status] || []).filter((t) => {
    if (t.requirePermission && !hasPermission(t.requirePermission as never)) return false;
    if (t.requireOwnerOrPerm && !(isOwner || hasPermission(t.requireOwnerOrPerm as never))) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={doc.title || "Untitled"}
        description={`${PLATFORM_LABELS[doc.platform]} · ${CONTENT_TYPE_LABELS[doc.contentType]} · ${doc.project?.projectName || (doc.isGeneralMarketing ? "General Marketing" : "")}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/content"><ArrowLeft className="h-4 w-4" /> Back</Link>
            </Button>
            {isEditable ? (
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving…" : "Save"}
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
        <StatusBadge status={doc.status} />
        {doc.campaignName ? <Badge variant="outline">Campaign: {doc.campaignName}</Badge> : null}
        {doc.priority ? <Badge variant="muted" className="capitalize">{doc.priority}</Badge> : null}
        {availableTransitions.map((t) => {
          const Icon = t.icon;
          return (
            <Button
              key={t.to}
              size="sm"
              variant={t.variant === "success" ? "success" : t.variant === "destructive" ? "destructive" : t.variant === "warning" ? "warning" : t.variant === "outline" ? "outline" : "default"}
              onClick={() => setTransitionState({ to: t.to })}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </Button>
          );
        })}
      </div>

      {doc.status === "rejected" && doc.rejectionReason ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm">
            <div className="font-medium text-destructive">Rejection reason</div>
            <div className="mt-1 text-foreground/80">{doc.rejectionReason}</div>
            {doc.rejectedBy ? <div className="mt-2 text-xs text-muted-foreground">by {doc.rejectedBy.firstName} {doc.rejectedBy.lastName}</div> : null}
          </CardContent>
        </Card>
      ) : null}

      {doc.status === "failed" && doc.externalPublishError ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 text-sm">
            <div className="font-medium text-warning">Publish failed</div>
            <div className="mt-1 text-foreground/80">{doc.externalPublishError}</div>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="meta">Meta</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="space-y-4">
          <ContentDetailsForm doc={doc} editable={isEditable} ref={formRef} />
        </TabsContent>
        <TabsContent value="history">
          <ContentHistory entries={doc.activityLog || []} />
        </TabsContent>
        <TabsContent value="meta">
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
              <CardDescription>System fields and timestamps</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <Meta label="Created" value={new Date(doc.createdAt).toLocaleString()} />
              <Meta label="Updated" value={new Date(doc.updatedAt).toLocaleString()} />
              <Meta label="Author" value={doc.createdBy ? `${doc.createdBy.firstName || ""} ${doc.createdBy.lastName || ""}`.trim() || doc.createdBy.email : "—"} />
              <Meta label="Scheduled at" value={doc.scheduledAt ? new Date(doc.scheduledAt).toLocaleString() : "—"} />
              <Meta label="Published at" value={doc.publishedAt ? new Date(doc.publishedAt).toLocaleString() : "—"} />
              <Meta label="Project" value={doc.project?.projectName || (doc.isGeneralMarketing ? "General Marketing" : "—")} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TransitionDialog
        state={transitionState}
        onClose={() => setTransitionState(null)}
        reason={reason}
        setReason={setReason}
        scheduledAt={scheduledAt}
        setScheduledAt={setScheduledAt}
        onConfirm={doTransition}
        defaultScheduledAt={doc.publishDate}
      />
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

function TransitionDialog({ state, onClose, reason, setReason, scheduledAt, setScheduledAt, onConfirm, defaultScheduledAt }: {
  state: { to: ContentStatus } | null;
  onClose: () => void;
  reason: string;
  setReason: (s: string) => void;
  scheduledAt: string;
  setScheduledAt: (s: string) => void;
  onConfirm: () => void;
  defaultScheduledAt?: string;
}) {
  React.useEffect(() => {
    if (state?.to === "scheduled" && !scheduledAt && defaultScheduledAt) {
      const d = new Date(defaultScheduledAt);
      setScheduledAt(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    }
  }, [state, scheduledAt, defaultScheduledAt, setScheduledAt]);

  const open = !!state;
  const needsReason = state?.to === "rejected";
  const needsSchedule = state?.to === "scheduled";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm transition</DialogTitle>
          <DialogDescription>Move content to <span className="font-medium">{state?.to?.replace(/_/g, " ")}</span>.</DialogDescription>
        </DialogHeader>
        {needsReason ? (
          <div className="space-y-1.5">
            <Label>Reason (required)</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tell the author what to fix…" />
          </div>
        ) : null}
        {needsSchedule ? (
          <div className="space-y-1.5">
            <Label>Schedule at</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
        ) : null}
        {!needsReason && !needsSchedule ? (
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional context…" />
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onConfirm} disabled={needsReason && !reason.trim()}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
