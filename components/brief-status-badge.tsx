import { Badge } from "@/components/ui/badge";
import { BRIEF_STATUS_LABELS, type BriefStatus } from "@/lib/constants";

const VARIANTS: Record<BriefStatus, "muted" | "secondary" | "warning" | "info" | "success"> = {
  created: "secondary",
  assigned: "info",
  in_progress: "warning",
  completed: "success",
  archived: "muted",
  template: "info",
};

export function BriefStatusBadge({ status }: { status: BriefStatus }) {
  return <Badge variant={VARIANTS[status]}>{BRIEF_STATUS_LABELS[status] ?? status}</Badge>;
}
