# Automazione end-to-end: dalla creazione contenuti alla pubblicazione

Due layer complementari:
- **ShortFlow + Upload-Post** = contenuti (caroselli 9:16/4:5/1:1) + **pubblicazione via API ufficiale** (no ban da device, server-side).
- **DuoPlus (Device farm)** = **creazione + warmup + "liveness"** degli account a scala (cloud phone reali-simulati, proxy, RPA, SMS).

## Pipeline completa
1. **Provisioning** (DuoPlus): `cloudPhone/purchase` → `initProxy` (proxy SOCKS5 dedicato + locale/SIM/brand) → `app/install` (IG/TikTok) → `cloudNumber/purchase` (numero per il paese).
2. **Creazione account** (DuoPlus RPA): template custom di registrazione che apre l'app, compila, e legge il codice via `cloudNumber/smsList`. (Template creato una volta in console; schedulato via `addTask`/`addPlan`.)
3. **Warmup** (DuoPlus RPA, ricorrente con `addPlan`): vedi recipe sotto.
4. **Conversione** a Business/Creator (IG) + collegamento via OAuth/QR a Upload-Post (autorizzato dal cloud phone → IP del device).
5. **Contenuti** (ShortFlow): genera caroselli + varianti per piattaforma.
6. **Pubblicazione** (ShortFlow → Upload-Post): calendario + cron, 2-3/giorno per account.
7. **Insight** (ShortFlow): metriche da Upload-Post → dashboard.

## Recipe warmup (gradiente, per account)
Obiettivo: sembrare umano, alzare la fiducia prima di pubblicare/mettere link. Da realizzare come **template RPA "warming"** schedulato come Loop Task giornaliero.

- **Giorni 1-3 (consumo):** apri app, scrolla feed 5-10 min, guarda video interi, 3-8 like, segui 2-5 account a tema, completa bio/foto profilo. Nessun post, nessun link.
- **Giorni 4-7:** 1 storia o 1 like-burst leggero, salva qualche post, 1 commento generico. Ancora niente link in bio.
- **Settimana 2:** 1 post/giorno (via API o RPA), link in bio se serve, cadenza bassa.
- **Settimana 3-4:** sali a 2/giorno; da qui la pubblicazione passa al calendario ShortFlow.
- **Sempre:** un IP/SIM per account, mai far interagire fra loro i tuoi account, orari variati.

## Cosa è automatizzabile DALLA dashboard (oggi, via /api/duoplus)
- Cloud phone: lista, crea (a pagamento), accendi/spegni/riavvia, info, ADB, modifica params.
- App: catalogo, installa/avvia/chiudi.
- Proxy: lista, aggiungi (SOCKS5), verifica.
- RPA: lista template ufficiali/custom, **pianifica task/loop** (warmup) su N telefoni, log esecuzione.
- Numeri: lista, acquista (a pagamento), leggi SMS/codici.
- Media: push file sui device (per la pubblicazione nativa).

## Limiti onesti
- I **template RPA custom** si creano in **console** DuoPlus (l'API li referenzia per id). Quindi il "cosa fa" del warmup lo definisci là una volta; ShortFlow lo **schedula e monitora**.
- **AI Agent** DuoPlus: solo UI, non API.
- Fingerprint **simulati** → rischio detection: è il gioco del volume, metti in conto attrito.
- Azioni a pagamento (purchase, powerOn, numbers) richiedono conferma esplicita nel pannello.
