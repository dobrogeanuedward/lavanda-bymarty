# Lavanda Studio

Accesso: `/admin/`.

## Direzione dell’interfaccia

Lo spazio di redazione riprende l’articolazione di DOGO FRAME: sidebar compatta, area principale ampia, azioni esplicite, ricerca e filtri a pillola, raccolte fotografiche, dialoghi di dettaglio. Sono stati letti il markup e i fogli di stile pubblici di FRAME e il documento pubblico della demo DOGO DESK Orologi Famosi. Palette Studio: superficie perla `#f5f6f8`, pannelli bianchi, testo `#191b20`, grigi neutri, azione blu `#2464ea`. Il tema scuro è disponibile. Le componenti amministrative rimangono distinte dalla voce visiva della rivista.

## Funzioni implementate

- Panoramica con conteggi calcolati dai contenuti effettivi, ultimi aggiornamenti e cronologia delle operazioni di questa sessione/spazio. Nessun numero di lettori o collaboratore inventato.
- Articoli, pagine e numeri della fanzine; ricerca per titolo, sommario e slug, filtri per stato e tipo, duplicazione, cestino e ripristino delle voci remote. Eliminazione definitiva solo nel locale.
- Editor testuale con inserimento di blocchi Markdown (sezione, paragrafo, citazione, elenco, immagine, separatore), anteprima sicura e senza HTML arbitrario, parole e tempo di lettura, note editoriali private, categoria, tag, copertina e campi SEO. Non è un editor visuale WYSIWYG.
- Bozze locali con salvataggio automatico e revisioni; salvataggio remoto esplicito e su navigazione, con controllo della versione. Un conflitto mantiene aperto l’editor e le modifiche non salvate. Il salvataggio fallito non viene convertito in un successo locale.
- Libreria media con caricamento multiplo, trascinamento, ricerca, filtri per cartella/formato, descrizione alternativa, didascalia, credito e cartella. Formati: JPEG, PNG, WebP, GIF, AVIF, PDF; massimo 3 MB/file. I file locali sono in IndexedDB, separati dai metadati JSON. I file remoti utilizzano l’API protetta. Stato pubblico/privato dei media remoto e controlli sulle copertine o pagine che li usano.
- Composizione della digital fanzine: numero, titolo, sottotitolo, sequenza ordinabile di articoli e pagine autonome con layout testo, foto, copertina o citazione; scelta media e riordino delle pagine.
- Categorie/tag con aggiunta, modifica, slug e descrizione. Le categorie in uso non possono essere eliminate dall’interfaccia. I tag delle singole voci sono stringhe libere: rinominare una tassonomia tag non riscrive automaticamente le stringhe negli articoli.
- Analytics vere: eventi aggregati, grafico a linea azzurra, pagine più lette, periodi 7/30/90 giorni ed esportazione CSV. Finché non è collegata la raccolta, i KPI mostrano `—` e il grafico espone uno stato vuoto. Non si contano persone uniche.
- Conversazioni: elenco dei commenti presenti nel database e moderazione approvato/spam/cestino. Nessun commento demo. L’interfaccia non simula un modulo pubblico di raccolta.
- Persone e ruoli: visualizzazione dei profili reali; amministrazione di nome, ruolo e stato di accesso per chi ha i permessi. I nuovi account si creano nel servizio Authentication; non si simulano inviti, email o creazioni di account.
- Impostazioni: nome, sottotitolo, descrizione, Instagram, SEO generale, menu ordinabile, reindirizzamenti. Esportazione JSON dei metadati/contenuti e importazione aggiuntiva di bozze nello spazio locale. Gli originali media e gli account non sono inclusi nel backup JSON.
- Layout adattivo, menu mobile, link per saltare al contenuto, etichette accessibili, focus visibile, dialoghi nativi con Escape, scorciatoia Ctrl/Cmd+S, rispetto della preferenza di movimento ridotto.

## Locale e CMS collegato

