# Lavanda — La bottega della speziale

Il progetto editoriale di Martina. Sito, blog, atlante, digital fanzine, identità e studio di gestione.

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

La bozza di Martina guida il marchio: boccetta, cerchio aperto, lettering irregolare, insegna «La bottega della speziale» e firma «Strega di quartiere». La prima direzione precedente resta documentata, senza sovrapporre i due sistemi.

La firma generativa di dieci punti e ventidue percorsi vive in `src/geometry.mjs`. È un’interpretazione grafica contemporanea, non la ricostruzione di un diagramma tradizionale; il seed creativo non viene usato per funzioni di sicurezza.

## Limiti della prima versione

La base CMS copre il lavoro editoriale previsto dal progetto. La parità con l’intero ecosistema WordPress (plugin, temi di terzi, decenni di integrazioni) non è una caratteristica verificata. Il salvataggio condiviso, l’accesso multiutente, gli upload remoti e le analytics reali richiedono la configurazione del database dedicato e il collaudo degli account effettivi.

Vedi `docs/` per sistema di marca, fonti editoriali, immagini e configurazione del CMS. I font locali sono derivati da URW Base35; la licenza con eccezione per i font è inclusa in `public/fonts/LICENSE.txt`.
