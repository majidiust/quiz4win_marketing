"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/fetcher";
import { useUser } from "@/components/providers/user-provider";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

interface Props {
  recaptchaSiteKey: string;
}

export function LoginForm({ recaptchaSiteKey }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const { refresh } = useUser();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPwd, setShowPwd] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [captchaReady, setCaptchaReady] = React.useState(!recaptchaSiteKey);

  React.useEffect(() => {
    if (!recaptchaSiteKey) return;
    const id = "recaptcha-v3";
    if (document.getElementById(id)) {
      setCaptchaReady(true);
      return;
    }
    const s = document.createElement("script");
    s.id = id;
    s.src = `https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`;
    s.async = true;
    s.defer = true;
    s.onload = () => setCaptchaReady(true);
    document.body.appendChild(s);
  }, [recaptchaSiteKey]);

  async function getCaptchaToken(): Promise<string | undefined> {
    if (!recaptchaSiteKey || !window.grecaptcha) return undefined;
    return new Promise((resolve) => {
      window.grecaptcha!.ready(async () => {
        try {
          const token = await window.grecaptcha!.execute(recaptchaSiteKey, { action: "login" });
          resolve(token);
        } catch {
          resolve(undefined);
        }
      });
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const recaptchaToken = await getCaptchaToken();
      const res = await api<{ mfaRequired: boolean }>("/api/auth/login", {
        json: { email, password, recaptchaToken },
      });
      if (res.mfaRequired) {
        router.push(`/mfa?next=${encodeURIComponent(next)}`);
        return;
      }
      await refresh();
      toast.success("Welcome back");
      router.replace(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@bingobingo.tv"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPwd ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPwd((s) => !s)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={showPwd ? "Hide password" : "Show password"}
          >
            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={submitting || !captchaReady}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitting ? "Signing in…" : "Sign in"}
      </Button>

      {recaptchaSiteKey ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          This site is protected by reCAPTCHA and the Google{" "}
          <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>{" "}
          and{" "}
          <a className="underline" href="https://policies.google.com/terms" target="_blank" rel="noreferrer">Terms of Service</a> apply.
        </p>
      ) : null}
    </form>
  );
}