In assenza di configurazione appare sempre il banner **Anteprima locale — modifiche salvate su questo dispositivo**. Lo spazio locale usa la chiave `lavanda-studio-v1`; i file sono in `lavanda-studio-media`. Non pubblica sul sito, non ha utenti veri e non produce analytics simulate. I dati possono essere persi cancellando l’archiviazione del browser. Un errore di quota viene mostrato come salvataggio fallito e invita all’esportazione.

Quando `/api/config` conferma la configurazione, l’utente può accedere tramite `/api/auth`. La sessione è in cookie HttpOnly. Le richieste mutative includono `X-CMS-Request: 1`. L’interfaccia legge tutte le raccolte a pagine di 100 elementi. Le operazioni remote inviano solo i campi scrivibili previsti dal contratto e la versione corrente per PATCH/DELETE.

I dati locali e remoti rimangono separati: l’accesso non carica automaticamente le bozze locali. Un fallimento di accesso/caricamento non riscrive i dati remoti nel locale. L’importazione durevole dal seed è gestita dagli strumenti di migrazione del repository, non da un pulsante che finga una sincronizzazione.

I ruoli sono applicati dal backend e dalle policy del database. Le note editoriali sono `entries.editorial_notes`; non vanno messe in `metadata.source_note`, che appartiene al contenuto pubblico. La UI mantiene il controllo di versione e non accetta chiavi di servizio.

## Seed della prima apertura

L’interfaccia richiede `/admin/seed.json` solo quando non esiste già uno spazio locale:

```json
{
  "entries": [{"id":"seed-il-ritmo-perduto","type":"post","title":"Il ritmo perduto","slug":"il-ritmo-perduto","excerpt":"…","body":"## Sezione\n\nTesto…","status":"draft","tags":[],"metadata":{"category_name":"Manifesto","cover_url":"/assets/manifesto.webp"},"seo":{"noindex":true},"version":1}],
  "media": [{"id":"seed-manifesto","title":"Materia","public_url":"/assets/manifesto.webp","alt":"…","mime_type":"image/webp","folder":"Studio fotografico"}],
  "issues": [{"id":"seed-numero-00","type":"fanzine","title":"Il ritmo perduto","slug":"numero-00","status":"draft","body":"…","metadata":{"issue_number":"00","article_ids":["seed-il-ritmo-perduto"]},"fanzine_pages":[]}],
  "taxonomies": [{"id":"seed-manifesto-category","name":"Manifesto","slug":"manifesto","kind":"category","description":""}],
  "settings": {"site_title":"Lavanda","tagline":"The riot witch","navigation":[]}
}
```

Il lettore supporta anche i file sorgente `{articles, fanzine}`. Gli ID `seed-*` valgono soltanto nel locale. Gli ID remoti sono generati dal database e sono UUID.

## Verifiche svolte e limiti

Verificato `node --check` sul modulo. Smoke test in VM per otto viste, editor, analytics vuote, escaping e URL sicuri, scrittura locale e versioni, serializzazione dei payload con validatore reale del backend, isolamento su errore remoto. Non è stato possibile eseguire un browser grafico locale: non è installato un binario Chromium/Firefox e non ne è stato scaricato uno. Occorre ancora collaudare il flusso completo con database configurato, browser reale, account dei diversi ruoli e pubblicazione Vercel.

Il modulo è una prima implementazione sostanziale del CMS, non una parità verificata con l’ecosistema WordPress. Restano fuori: sistema di plugin/temi, editor visuale completo, collaborazione simultanea con presenza, inviti account via UI, builder di moduli pubblici, gestione newsletter, libreria con ritagli/trasformazioni immagini, traduzioni, formati di import/export WordPress, restore automatico dei binari media e backup infrastrutturali. Le raccolte commenti richiedono un canale pubblico configurato per ricevere contributi. Le impostazioni pubbliche e i redirect dipendono dal lettore pubblico del sito.
