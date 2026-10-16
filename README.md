# Lavanda — THE RIOT WITCH

Il progetto editoriale di Martina. Tarocchi e archetipi, alchimia, antropologia e politica, botanica attraversano sito, blog, atlante e digital fanzine.

## Avvio

Node.js 22 o successivo. Nessuna dipendenza esterna per il sito o il CMS.

```sh
npm run build
npm run check
npm run dev
```

`build` genera le pagine statiche in `dist/`. Il server locale serve anche gli handler API per lavorare sul CMS.

## Vercel

Repository: `dobrogeanuedward/lavanda-bymarty`. Il file `vercel.json` imposta build `npm run build`, output `dist`, URL pulite e intestazioni di sicurezza. Gli handler in `api/` sono funzioni Node.js Vercel. Non servono variabili d’ambiente per mostrare il sito e lo studio locale; il CMS condiviso richiede il database dedicato descritto in `docs/cms-backend.md` e `.env.example`.

Il progetto è alla prima revisione: le pagine sono intenzionalmente `noindex` finché i testi e la direzione saranno definiti. Per la pubblicazione editoriale rimuovere questa impostazione nel template e in `robots.txt` e impostare il dominio definitivo nelle impostazioni SEO.

## Contenuti e pubblicazione

- `content/manifesto-original.md` conserva integralmente il testo fornito da Martina.
- `content/articles.json` contiene una selezione originale e tre studi redazionali riconoscibili come tali.
- `public/assets/` contiene fotografie e un arcano generati per il progetto. Prompt e provenienza sono in `docs/image-prompts.md`.
- `public/brand/` sviluppa la bozza della boccetta fornita da Martina; `public/brand-v1/` conserva la direzione precedente per il confronto.
- `/studio/` raccoglie identità, fotografia e primi formati social; `/admin/` apre il CMS.
- In modalità connessa il sito legge dal database e rende sul server le letture pubblicate, il blog, le pagine gestite e la fanzine. Le bozze e i contenuti rimossi non vengono serviti. Senza database resta disponibile il quaderno iniziale statico.

Il frontend legge il corpo dei nuovi scritti come testo/Markdown semplice, senza eseguire HTML proveniente dal CMS. I percorsi editoriali usano rendering server quando il database è collegato: testo e metadati dei singoli contenuti seguono la pubblicazione senza dover ricostruire il sito.

## Direzione

Il nome della rivista è **Lavanda** e il suo payoff è **THE RIOT WITCH**, in entrambe le direzioni visive 01 e 02. La bozza di Martina guida la ricerca del marchio: boccetta, cerchio aperto e lettering irregolare.

**La bottega della speziale** è l’insegna dell’area **Botanica**; **Strega di quartiere** appartiene a questa area. Nel sito il modulo della Bottega è distinto dal masthead di Lavanda. L’atlante e i percorsi editoriali comprendono anche Tarocchi e archetipi, alchimia, antropologia e politica. La prima direzione resta conservata per il confronto.

La firma generativa di dieci punti e ventidue percorsi vive in `src/geometry.mjs`. È un’interpretazione grafica contemporanea, non la ricostruzione di un diagramma tradizionale; il seed creativo non viene usato per funzioni di sicurezza.

## Limiti della prima versione

La base CMS copre il lavoro editoriale previsto dal progetto. La parità con l’intero ecosistema WordPress (plugin, temi di terzi, decenni di integrazioni) non è una caratteristica verificata. Il salvataggio condiviso, l’accesso multiutente, gli upload remoti e le analytics reali richiedono la configurazione del database dedicato e il collaudo degli account effettivi.

Vedi `docs/` per sistema di marca, fonti editoriali, immagini e configurazione del CMS. I font locali sono derivati da URW Base35; la licenza con eccezione per i font è inclusa in `public/fonts/LICENSE.txt`.

## Scrittura sulla pagina e vetrina

Dal CMS, «Modifica sulla pagina» apre `/admin/live.html`: titolo e capitoli editabili nell'impaginato, formattazione, blocchi trascinabili, immagini, gallery e larghezze da moodboard. Il contenuto strutturato viene reso dallo stesso modulo del sito pubblico. In locale salva su questo dispositivo; la pubblicazione condivisa richiede Supabase attivo. Immagini in ingresso fino a 40 MB vengono ridotte nel browser; gli upload persistenti attuali restano entro 3 MB. Audio e video si inseriscono tramite URL autorizzato.

`/shop/` è una vetrina editoriale, con pagina CMS modificabile e collezioni in preparazione. Nessun prodotto, prezzo o carrello inventato. Lo switch 01/02 confronta le due identità, con payoff globale **THE RIOT WITCH**; la bottega/Strega di quartiere è soltanto il mondo Botanica.

R2 DOGO è predisposto con inventario, varianti WebP/AVIF e verifica degli oggetti. L'upload è stato rinviato; il sito usa asset locali ottimizzati finché non esiste `content/asset-manifest.json` verificato. L'inventario pendente è locale e ignorato da Git. Contesto e decisioni sono raccolti in `docs/project-context.md`.
