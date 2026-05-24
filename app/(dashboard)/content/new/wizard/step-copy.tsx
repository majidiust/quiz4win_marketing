"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FUNNEL_STAGE_DESCRIPTIONS } from "@/lib/constants";
import { Field } from "./field";
import type { WizardSetter, WizardState } from "./types";

interface Props {
  state: WizardState;
  set: WizardSetter;
}

// Step 2: the actual marketing copy. The funnel-stage description is shown as
// a guidance banner so the writer keeps the goal in mind while drafting.
export function StepCopy({ state, set }: Props) {
  return (
    <div className="space-y-4">
      {state.funnelStage ? (
        <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Goal: </span>
          {FUNNEL_STAGE_DESCRIPTIONS[state.funnelStage]}
        </div>
      ) : null}

      <Field label="Caption / body" hint="Main copy that will be published">
        <Textarea
          rows={6}
          value={state.caption}
          onChange={(e) => set("caption", e.target.value)}
          placeholder="Write the main caption / body copy here"
        />
      </Field>
      <Field label="Short caption" hint="A condensed version for previews, thumbnails, or push notifications">
        <Textarea
          rows={2}
          value={state.shortCaption}
          onChange={(e) => set("shortCaption", e.target.value)}
          placeholder="One-liner / preview text"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Hashtags" hint="Space or comma separated">
          <Input
            value={state.hashtags}
            onChange={(e) => set("hashtags", e.target.value)}
            placeholder="#brand #campaign"
          />
        </Field>
        <Field label="Call to action">
          <Input
            value={state.cta}
            onChange={(e) => set("cta", e.target.value)}
            placeholder="Shop now, Learn more…"
          />
        </Field>
      </div>
      <Field label="Target URL" hint="Destination link, if any">
        <Input
          value={state.targetUrl}
          onChange={(e) => set("targetUrl", e.target.value)}
          placeholder="https://…"
        />
      </Field>
    </div>
  );
}
