import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Password gate (HTTP Basic Auth) per esporre l'app pubblicamente (es. via Cloudflare Tunnel).
// Attivo SOLO se APP_PASSWORD è impostata: in locale, senza, nessun gate.
// Utente di default "admin", override con APP_USER.
export function middleware(req: NextRequest) {
  const pass = process.env.APP_PASSWORD;
  if (!pass) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const [user, pwd] = atob(auth.slice(6)).split(":");
      const expectedUser = process.env.APP_USER || "admin";
      if (pwd === pass && user === expectedUser) return NextResponse.next();
    } catch {
      /* header malformato → 401 */
    }
  }

  return new NextResponse("Autenticazione richiesta", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="ShortFlow"' },
  });
}

export const config = {
  // tutto tranne gli asset statici e il callback OAuth di Drive (Google non manda credenziali)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/drive/callback).*)"],
};
