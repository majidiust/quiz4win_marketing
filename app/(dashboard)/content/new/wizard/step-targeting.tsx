"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Combobox, type ComboboxItem } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITIES, type Priority } from "@/lib/constants";
import { COUNTRIES, LANGUAGES } from "@/lib/i18n-data";
import { Field } from "./field";
import type { WizardSetter, WizardState } from "./types";

interface Props {
  state: WizardState;
  set: WizardSetter;
}

// Step 4: schedule, priority and audience targeting. Country/language use the
// searchable Combobox so contributors don't have to remember ISO codes.
export function StepTargeting({ state, set }: Props) {
  const countryItems: ComboboxItem[] = React.useMemo(
    () =>
      COUNTRIES.map((c) => ({
        value: c.code,
        label: c.name,
        hint: c.code,
        keywords: c.code,
        leading: <span aria-hidden className="text-base leading-none">{c.flag}</span>,
      })),
    [],
  );

  const languageItems: ComboboxItem[] = React.useMemo(
    () =>
      LANGUAGES.map((l) => ({
        value: l.code,
        label: l.name,
        hint: l.code.toUpperCase(),
        keywords: `${l.code} ${l.nativeName ?? ""}`,
      })),
    [],
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Language">
        <Combobox
          value={state.language}
          onChange={(v) => set("language", v)}
          items={languageItems}
          placeholder="Select language"
          searchPlaceholder="Search language…"
        />
      </Field>
      <Field label="Country">
        <Combobox
          value={state.targetCountry}
          onChange={(v) => set("targetCountry", v)}
          items={countryItems}
          placeholder="Select country"
          searchPlaceholder="Search country…"
        />
      </Field>
      <Field label="Audience" hint="Persona or segment this targets">
        <Input
          value={state.targetAudience}
          onChange={(e) => set("targetAudience", e.target.value)}
          placeholder="e.g. quiz enthusiasts 18-34"
        />
      </Field>
      <Field label="Priority">
        <Select value={state.priority} onValueChange={(v) => set("priority", v as Priority)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Campaign name">
        <Input
          value={state.campaignName}
          onChange={(e) => set("campaignName", e.target.value)}
          placeholder="Optional"
        />
      </Field>
      <Field label="Campaign goal">
        <Input
          value={state.campaignGoal}
          onChange={(e) => set("campaignGoal", e.target.value)}
          placeholder="Optional"
        />
      </Field>
      <Field label="Planned publish date" hint="You can change this later from the content page">
        <Input
          type="datetime-local"
          value={state.publishDate}
          onChange={(e) => set("publishDate", e.target.value)}
        />
      </Field>
    </div>
  );
}
