import { Badge } from "@/components/ui/badge";
import { CONTENT_STATUS_LABELS, type ContentStatus } from "@/lib/constants";

const VARIANTS: Record<ContentStatus, "muted" | "secondary" | "warning" | "info" | "success" | "destructive" | "default"> = {
  generated: "muted",
  draft: "secondary",
  under_review: "warning",
  approved: "info",
  rejected: "destructive",
  scheduled: "info",
  published: "success",
  deleted: "muted",
  failed: "destructive",
  archived: "muted",
};

export function StatusBadge({ status }: { status: ContentStatus }) {
  return <Badge variant={VARIANTS[status]}>{CONTENT_STATUS_LABELS[status] ?? status}</Badge>;
}
