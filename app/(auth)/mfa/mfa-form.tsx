"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/fetcher";
import { useUser } from "@/components/providers/user-provider";

export function MfaForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const { refresh } = useUser();
  const [code, setCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api("/api/auth/mfa/verify", { json: { code: code.trim() } });
      await refresh();
      toast.success("Verified");
      router.replace(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="code">Verification code</Label>
        <Input
          id="code"
          inputMode="text"
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456 or recovery code"
          autoFocus
          maxLength={20}
        />
      </div>
      <Button type="submit" className="w-full" disabled={submitting || code.length < 6}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitting ? "Verifying…" : "Verify"}
      </Button>
      <button
        type="button"
        onClick={() => router.replace("/login")}
        className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
      >
        Cancel and return to sign in
      </button>
    </form>
  );
}
