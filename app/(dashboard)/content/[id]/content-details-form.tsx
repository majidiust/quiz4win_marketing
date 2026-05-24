"use client";

import * as React from "react";
import Image from "next/image";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox, type ComboboxItem } from "@/components/ui/combobox";
import { api } from "@/lib/fetcher";
import {
  CONTENT_TYPES, CONTENT_TYPE_LABELS, PLATFORMS, PLATFORM_LABELS, PRIORITIES,
  FUNNEL_STAGES, FUNNEL_STAGE_LABELS,
  type ContentType, type FunnelStage, type Platform, type Priority,
} from "@/lib/constants";
import { COUNTRIES, LANGUAGES } from "@/lib/i18n-data";

export interface MediaRef {
  mediaFile?: string;
  url?: string;
  thumbnailUrl?: string;
  mimeType?: string;
  altText?: string;
  order?: number;
  // Server-injected, short-lived signed GET URL for displaying private objects.
  displayUrl?: string;
}

export interface EditableContent {
  title?: string;
  description?: string;
  internalReferenceId?: string;
  contentType?: ContentType;
  platform?: Platform;
  priority?: Priority;
  funnelStage?: FunnelStage;
  caption?: string;
  shortCaption?: string;
  hashtags?: string[];
  cta?: string;
  targetUrl?: string;
  language?: string;
  targetCountry?: string;
  targetAudience?: string;
  campaignName?: string;
  campaignGoal?: string;
  publishDate?: string;
  publishTime?: string;
  timezone?: string;
  storyText?: string;
  reelScript?: string;
  videoScript?: string;
  firstComment?: string;
  mentions?: string[];
  locationTag?: string;
  productTag?: string;
  linkInBioReference?: string;
  contentFormat?: string;
  designNotes?: string;
  brandGuidelinesNotes?: string;
  complianceNotes?: string;
  altText?: string;
  aspectRatio?: string;
  duration?: number;
  fileRequirements?: string;
  mediaFiles?: MediaRef[];
}

interface Props {
  doc: EditableContent & { _id: string; publishDate?: string };
  editable: boolean;
}

