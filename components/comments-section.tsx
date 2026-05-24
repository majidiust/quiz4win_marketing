"use client";

import * as React from "react";
import Image from "next/image";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/fetcher";

interface CommentItem {
  _id?: string;
  at: string;
  body: string;
  by?: { _id?: string; firstName?: string; lastName?: string; email?: string; profileImage?: string } | string;
}

interface Props {
  // Endpoint that supports GET (returns { items }) and POST (json: { body }).
  endpoint: string;
  canComment: boolean;
  emptyHint?: string;
}

function displayName(by: CommentItem["by"]): string {
  if (!by || typeof by === "string") return "Unknown user";
  const name = `${by.firstName || ""} ${by.lastName || ""}`.trim();
  return name || by.email || "Unknown user";
}

export function CommentsSection({ endpoint, canComment, emptyHint }: Props) {
  const [items, setItems] = React.useState<CommentItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [body, setBody] = React.useState("");
  const [posting, setPosting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ items: CommentItem[] }>(endpoint);
      setItems(res.items || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  React.useEffect(() => { load(); }, [load]);

  async function submit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setPosting(true);
    try {
      await api(endpoint, { json: { body: trimmed } });
      setBody("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setPosting(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading comments…
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyHint || "No comments yet."}</p>
        ) : (
          <ul className="space-y-3">
            {items.map((c, i) => {
              const by = typeof c.by === "object" ? c.by : null;
              return (
                <li key={c._id || i} className="flex gap-3">
                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                    {by?.profileImage ? (
                      <Image src={by.profileImage} alt="" fill className="object-cover" sizes="32px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                        {displayName(c.by).slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">{displayName(c.by)}</span>
                      <span className="text-xs text-muted-foreground">{new Date(c.at).toLocaleString()}</span>
                    </div>
                    <div className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {canComment ? (
          <div className="space-y-2 border-t pt-3">
            <Textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write a comment…"
              disabled={posting}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={submit} disabled={posting || !body.trim()}>
                {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Post
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
