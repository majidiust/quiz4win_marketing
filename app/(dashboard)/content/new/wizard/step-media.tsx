"use client";

import * as React from "react";
import Image from "next/image";
import { Loader2, Plus, X, FileText, Music, Video as VideoIcon } from "lucide-react";
import { toast } from "sonner";
import {
  CONTENT_TYPE_MEDIA_KINDS, MEDIA_KIND_ACCEPT, MEDIA_KIND_LABELS,
} from "@/lib/constants";
import { api } from "@/lib/fetcher";
import { formatBytes } from "@/lib/utils";
import type { WizardSetter, WizardState, WizardMedia } from "./types";

interface Props {
  state: WizardState;
  set: WizardSetter;
  userId?: string;
}

// Step 3: upload assets that fit the chosen content type. Files are uploaded
// directly to S3 under drafts/<userId>/ via a presigned PUT and registered in
// the MediaFile collection; the final POST attaches the resulting media refs.
export function StepMedia({ state, set, userId }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const allowedKinds = CONTENT_TYPE_MEDIA_KINDS[state.contentType] || [];
  const accept = allowedKinds.map((k) => MEDIA_KIND_ACCEPT[k]).join(",");
  const allowsAny = allowedKinds.length > 0;

  async function onFiles(files: FileList | null) {
    if (!files || !files.length || !allowsAny) return;
    setUploading(true);
    try {
      const next: WizardMedia[] = [...state.media];
      for (const file of Array.from(files)) {
        const presign = await api<{ uploadUrl: string; key: string; publicUrl: string }>("/api/media/presign", {
          json: {
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            prefix: `drafts/${userId || "anon"}`,
          },
        });
        const put = await fetch(presign.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });
        if (!put.ok) throw new Error(`Upload failed for ${file.name}`);
        const reg = await api<{ media: { _id: string; url: string; mimeType: string; thumbnailUrl?: string } }>("/api/media", {
          json: {
            storageKey: presign.key,
            url: presign.publicUrl,
            originalFilename: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
          },
        });
        next.push({
          mediaFile: reg.media._id,
          url: reg.media.url,
          thumbnailUrl: reg.media.thumbnailUrl || "",
          mimeType: reg.media.mimeType,
          altText: "",
          order: next.length,
          originalFilename: file.name,
          size: file.size,
        });
      }
      set("media", next);
      toast.success("Uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(i: number) {
    set("media", state.media.filter((_, j) => j !== i).map((m, idx) => ({ ...m, order: idx })));
  }

  if (!allowsAny) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        This content type does not require any media.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Accepted: </span>
        {allowedKinds.map((k) => MEDIA_KIND_LABELS[k]).join(" • ")}
      </div>

      <div className="flex flex-wrap gap-3">
        {state.media.map((m, i) => (
          <div key={`${m.url}-${i}`} className="group relative h-28 w-28 overflow-hidden rounded-lg border bg-muted">
            {m.mimeType.startsWith("image/") ? (
              <Image src={m.url} alt={m.altText || ""} fill className="object-cover" unoptimized sizes="112px" />
            ) : m.mimeType.startsWith("video/") ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                <VideoIcon className="h-6 w-6" />
                <span className="px-1 text-[10px] truncate">{m.originalFilename}</span>
              </div>
            ) : m.mimeType.startsWith("audio/") ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                <Music className="h-6 w-6" />
                <span className="px-1 text-[10px] truncate">{m.originalFilename}</span>
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                <FileText className="h-6 w-6" />
                <span className="px-1 text-[10px] truncate">{m.originalFilename}</span>
              </div>
            )}
            {m.size ? (
              <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1 py-px text-[10px] text-muted-foreground">
                {formatBytes(m.size)}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute right-1 top-1 rounded-full bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
          <span>{uploading ? "Uploading…" : "Add media"}</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
    </div>
  );
}
