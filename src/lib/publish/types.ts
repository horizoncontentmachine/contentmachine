import type { Platform } from "../types";

// Interfaccia comune dei provider di pubblicazione (pluggable): oggi Upload-Post,
// domani altri, senza toccare il resto dell'app.

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

export interface Publisher {
  name: string;
  // assicura che esista il "profilo" lato provider per questo progetto
  ensureProfile(projectId: string): Promise<void>;
  // URL ospitato a cui mandare l'utente per collegare gli account (OAuth del provider)
  connectUrl(projectId: string, redirectUrl: string, platforms?: Platform[]): Promise<string>;
  // quali piattaforme risultano collegate per questo progetto
  listConnections(projectId: string): Promise<{ platform: Platform; handle?: string }[]>;
  // pubblica un carosello di foto sulle piattaforme indicate
  publishPhotos(args: {
    projectId: string;
    platforms: Platform[];
    images: PublishImage[];
    caption: string;
  }): Promise<PublishResult>;
}
