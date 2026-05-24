"use client";

import * as React from "react";
import Image from "next/image";
import { Loader2, ShieldCheck, ShieldOff, Copy, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/fetcher";
import { useUser } from "@/components/providers/user-provider";

interface SetupPayload { secret: string; otpauthUrl: string; qrCodeDataUrl: string }

export function MfaSection() {
  const { user, refresh } = useUser();
  const enabled = !!user?.mfaEnabled;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {enabled ? <ShieldCheck className="h-4 w-4 text-success" /> : <ShieldOff className="h-4 w-4 text-muted-foreground" />}
          Two-factor authentication
          <Badge variant={enabled ? "success" : "muted"} className="ml-1">{enabled ? "Enabled" : "Disabled"}</Badge>
        </CardTitle>
        <CardDescription>
          Protect your account with a time-based one-time password from an authenticator app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {enabled ? <DisableFlow onChanged={refresh} /> : <EnrollFlow onChanged={refresh} />}
      </CardContent>
    </Card>
  );
}

function EnrollFlow({ onChanged }: { onChanged: () => void }) {
  const [setup, setSetup] = React.useState<SetupPayload | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[] | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function begin() {
    setLoading(true);
    try {
      const data = await api<SetupPayload>("/api/auth/mfa/setup", { method: "GET" });
      setSetup(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start enrollment");
    } finally {
      setLoading(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!setup) return;
    setVerifying(true);
    try {
      const res = await api<{ enabled: boolean; recoveryCodes: string[] }>("/api/auth/mfa/setup", {
        method: "POST",
        json: { secret: setup.secret, code },
      });
      setRecoveryCodes(res.recoveryCodes);
      toast.success("Two-factor authentication enabled");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setVerifying(false);
    }
  }

  function copyCodes() {
    if (!recoveryCodes) return;
    navigator.clipboard.writeText(recoveryCodes.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (recoveryCodes) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
          <div className="text-sm">
            <div className="font-medium">Save your recovery codes</div>
            <p className="text-muted-foreground text-xs mt-0.5">
              Each code can be used once if you lose access to your authenticator. They will not be shown again.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-3 font-mono text-sm">
          {recoveryCodes.map((c) => <div key={c} className="tracking-wider">{c}</div>)}
        </div>
        <Button type="button" variant="outline" onClick={copyCodes}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy codes"}
        </Button>
      </div>
    );
  }

  if (!setup) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Use Google Authenticator, 1Password, Authy or any TOTP-compatible app.
        </p>
        <Button type="button" onClick={begin} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {loading ? "Preparing…" : "Begin setup"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={confirm} className="space-y-4">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        {setup.qrCodeDataUrl ? (
          <Image src={setup.qrCodeDataUrl} alt="MFA QR code" width={180} height={180} unoptimized className="rounded-md border bg-white p-2" />
        ) : null}
        <div className="flex-1 space-y-2">
          <p className="text-sm">Scan the QR code, or enter this secret manually:</p>
          <code className="block break-all rounded-md border bg-muted/40 p-2 font-mono text-xs">{setup.secret}</code>
          <p className="text-xs text-muted-foreground">After scanning, enter the 6-digit code shown by your app.</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Verification code</Label>
        <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" className="font-mono tracking-widest" required />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => { setSetup(null); setCode(""); }}>Cancel</Button>
        <Button type="submit" disabled={verifying || code.length < 6}>
          {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {verifying ? "Verifying…" : "Verify & enable"}
        </Button>
      </div>
    </form>
  );
}

function DisableFlow({ onChanged }: { onChanged: () => void }) {
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function onDisable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth/mfa/setup", { method: "DELETE", json: { code } });
      toast.success("Two-factor authentication disabled");
      setCode("");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onDisable} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        To disable two-factor authentication, enter a current code from your authenticator app.
      </p>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Current code</Label>
        <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" className="font-mono tracking-widest" required />
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="destructive" disabled={busy || code.length < 6}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
          {busy ? "Disabling…" : "Disable two-factor"}
        </Button>
      </div>
    </form>
  );
}
