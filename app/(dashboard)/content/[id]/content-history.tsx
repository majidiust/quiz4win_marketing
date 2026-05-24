"use client";

import * as React from "react";
import { ArrowRight, History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";

interface ActivityEntry {
  at: string;
  action: string;
  fromStatus?: string;
  toStatus?: string;
  note?: string;
  by?: string;
}

function formatStatus(s?: string) {
  return s ? s.replace(/_/g, " ") : "";
}

export function ContentHistory({ entries }: { entries: ActivityEntry[] }) {
  const sorted = React.useMemo(
    () => [...entries].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [entries]
  );

  if (!sorted.length) {
    return (
      <EmptyState
        icon={<History className="h-8 w-8" />}
        title="No activity yet"
        description="Status transitions and edits will appear here."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity history</CardTitle>
        <CardDescription>Status transitions and key changes on this content</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-4 border-l pl-6">
          {sorted.map((e, i) => {
            const isTransition = e.action?.startsWith("transition:") || (!!e.fromStatus && !!e.toStatus);
            return (
              <li key={i} className="relative">
                <span className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {isTransition ? (
                    <>
                      <Badge variant="muted" className="capitalize">{formatStatus(e.fromStatus)}</Badge>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <Badge variant="default" className="capitalize">{formatStatus(e.toStatus)}</Badge>
                    </>
                  ) : (
                    <span className="font-medium capitalize">{e.action?.replace(/[._]/g, " ")}</span>
                  )}
                  <span className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString()}</span>
                </div>
                {e.note ? <p className="mt-1 text-sm text-muted-foreground">{e.note}</p> : null}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
