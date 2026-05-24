import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { publicEnv } from "@/lib/env";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div>
      <div className="mb-8 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back to {publicEnv.appName}. Enter your credentials to continue.
        </p>
      </div>
      <Suspense fallback={null}>
        <LoginForm
          recaptchaSiteKey={publicEnv.recaptchaEnabled ? publicEnv.recaptchaSiteKey : ""}
        />
      </Suspense>
      <p className="mt-8 text-center text-xs text-muted-foreground">
        Need help signing in? Contact your administrator.
      </p>
    </div>
  );
}
