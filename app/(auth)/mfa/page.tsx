import { MfaForm } from "./mfa-form";

export const metadata = { title: "Two-Factor Authentication" };

export default function MfaPage() {
  return (
    <div>
      <div className="mb-8 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Two-factor verification</h1>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app, or use a recovery code.
        </p>
      </div>
      <MfaForm />
    </div>
  );
}
