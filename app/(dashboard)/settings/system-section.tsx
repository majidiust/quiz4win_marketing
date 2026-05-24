"use client";

import * as React from "react";
import { Loader2, Save, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/fetcher";

interface SystemSettings {
  organizationName?: string;
  defaultTimezone?: string;
  requireMfaForAll?: boolean;
  sessionTimeoutMinutes?: number;
  contentApprovalRequired?: boolean;
  brandFooter?: string;
}

const DEFAULTS: SystemSettings = {
  organizationName: "",
  defaultTimezone: "UTC",
  requireMfaForAll: false,
  sessionTimeoutMinutes: 480,
  contentApprovalRequired: true,
  brandFooter: "",
};

export function SystemSettingsSection() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<SystemSettings>(DEFAULTS);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await api<{ settings: Record<string, unknown> }>("/api/settings", { method: "GET" });
        setForm({ ...DEFAULTS, ...(res.settings as SystemSettings) });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/settings", { method: "PUT", json: { settings: form } });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  if (loading) {
    return (
      <Card className="max-w-2xl">
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><SettingsIcon className="h-4 w-4" /> System settings</CardTitle>
        <CardDescription>Organization-wide configuration applied to every user</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Organization name">
            <Input value={form.organizationName || ""} onChange={(e) => update("organizationName", e.target.value)} placeholder="BingoBingo" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default timezone">
              <Input value={form.defaultTimezone || ""} onChange={(e) => update("defaultTimezone", e.target.value)} placeholder="UTC" />
            </Field>
            <Field label="Session timeout (minutes)">
              <Input
                type="number"
                min={15}
                max={10080}
                value={form.sessionTimeoutMinutes ?? 480}
                onChange={(e) => update("sessionTimeoutMinutes", Number(e.target.value) || 480)}
              />
            </Field>
          </div>
          <ToggleRow
            label="Require two-factor authentication for all users"
            hint="New logins without MFA will be forced to enroll."
            checked={!!form.requireMfaForAll}
            onChange={(v) => update("requireMfaForAll", v)}
          />
          <ToggleRow
            label="Content approval required before publishing"
            hint="When enabled, all content must pass review before scheduling."
            checked={!!form.contentApprovalRequired}
            onChange={(v) => update("contentApprovalRequired", v)}
          />
          <Field label="Brand footer text" hint="Optional footer appended to outgoing notifications">
            <Textarea
              value={form.brandFooter || ""}
              onChange={(e) => update("brandFooter", e.target.value)}
              rows={3}
              placeholder="© BingoBingo Marketing"
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
