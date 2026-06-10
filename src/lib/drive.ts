import { google, type drive_v3 } from "googleapis";
import { Readable } from "stream";
import { getSettings, saveSettings } from "./db";

// Integrazione Google Drive (scope drive.file: l'app vede solo ciò che crea).
// Le credenziali OAuth (Client ID/Secret) e il refresh token vivono in data/settings.json.

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function appBaseUrl(): string {
  return (process.env.APP_URL || "http://localhost:3010").replace(/\/$/, "");
}

export function redirectUri(): string {
  return `${appBaseUrl()}/api/drive/callback`;
}

function creds(): { clientId?: string; clientSecret?: string } {
  const d = getSettings().drive;
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || d.clientId,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || d.clientSecret,
  };
}

export function driveCredsPresent(): boolean {
  const { clientId, clientSecret } = creds();
  return !!(clientId && clientSecret);
}

export function driveConnected(): boolean {
  return driveCredsPresent() && !!getSettings().drive.refreshToken;
}

function oauthClient() {
  const { clientId, clientSecret } = creds();
  if (!clientId || !clientSecret) {
    throw new Error("Credenziali Google mancanti: inseriscile in Impostazioni → Google Drive");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri());
}

export function getAuthUrl(): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forza il refresh_token
    scope: SCOPES,
  });
}

// Scambia il code del callback: salva refresh token + email collegata.
export async function exchangeCode(code: string): Promise<string> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  let email: string | undefined;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const me = await oauth2.userinfo.get();
    email = me.data.email ?? undefined;
  } catch {
    /* opzionale */
  }

  const drive = getSettings().drive;
  saveSettings({
    drive: {
      ...drive,
      refreshToken: tokens.refresh_token ?? drive.refreshToken,
      connectedEmail: email ?? drive.connectedEmail,
    },
  });
  return email ?? "";
}

export function disconnectDrive() {
  const d = getSettings().drive;
  saveSettings({ drive: { ...d, refreshToken: undefined, connectedEmail: undefined } });
}

function authedClient() {
  const d = getSettings().drive;
  if (!d.refreshToken) throw new Error("Google Drive non collegato");
  const client = oauthClient();
  client.setCredentials({ refresh_token: d.refreshToken });
  return client;
}

function driveApi(): drive_v3.Drive {
  return google.drive({ version: "v3", auth: authedClient() });
}

async function findOrCreateFolder(drive: drive_v3.Drive, name: string, parentId?: string): Promise<string> {
  const safe = name.replace(/'/g, "\\'");
  const q = [
    `mimeType='application/vnd.google-apps.folder'`,
    `name='${safe}'`,
    "trashed=false",
    parentId ? `'${parentId}' in parents` : "",
  ]
    .filter(Boolean)
    .join(" and ");
  const list = await drive.files.list({ q, fields: "files(id,name)", pageSize: 1 });
  const found = list.data.files?.[0]?.id;
  if (found) return found;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: "id",
  });
  return created.data.id!;
}

async function rootFolderId(drive: drive_v3.Drive): Promise<string> {
  const d = getSettings().drive;
  if (d.rootFolderId) return d.rootFolderId;
  const id = await findOrCreateFolder(drive, d.rootFolderName || "ShortFlow");
  saveSettings({ drive: { ...d, rootFolderId: id } });
  return id;
}

async function uploadPng(drive: drive_v3.Drive, name: string, buf: Buffer, parentId: string): Promise<void> {
  await drive.files.create({
    requestBody: { name, parents: [parentId] },
    media: { mimeType: "image/png", body: Readable.from(buf) },
    fields: "id",
  });
}

export interface DriveGroup {
  label: string; // es. C1.0
  files: { name: string; buf: Buffer }[]; // in ordine
}

// Struttura creata: <root>/<progetto>/<C{n}.{i}>/01_HOOK.png …
export async function pushGroupsToDrive(projectName: string, groups: DriveGroup[]): Promise<{ folderUrl: string }> {
  const drive = driveApi();
  const root = await rootFolderId(drive);
  const projectFolder = await findOrCreateFolder(drive, projectName || "Progetto", root);

  for (const g of groups) {
    const folder = await findOrCreateFolder(drive, g.label, projectFolder);
    for (const f of g.files) {
      await uploadPng(drive, f.name, f.buf, folder);
    }
  }

  return { folderUrl: `https://drive.google.com/drive/folders/${projectFolder}` };
}
