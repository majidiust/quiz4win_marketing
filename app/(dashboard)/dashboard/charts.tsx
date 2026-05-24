"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CONTENT_STATUS_LABELS, PLATFORM_LABELS, type ContentStatus, type Platform } from "@/lib/constants";

const STATUS_COLOR: Record<ContentStatus, string> = {
  generated: "#94a3b8",
  draft: "#64748b",
  under_review: "#f59e0b",
  approved: "#0ea5e9",
  rejected: "#ef4444",
  scheduled: "#6366f1",
  published: "#22c55e",
  deleted: "#94a3b8",
  failed: "#dc2626",
  archived: "#475569",
};

export function StatusChart({ data }: { data: { _id: ContentStatus; count: number }[] }) {
  const formatted = data.map((d) => ({
    name: CONTENT_STATUS_LABELS[d._id] || d._id,
    value: d.count,
    color: STATUS_COLOR[d._id] || "#64748b",
  }));
  if (formatted.length === 0) {
    return <Empty />;
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={formatted} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
            {formatted.map((entry, i) => (
              <Cell key={i} fill={entry.color} stroke="hsl(var(--background))" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PlatformChart({ data }: { data: { _id: Platform; count: number }[] }) {
  const formatted = data.map((d) => ({
    name: PLATFORM_LABELS[d._id] || d._id,
    count: d.count,
  }));
  if (formatted.length === 0) return <Empty />;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="name" fontSize={11} stroke="hsl(var(--muted-foreground))" />
          <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendsChart({ data }: { data: { _id: string; count: number }[] }) {
  const formatted = data.map((d) => ({ date: d._id, count: d.count }));
  if (formatted.length === 0) return <Empty />;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formatted}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="date" fontSize={11} stroke="hsl(var(--muted-foreground))" />
          <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#trendFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--card-foreground))",
};

function Empty() {
  return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No data yet.</div>;
}
