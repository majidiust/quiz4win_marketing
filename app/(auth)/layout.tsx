import { Sparkles } from "lucide-react";
import { publicEnv } from "@/lib/env";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Marketing panel */}
      <div className="relative hidden overflow-hidden bg-sidebar text-sidebar-foreground lg:block">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(99,102,241,0.45) 0%, transparent 45%), radial-gradient(circle at 80% 70%, rgba(56,189,248,0.35) 0%, transparent 50%)",
          }}
        />
        <div className="relative flex h-full flex-col p-12">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-base font-semibold">{publicEnv.appName}</span>
          </div>
          <div className="mt-auto max-w-md space-y-4">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight">
              The centralized marketing operations hub.
            </h2>
            <p className="text-sm text-white/70">
              Plan, review, schedule and publish content across every channel with one workflow,
              one calendar and one source of truth.
            </p>
            <ul className="space-y-2 pt-4 text-xs text-white/60">
              <li>· Role-based approval workflows</li>
              <li>· Multi-platform content scheduling</li>
              <li>· Full audit trail of every action</li>
              <li>· No spreadsheets, no copy-paste</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
