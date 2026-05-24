"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "./theme-provider";
import { UserProvider } from "./user-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <UserProvider>
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        <Toaster />
      </UserProvider>
    </ThemeProvider>
  );
}
