import type { Platform } from "../types";

// Interfaccia comune dei provider di pubblicazione (pluggable): oggi Upload-Post.
// Un "profilo" del provider = un singolo account collegato lato ShortFlow.

export interface PublishImage {
  filename: string;
  bytes: Uint8Array;
  type: string; // es. image/png
}

export interface PublishResult {
  ok: boolean;
  providerPostId?: string;
  raw?: unknown;
  error?: string;
}

export interface ProviderProfile {
  username: string;
  connected: { platform: Platform; handle?: string }[];
}

export interface ProfileStats {
  platform: Platform;
  followers: number;
  reach: number;
  views: number;
  impressions: number;
}

export interface PostStats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  postUrl?: string;
}

export interface Publisher {
  name: string;
  // assicura che il profilo esista lato provider
  ensureProfile(profile: string): Promise<void>;
  // URL ospitato per collegare un account (OAuth del provider) a quel profilo
  connectUrl(profile: string, redirectUrl: string, platforms?: Platform[]): Promise<string>;
  // elenco profili con i loro account collegati
  getProfiles(): Promise<ProviderProfile[]>;
  // pubblica un carosello di foto su un profilo/piattaforma
  publishPhotos(args: { profile: string; platforms: Platform[]; images: PublishImage[]; caption: string }): Promise<PublishResult>;
  // analytics
  getProfileAnalytics(profile: string, platforms: Platform[]): Promise<ProfileStats[]>;
  getPostAnalytics(requestId: string, platform: Platform): Promise<PostStats | null>;
}
