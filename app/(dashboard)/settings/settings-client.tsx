"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { useUser } from "@/components/providers/user-provider";
import { ProfileSection } from "./profile-section";
import { PasswordSection } from "./password-section";
import { MfaSection } from "./mfa-section";
import { SystemSettingsSection } from "./system-section";

export function SettingsClient() {
  const { hasPermission } = useUser();
  const canManageSystem = hasPermission("settings.update");

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Manage your profile, security and system preferences" />
      <Tabs defaultValue="profile" className="w-full">
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
