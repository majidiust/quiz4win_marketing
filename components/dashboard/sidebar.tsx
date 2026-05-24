"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navSections, type NavItem } from "./nav-config";
import { useUser } from "@/components/providers/user-provider";
import { publicEnv } from "@/lib/env";
import { Sparkles, X } from "lucide-react";

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { permissions } = useUser();

  const isActive = (item: NavItem) =>
    item.match ? item.match(pathname) : pathname === item.href;

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (i) => !i.permission || permissions.includes(i.permission)
      ),
    }))
    .filter((s) => s.items.length > 0);

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-white/5 px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">{publicEnv.appName}</span>
              <span className="text-[10px] uppercase tracking-wide text-white/50">
                Marketing Ops
              </span>
            </div>
          </Link>
          <button
            type="button"
            className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={onMobileClose}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {visibleSections.map((section, i) => (
            <div key={i} className={cn(i > 0 && "mt-6")}>
              {section.label ? (
                <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {section.label}
                </div>
              ) : null}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onMobileClose}
                        className={cn(
                          "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-sidebar-accent text-white shadow-sm"
                            : "text-white/70 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-white/60 group-hover:text-white")} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/5 px-5 py-3 text-[11px] text-white/40">
          v0.1 · {new Date().getFullYear()} BingoBingo
        </div>
      </aside>
    </>
  );
}
