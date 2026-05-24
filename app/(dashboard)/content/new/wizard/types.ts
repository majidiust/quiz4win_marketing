import type { ContentType, FunnelStage, Platform, Priority } from "@/lib/constants";

export const NONE = "__none__";

export interface ProjectOption {
  _id: string;
  projectName: string;
  isGeneralMarketing?: boolean;
  defaultHashtags?: string[];
  defaultCTA?: string;
}

export interface WizardMedia {
  mediaFile?: string;
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  altText?: string;
  order: number;
  // Local-only fields used during the wizard, stripped before posting.
  originalFilename?: string;
  size?: number;
}

export interface WizardState {
  title: string;
  description: string;
  project: string;
  isGeneralMarketing: boolean;
  contentType: ContentType;
  platform: Platform;
  priority: Priority;
  funnelStage: FunnelStage | "";

  caption: string;
  shortCaption: string;
  hashtags: string;
  cta: string;
  targetUrl: string;

  language: string;
  targetCountry: string;
  targetAudience: string;
  campaignName: string;
  campaignGoal: string;
  publishDate: string;

  media: WizardMedia[];
}

export type WizardSetter = <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
