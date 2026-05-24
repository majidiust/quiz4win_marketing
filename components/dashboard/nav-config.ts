import {
  LayoutDashboard,
  FileText,
  CalendarDays,
  FolderKanban,
  Users,
  Activity,
  Settings,
  Sparkles,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/rbac";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
  match?: (pathname: string) => boolean;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/briefs", label: "Briefs", icon: ClipboardList, permission: "briefs.read.own", match: (p) => p.startsWith("/briefs") },
      { href: "/content", label: "Content Library", icon: FileText, match: (p) => p === "/content" || p.startsWith("/content/") },
      { href: "/calendar", label: "Calendar", icon: CalendarDays, permission: "calendar.read" },
      { href: "/content/new", label: "Create Content", icon: Sparkles, permission: "content.create" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/projects", label: "Projects", icon: FolderKanban, permission: "projects.read" },
      { href: "/users", label: "Users", icon: Users, permission: "users.read" },
      { href: "/activity", label: "Activity Log", icon: Activity, permission: "activity.read" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/settings", label: "Settings", icon: Settings, match: (p) => p.startsWith("/settings") },
    ],
  },
];
