"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CONTENT_TYPES, CONTENT_TYPE_LABELS,
  PLATFORMS, PLATFORM_LABELS,
  FUNNEL_STAGES, FUNNEL_STAGE_LABELS, FUNNEL_STAGE_DESCRIPTIONS,
  type ContentType, type FunnelStage, type Platform,
} from "@/lib/constants";
import { Field } from "./field";
import { NONE, type ProjectOption, type WizardSetter, type WizardState } from "./types";

interface Props {
  state: WizardState;
  set: WizardSetter;
  projects: ProjectOption[];
  projectsLoading: boolean;
  canPostGeneral: boolean;
}

// Step 1: identifiers, project scope, format and funnel stage. Everything
// here drives downstream behaviour (the Media step uses contentType to filter
// the accept attribute, and the Copy step uses funnelStage for hint text).
export function StepBasics({ state, set, projects, projectsLoading, canPostGeneral }: Props) {
  const selectableProjects = React.useMemo(
    () => projects.filter((p) => !p.isGeneralMarketing),
    [projects],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Field label="Title" required>
          <Input
            value={state.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Compelling, clear headline"
          />
        </Field>
        <Field label="Short description" hint="Optional internal brief">
          <Textarea
            rows={3}
            value={state.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What is this content about? Who is it for?"
          />
        </Field>
        <Field
          label="Project"
          required
          hint={
            projectsLoading
              ? "Loading projects…"
              : selectableProjects.length === 0 && !canPostGeneral
                ? "You have not been assigned to any projects. Ask an administrator to grant project access."
                : "Choose the project this content belongs to."
          }
        >
          <div className="space-y-2">
            <Select
              value={state.project}
              onValueChange={(v) => {
                set("project", v);
                if (v !== NONE) set("isGeneralMarketing", false);
              }}
              disabled={state.isGeneralMarketing || projectsLoading || selectableProjects.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={selectableProjects.length === 0 ? "No projects available" : "Select project"} />
              </SelectTrigger>
              <SelectContent>
                {selectableProjects.map((p) => (
                  <SelectItem key={p._id} value={p._id}>{p.projectName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canPostGeneral ? (
              <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>General marketing</span>
                <Switch
                  checked={state.isGeneralMarketing}
                  onCheckedChange={(v) => { set("isGeneralMarketing", v); if (v) set("project", NONE); }}
                />
              </label>
            ) : null}
          </div>
        </Field>
      </div>

      <div className="space-y-4">
        <Field label="Content type" required>
          <Select value={state.contentType} onValueChange={(v) => set("contentType", v as ContentType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONTENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{CONTENT_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Platform" required>
          <Select value={state.platform} onValueChange={(v) => set("platform", v as Platform)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>{PLATFORM_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Funnel stage"
          required
          hint={state.funnelStage ? FUNNEL_STAGE_DESCRIPTIONS[state.funnelStage] : "Where in the customer journey does this piece live?"}
        >
          <Select
            value={state.funnelStage || ""}
            onValueChange={(v) => set("funnelStage", v as FunnelStage)}
          >
            <SelectTrigger><SelectValue placeholder="Pick a stage" /></SelectTrigger>
            <SelectContent>
              {FUNNEL_STAGES.map((s) => (
                <SelectItem key={s} value={s}>{FUNNEL_STAGE_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}
