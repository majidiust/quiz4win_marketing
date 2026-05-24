"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { UserRole, UserStatus } from "@/lib/constants";
import type { Permission } from "@/lib/rbac";

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  profileImage?: string | null;
  assignedProjects?: string[];
  mfaEnabled: boolean;
  status: UserStatus;
  lastLoginAt?: string | null;
}

interface UserContextValue {
  user: SessionUser | null;
  permissions: Permission[];
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (p: Permission) => boolean;
}

const UserContext = React.createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [permissions, setPermissions] = React.useState<Permission[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        setUser(null);
        setPermissions([]);
        return;
      }
      const data = await res.json();
      setUser(data.user as SessionUser);
      setPermissions(data.permissions as Permission[]);
    } catch {
      setUser(null);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = React.useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setPermissions([]);
    router.replace("/login");
  }, [router]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const value: UserContextValue = {
    user,
    permissions,
    loading,
    refresh,
    logout,
    hasPermission: (p) => permissions.includes(p),
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = React.useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
