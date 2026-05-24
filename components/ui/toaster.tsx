"use client";
import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "bg-card text-card-foreground border-border shadow-md",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}
