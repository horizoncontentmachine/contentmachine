// Mini-worker dedicato al cron: ogni pochi minuti "sveglia" l'app principale,
// che pubblica i post programmati ormai dovuti.
// Usa un service binding (APP) verso il worker principale: il modo corretto per
// chiamare un altro Worker (evita l'errore 1042 dei fetch worker→worker via URL).

export interface Env {
  APP: { fetch: (input: Request | string, init?: RequestInit) => Promise<Response> };
  CRON_SECRET: string;
}

function tick(env: Env): Promise<Response> {
  return env.APP.fetch("https://app/api/cron/tick", {
    method: "POST",
    headers: { "x-cron-secret": env.CRON_SECRET },
  });
}

export default {
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
    ctx.waitUntil(tick(env).catch(() => {}));
  },
  async fetch(_req: Request, env: Env): Promise<Response> {
    const r = await tick(env);
    return new Response(await r.text(), { status: r.status, headers: { "content-type": "application/json" } });
  },
};
