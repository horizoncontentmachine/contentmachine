# ShortFlow

Web app locale single-user con canvas a blocchi per generare all'infinito **caroselli 9:16 (1080×1920)**: HOOK → SLIDE×N → CTA. Progetti salvati e riutilizzabili, varianti a costo AI zero.

## Avvio

```bash
cd shortflow
npm install            # solo la prima volta
# inserisci la chiave in .env.local:
#   OPENAI_API_KEY=sk-...
npm run dev            # → http://localhost:3000
```

> Nota: gli script npm usano `node node_modules/next/...` invece del nome del binario perché la cartella padre contiene `:` nel nome ("Mass IG : TikTok"), che rompe il PATH. Se rinomini la cartella senza i due punti, puoi tornare ai normali `next dev`.

## Blocchi

| Blocco | Cosa fa |
|---|---|
| **Prompt** | Il testo che descrive l'immagine. Si scrive direttamente sulla card. |
| **Immagine** | Genera con GPT Image 2 (1024×1536 → ritaglio 9:16). Ingressi: `prompt` + `ref` (fino a 16 immagini di riferimento). History con frecce ‹ › per confrontare le generazioni. |
| **Upload** | Una tua immagine dal disco. |
| **Testo** | Scritta stile TikTok (bold bianco su sfondo scuro). Resta un livello separato: si stampa solo in export, cambiarla è gratis. |
| **Carosello** | Slot Hook / Slide 1…N / CTA (opzionale) → export PNG numerati + ZIP. |
| **Varianti** | Dalla stessa base: lista di hook (uno per riga) e/o riordino slide (con slot bloccabili, seed riproducibile) → decine di caroselli, **zero AI**. |

Flusso tipico: `Prompt → Immagine → Testo → Carosello → Varianti`.

Il **Vault** (pannello destro) conserva prompt immagine e hook per nicchia; "usa" li inserisce nel blocco selezionato.

## Costi (stime in `src/lib/costs.ts`)

GPT Image 2 a 1024×1536: **Bozza ~$0.006** · Media ~$0.06 · Alta ~$0.21. Lavora in Bozza, passa ad Alta solo per il finale.

**Cache per hash**: stesso prompt+qualità+reference → l'immagine viene riusata, $0. Il contatore "Speso" somma solo le chiamate reali (storico in `data/ledger.json`).

## Dove finiscono i file

```
shortflow/data/
  projects/        un JSON per progetto (grafo, settings)
  assets/files/    originali + versioni _norm 1080×1920 (cache per hash)
  exports/<progetto>/<timestamp_nome>/   PNG e ZIP, scaricabili anche dalla UI
```

Tutto locale, niente cloud, niente auth. La API key vive solo server-side.

## Scelte fatte (modificabili)

- 2:3 → 9:16 con **cover-crop centrale** (si perde ~15% sui lati: meglio prompt con soggetto centrale).
- Storage JSON su file, niente DB.
- Overlay flattenato server-side via SVG (sharp); il preview browser usa lo stesso algoritmo di layout → WYSIWYG.
- `scripts/smoke.ts` testa la pipeline senza AI: `node node_modules/tsx/dist/cli.mjs scripts/smoke.ts`.
- La parte video (animazioni, video-carosello) è stata rimossa per concentrarsi sui caroselli; si può reintrodurre in seguito.
