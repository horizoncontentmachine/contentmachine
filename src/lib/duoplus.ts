import { resolveDuoplusKey } from "./settings";

// Client DuoPlus (cloud phone). Base https://openapi.duoplus.net, auth header DuoPlus-API-Key,
// tutto POST + JSON, envelope {code,data,message}, 1 richiesta/sec per endpoint.
const BASE = "https://openapi.duoplus.net";

export interface DuoResp<T = unknown> {
  code: number;
  data: T;
  message: string;
}

export async function duoplusConfigured(): Promise<boolean> {
  return !!(await resolveDuoplusKey());
}

export async function duoplusCall<T = unknown>(path: string, body: Record<string, unknown> = {}): Promise<DuoResp<T>> {
  const key = await resolveDuoplusKey();
  if (!key) throw new Error("Chiave DuoPlus mancante: aggiungila in Impostazioni");
  const r = await fetch(`${BASE}/api/v1/${path.replace(/^\//, "")}`, {
    method: "POST",
    headers: { "DuoPlus-API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await r.json().catch(() => ({ code: r.status, data: null, message: "risposta non valida" }))) as DuoResp<T>;
  return j;
}

// Mappa azione-dashboard → endpoint DuoPlus. Solo questi sono richiamabili dal browser.
export const DUOPLUS_ACTIONS: Record<string, string> = {
  // cloud phone
  "phones.list": "cloudPhone/list",
  "phones.status": "cloudPhone/status",
  "phones.info": "cloudPhone/info",
  "phones.powerOn": "cloudPhone/powerOn",
  "phones.powerOff": "cloudPhone/powerOff",
  "phones.restart": "cloudPhone/restart",
  "phones.command": "cloudPhone/command",
  "phones.initProxy": "cloudPhone/initProxy",
  "phones.update": "cloudPhone/update",
  "phones.purchase": "cloudPhone/purchase",
  // risorse
  "models.list": "mobile/modelList",
  "timezones.list": "mobile/timezoneList",
  "languages.list": "mobile/languageList",
  // app
  "apps.catalog": "app/list",
  "apps.installed": "app/installedList",
  "apps.install": "app/install",
  "apps.start": "app/start",
  "apps.stop": "app/stop",
  // proxy
  "proxies.list": "proxy/list",
  "proxies.add": "proxy/add",
  "proxies.check": "proxy/check",
  "proxies.delete": "proxy/delete",
  // gruppi
  "groups.list": "cloudPhone/groupList",
  "groups.create": "cloudPhone/createGroup",
  "groups.addPhones": "cloudPhone/addToGroup",
  // automation / RPA
  "templates.official": "automation/officialTemplateList",
  "templates.custom": "automation/userTemplateList",
  "plans.list": "automation/planList",
  "plans.add": "automation/addPlan",
  "plans.setStatus": "automation/setPlanStatus",
  "plans.delete": "automation/deletePlan",
  "tasks.list": "automation/taskList",
  "tasks.add": "automation/addTask",
  "tasks.log": "automation/taskLogList",
  // numeri / sms
  "numbers.list": "cloudNumber/numberList",
  "numbers.sms": "cloudNumber/smsList",
  "numbers.package": "cloudNumber/package",
  "numbers.purchase": "cloudNumber/purchase",
  // cloud drive
  "drive.list": "cloudDisk/list",
  "drive.push": "cloudDisk/pushFiles",
  // subscription / ordini
  "subscription.list": "subscriptionStartup/list",
  "subscription.purchase": "subscriptionStartup/purchase",
  "orders.list": "team/order",
};

// Azioni che SPENDONO denaro o avviano fatturazione → richiedono conferma esplicita.
export const DUOPLUS_COSTLY = new Set<string>([
  "phones.purchase",
  "phones.powerOn",
  "numbers.purchase",
  "subscription.purchase",
]);
