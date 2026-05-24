"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { useUser } from "@/components/providers/user-provider";
import { ProfileSection } from "./profile-section";
import { PasswordSection } from "./password-section";
import { MfaSection } from "./mfa-section";
import { SystemSettingsSection } from "./system-section";

const TABS = ["profile", "password", "security", "system"] as const;
type Tab = typeof TABS[number];

export function SettingsClient() {
  const { hasPermission } = useUser();
  const router = useRouter();
  const sp = useSearchParams();
  const canManageSystem = hasPermission("settings.update");

  const raw = sp.get("tab");
  const initial: Tab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as Tab) : "profile";
  const [tab, setTab] = React.useState<Tab>(initial);

  React.useEffect(() => {
    if (raw !== tab) {
      const next = new URLSearchParams(sp.toString());
      next.set("tab", tab);
      router.replace(`/settings?${next.toString()}`, { scroll: false });
    }
  }, [tab, raw, sp, router]);

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Manage your profile, security and system preferences" />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="security">Two-factor</TabsTrigger>
          {canManageSystem ? <TabsTrigger value="system">System</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="profile"><ProfileSection /></TabsContent>
        <TabsContent value="password"><PasswordSection /></TabsContent>
        <TabsContent value="security"><MfaSection /></TabsContent>
        {canManageSystem ? <TabsContent value="system"><SystemSettingsSection /></TabsContent> : null}
      </Tabs>
    </div>
  );
}