function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export const ContentDetailsForm = React.forwardRef<{ getValues: () => Partial<EditableContent> }, Props>(
  function ContentDetailsForm({ doc, editable }, ref) {
    const [form, setForm] = React.useState(() => ({
      title: doc.title || "",
      description: doc.description || "",
      internalReferenceId: doc.internalReferenceId || "",
      contentType: (doc.contentType || "instagram_post") as ContentType,
      platform: (doc.platform || "instagram") as Platform,
      priority: (doc.priority || "normal") as Priority,
      funnelStage: (doc.funnelStage || "") as FunnelStage | "",
      caption: doc.caption || "",
      shortCaption: doc.shortCaption || "",
      hashtags: (doc.hashtags || []).join(" "),
      cta: doc.cta || "",
      targetUrl: doc.targetUrl || "",
      language: doc.language || "",
      targetCountry: doc.targetCountry || "",
      targetAudience: doc.targetAudience || "",
      campaignName: doc.campaignName || "",
      campaignGoal: doc.campaignGoal || "",
      publishDate: toLocalInput(doc.publishDate),
      publishTime: doc.publishTime || "",
      timezone: doc.timezone || "UTC",
      storyText: doc.storyText || "",
      reelScript: doc.reelScript || "",
      videoScript: doc.videoScript || "",
      firstComment: doc.firstComment || "",
      mentions: (doc.mentions || []).join(" "),
      locationTag: doc.locationTag || "",
      productTag: doc.productTag || "",
      linkInBioReference: doc.linkInBioReference || "",
      contentFormat: doc.contentFormat || "",
      designNotes: doc.designNotes || "",
      brandGuidelinesNotes: doc.brandGuidelinesNotes || "",
      complianceNotes: doc.complianceNotes || "",
      altText: doc.altText || "",
      aspectRatio: doc.aspectRatio || "",
      fileRequirements: doc.fileRequirements || "",
    }));
    const [media, setMedia] = React.useState<MediaRef[]>(doc.mediaFiles || []);

    function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
      setForm((f) => ({ ...f, [key]: value }));
    }

    const countryItems: ComboboxItem[] = React.useMemo(
      () => COUNTRIES.map((c) => ({
        value: c.code,
        label: c.name,
        hint: c.code,
        keywords: c.code,
        leading: <span aria-hidden className="text-base leading-none">{c.flag}</span>,
      })),
      [],
    );
    const languageItems: ComboboxItem[] = React.useMemo(
      () => LANGUAGES.map((l) => ({
        value: l.code,
        label: l.name,
        hint: l.code.toUpperCase(),
        keywords: `${l.code} ${l.nativeName ?? ""}`,
      })),
      [],
    );

    React.useImperativeHandle(ref, () => ({
      getValues: () => ({
        title: form.title,
        description: form.description,
        internalReferenceId: form.internalReferenceId,
        contentType: form.contentType,
        platform: form.platform,
        priority: form.priority,
        funnelStage: form.funnelStage || undefined,
        caption: form.caption,
        shortCaption: form.shortCaption,
        hashtags: form.hashtags ? form.hashtags.split(/[,\s]+/).map((s) => s.replace(/^#/, "")).filter(Boolean) : [],
        cta: form.cta,
        targetUrl: form.targetUrl,
        language: form.language,
        targetCountry: form.targetCountry,
        targetAudience: form.targetAudience,
        campaignName: form.campaignName,
        campaignGoal: form.campaignGoal,
        publishDate: form.publishDate ? new Date(form.publishDate).toISOString() : undefined,
        publishTime: form.publishTime,
        timezone: form.timezone,
        storyText: form.storyText,
        reelScript: form.reelScript,
        videoScript: form.videoScript,
        firstComment: form.firstComment,
        mentions: form.mentions ? form.mentions.split(/[,\s]+/).map((s) => s.replace(/^@/, "")).filter(Boolean) : [],
        locationTag: form.locationTag,
        productTag: form.productTag,
        linkInBioReference: form.linkInBioReference,
        contentFormat: form.contentFormat,
        designNotes: form.designNotes,
        brandGuidelinesNotes: form.brandGuidelinesNotes,
        complianceNotes: form.complianceNotes,
        altText: form.altText,
        aspectRatio: form.aspectRatio,
        fileRequirements: form.fileRequirements,
        mediaFiles: media,
      }),
    }), [form, media]);

    const disabled = !editable;
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle>Content</CardTitle><CardDescription>Main copy, hashtags and call to action</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Title"><Input disabled={disabled} value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
            <Field label="Short description"><Textarea disabled={disabled} rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
            <Field label="Caption / body"><Textarea disabled={disabled} rows={5} value={form.caption} onChange={(e) => set("caption", e.target.value)} /></Field>
            <Field label="Short caption"><Textarea disabled={disabled} rows={2} value={form.shortCaption} onChange={(e) => set("shortCaption", e.target.value)} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Hashtags" hint="Space or comma separated"><Input disabled={disabled} value={form.hashtags} onChange={(e) => set("hashtags", e.target.value)} /></Field>
              <Field label="Mentions" hint="Space or comma separated"><Input disabled={disabled} value={form.mentions} onChange={(e) => set("mentions", e.target.value)} /></Field>
              <Field label="CTA"><Input disabled={disabled} value={form.cta} onChange={(e) => set("cta", e.target.value)} /></Field>
              <Field label="Target URL"><Input disabled={disabled} value={form.targetUrl} onChange={(e) => set("targetUrl", e.target.value)} /></Field>
              <Field label="First comment"><Input disabled={disabled} value={form.firstComment} onChange={(e) => set("firstComment", e.target.value)} /></Field>
              <Field label="Link in bio ref"><Input disabled={disabled} value={form.linkInBioReference} onChange={(e) => set("linkInBioReference", e.target.value)} /></Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle>Classification</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Content type">
              <Select value={form.contentType} onValueChange={(v) => set("contentType", v as ContentType)} disabled={disabled}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTENT_TYPES.map((t) => <SelectItem key={t} value={t}>{CONTENT_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Platform">
              <Select value={form.platform} onValueChange={(v) => set("platform", v as Platform)} disabled={disabled}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{PLATFORM_LABELS[p]}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onValueChange={(v) => set("priority", v as Priority)} disabled={disabled}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Funnel stage">
              <Select
                value={form.funnelStage || ""}
                onValueChange={(v) => set("funnelStage", v as FunnelStage)}
                disabled={disabled}
              >
                <SelectTrigger><SelectValue placeholder="Pick a stage" /></SelectTrigger>
                <SelectContent>{FUNNEL_STAGES.map((s) => <SelectItem key={s} value={s}>{FUNNEL_STAGE_LABELS[s]}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Content format"><Input disabled={disabled} value={form.contentFormat} onChange={(e) => set("contentFormat", e.target.value)} placeholder="1080x1080, 9:16…" /></Field>
            <Field label="Aspect ratio"><Input disabled={disabled} value={form.aspectRatio} onChange={(e) => set("aspectRatio", e.target.value)} placeholder="1:1, 9:16, 16:9" /></Field>
            <Field label="Internal reference"><Input disabled={disabled} value={form.internalReferenceId} onChange={(e) => set("internalReferenceId", e.target.value)} /></Field>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle>Schedule &amp; targeting</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Planned publish date"><Input disabled={disabled} type="datetime-local" value={form.publishDate} onChange={(e) => set("publishDate", e.target.value)} /></Field>
            <Field label="Timezone"><Input disabled={disabled} value={form.timezone} onChange={(e) => set("timezone", e.target.value)} placeholder="UTC, America/Sao_Paulo…" /></Field>
            <Field label="Language">
              <Combobox
                value={form.language}
                onChange={(v) => set("language", v)}
                items={languageItems}
                placeholder="Select language"
                searchPlaceholder="Search language…"
                disabled={disabled}
              />
            </Field>
            <Field label="Country">
              <Combobox
                value={form.targetCountry}
                onChange={(v) => set("targetCountry", v)}
                items={countryItems}
                placeholder="Select country"
                searchPlaceholder="Search country…"
                disabled={disabled}
              />
            </Field>
            <Field label="Audience"><Input disabled={disabled} value={form.targetAudience} onChange={(e) => set("targetAudience", e.target.value)} /></Field>
            <Field label="Location tag"><Input disabled={disabled} value={form.locationTag} onChange={(e) => set("locationTag", e.target.value)} /></Field>
            <Field label="Campaign"><Input disabled={disabled} value={form.campaignName} onChange={(e) => set("campaignName", e.target.value)} /></Field>
            <Field label="Campaign goal"><Input disabled={disabled} value={form.campaignGoal} onChange={(e) => set("campaignGoal", e.target.value)} /></Field>
            <Field label="Product tag"><Input disabled={disabled} value={form.productTag} onChange={(e) => set("productTag", e.target.value)} /></Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle>Format-specific</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Story text"><Textarea disabled={disabled} rows={2} value={form.storyText} onChange={(e) => set("storyText", e.target.value)} /></Field>
            <Field label="Reel script"><Textarea disabled={disabled} rows={3} value={form.reelScript} onChange={(e) => set("reelScript", e.target.value)} /></Field>
            <Field label="Video script"><Textarea disabled={disabled} rows={3} value={form.videoScript} onChange={(e) => set("videoScript", e.target.value)} /></Field>
            <Field label="Alt text"><Input disabled={disabled} value={form.altText} onChange={(e) => set("altText", e.target.value)} /></Field>
            <Field label="File requirements"><Textarea disabled={disabled} rows={2} value={form.fileRequirements} onChange={(e) => set("fileRequirements", e.target.value)} /></Field>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-3"><CardTitle>Design &amp; compliance</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="Design notes"><Textarea disabled={disabled} rows={3} value={form.designNotes} onChange={(e) => set("designNotes", e.target.value)} /></Field>
            <Field label="Brand guidelines notes"><Textarea disabled={disabled} rows={3} value={form.brandGuidelinesNotes} onChange={(e) => set("brandGuidelinesNotes", e.target.value)} /></Field>
            <Field label="Compliance notes"><Textarea disabled={disabled} rows={3} value={form.complianceNotes} onChange={(e) => set("complianceNotes", e.target.value)} /></Field>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-3"><CardTitle>Media</CardTitle><CardDescription>Images and videos attached to this content</CardDescription></CardHeader>
          <CardContent>
            <MediaManager media={media} setMedia={setMedia} disabled={disabled} contentId={doc._id} />
          </CardContent>
        </Card>
      </div>
    );
  }
);

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function MediaManager({ media, setMedia, disabled, contentId }: { media: MediaRef[]; setMedia: React.Dispatch<React.SetStateAction<MediaRef[]>>; disabled: boolean; contentId: string }) {
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const presign = await api<{ uploadUrl: string; key: string; publicUrl: string }>("/api/media/presign", {
          json: { filename: file.name, contentType: file.type || "application/octet-stream", prefix: `content/${contentId}` },
        });
        const put = await fetch(presign.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
        if (!put.ok) throw new Error(`Upload failed for ${file.name}`);
        const reg = await api<{ media: { _id: string; url: string; mimeType: string; thumbnailUrl?: string; displayUrl?: string } }>("/api/media", {
          json: { storageKey: presign.key, url: presign.publicUrl, originalFilename: file.name, mimeType: file.type || "application/octet-stream", size: file.size },
        });
        setMedia((m) => [...m, { mediaFile: reg.media._id, url: reg.media.url, mimeType: reg.media.mimeType, thumbnailUrl: reg.media.thumbnailUrl || "", altText: "", order: m.length, displayUrl: reg.media.displayUrl || reg.media.url }]);
      }
      toast.success("Uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {media.map((m, i) => (
          <div key={`${m.url}-${i}`} className="group relative h-28 w-28 overflow-hidden rounded-lg border bg-muted">
            {m.mimeType?.startsWith("video/") ? (
              <video src={m.displayUrl || m.url} className="h-full w-full object-cover" muted />
            ) : (m.displayUrl || m.url) ? (
              <Image src={m.displayUrl || m.url || ""} alt={m.altText || ""} fill className="object-cover" unoptimized sizes="112px" />
            ) : null}
            {!disabled ? (
              <button type="button" onClick={() => setMedia((arr) => arr.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100" aria-label="Remove">
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        ))}
        {!disabled ? (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-muted disabled:opacity-50">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            <span>{uploading ? "Uploading…" : "Add media"}</span>
          </button>
        ) : null}
      </div>
      <input ref={inputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      {!media.length && disabled ? <p className="text-xs text-muted-foreground">No media attached.</p> : null}
    </div>
  );
}
