# Lavanda / redazione e dati

## Stato verificabile

Il repository contiene un backend reale, senza dipendenze runtime, per Vercel Functions e un database Supabase **dedicato a Lavanda**. Il database non è stato creato, collegato o modificato durante questo lavoro: gli altri progetti disponibili appartengono ad applicazioni diverse. Senza configurazione, le operazioni remote restituiscono `503 SETUP_REQUIRED`, senza simulare un salvataggio. La modalità di studio locale della dashboard è distinta dalla redazione connessa.

Sono implementati articoli, pagine, quaderni/fanzine, stati editoriali e programmazione, versioni concorrenti, revisioni automatiche, note di ricerca private, categorie e tag, caricamento e catalogazione media, permessi di pubblicazione degli asset, impostazioni del sito, menu, SEO, archivio redirect, moderazione dei commenti, profili e ruoli, registro delle modifiche e analytics aggregate. È una base editoriale sviluppata per Lavanda; non è una dichiarazione di parità con l'intero ecosistema plugin di WordPress.

Le pubblicazioni programmate diventano leggibili all'orario previsto grazie al filtro temporale del database: non serve un cron. Lo stato visualizzato rimane `scheduled` finché la redazione lo cambia. La cancellazione di articoli e commenti li sposta nel cestino. Le revisioni contengono il testo e i metadati editoriali; le note private hanno il salvataggio atomico con l'articolo, ma non una propria cronologia.

Restano dipendenti dall'attivazione dei servizi: accesso reale, persistenza condivisa, caricamento file su Storage e misurazioni del traffico. Non sono inclusi una piattaforma di newsletter/spedizione email, integrazioni con le statistiche dei social, un marketplace plugin o una verifica del ripristino dei backup gestiti. Gli account si creano nel servizio Auth del progetto dedicato e si attivano nella redazione; nessuna chiamata dell'app usa chiavi `service_role` o `sb_secret`.

## Attivazione del progetto dedicato

1. Creare o identificare il progetto Supabase dedicato a Lavanda nell'organizzazione scelta dal titolare. Non riutilizzare database di altri progetti.
2. Eseguire **una sola volta** `database/bootstrap.sql` nel SQL Editor del progetto nuovo. Il file è transazionale e intenzionalmente non idempotente: un errore annulla il bootstrap. Crea le tabelle e le impostazioni iniziali, **non importa i testi locali**. Prima di collegare il sito, completare la procedura di importazione qui sotto. Non è una migrazione già applicata. Quando il database sarà disponibile, usare il flusso Supabase `db pull` per registrare la migrazione iniziale e i successivi cambiamenti.
3. In Authentication disattivare le registrazioni pubbliche per questa redazione, mantenere la conferma email e configurare le protezioni/rate limit Auth. Creare l'account di Martina con email confermata e una password scelta fuori dal repository. Nessuna password va inviata in chat, salvata nei sorgenti o inserita nei log.
4. Attivare il primo amministratore dal SQL Editor, sostituendo l'email:

```sql
update public.cms_profiles
set role = 'admin', active = true, display_name = 'Martina'
where id = (
  select id from auth.users
  where lower(email) = lower('EMAIL_DI_MARTINA')
    and email_confirmed_at is not null
);
```

5. Configurare in Vercel le variabili illustrate in `.env.example`: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `APP_ORIGIN` esatto. Per altre preview autorizzate usare `CMS_ALLOWED_ORIGINS` con origini complete separate da virgole; niente wildcard. `VERCEL_URL` viene ammessa automaticamente per il deployment corrente. Le variabili sono lette dalle Functions: non diventano file JavaScript pubblici.
6. Per le analytics generare un segreto casuale di almeno 32 caratteri, configurarlo come `CMS_ANALYTICS_KEY` in Vercel e inserirlo nel database con lo stesso valore:

```sql
insert into private.cms_secrets(name, value)
values ('analytics_hmac', 'SEGRETO_CASUALE_DI_ALMENO_32_CARATTERI');
```

7. Fare un redeploy affinché le Functions ricevano le nuove variabili. Verificare `/api/config`, accedere da `/admin/`, creare una bozza, salvarla, ricaricarla, pubblicarla e leggerla dal sito; poi togliere la pubblicazione e controllare che il contenuto non sia più leggibile. Caricare un'immagine, pubblicare il media e usarlo come copertina. Eseguire gli advisor Supabase e correggere eventuali segnalazioni prima dell'apertura della redazione.
8. Dopo la configurazione eseguire `node --env-file=.env.local scripts/cms-verify.mjs`: controllo remoto di sola lettura, senza password, senza creare contenuti. Con `CMS_ACCESS_TOKEN` opzionale verifica anche la sessione autenticata; non stampa il token.

I nuovi utenti Auth ricevono un profilo `viewer` **inattivo**: una registrazione non conferisce alcun accesso. Un amministratore deve attivarli e scegliere il ruolo. Il codice verifica il profilo aggiornato a ogni richiesta; non usa `user_metadata` per autorizzare. Non si può disattivare o declassare il proprio account amministratore.

## Importazione iniziale dei testi e collegamento degli asset

`scripts/seed-cms.mjs` importa `public/admin/seed.json` nel progetto Lavanda già inizializzato. Il comando predefinito è un controllo **locale, senza rete e senza scritture**:

```sh
npm run cms:seed
```

Il seed attuale contiene quattro articoli, tre pagine (manifesto, progetto e shop), un quaderno con quattro pagine e quattro asset. Tutti gli otto contenuti sono **bozze** con `seo.noindex=true`: l’importazione conserva questi valori. Dopo il collegamento del database il sito pubblico legge soltanto le pubblicazioni; importare le bozze rende i testi disponibili nella redazione, ma **non li pubblica**. Prima di aprire il sito, rivedere e pubblicare esplicitamente i testi desiderati dalla dashboard, e adeguare `seo.noindex` dopo la revisione.

Gli asset ottimizzati possono essere distribuiti direttamente dal sito con i percorsi `/assets/…`: il rinvio di R2 non blocca l’importazione dei testi. Quando disponibili sul bucket **Cloudflare R2 già usato da DOGO**, gli URL verificati possono essere forniti nella mappa opzionale descritta sotto. Il comando seed controlla i file locali (formato, firma, dimensioni e hash), ma non esegue upload, non chiama le API Storage e non certifica la disponibilità remota degli asset. Le copertine rimangono percorsi locali oppure diventano URL HTTPS in `metadata.cover_url`, con `cover_media_id=null`: non vengono creati record `cms_media` che dichiarino oggetti Supabase inesistenti. Questo passaggio riguarda il seed iniziale; non configura né sostituisce l’endpoint generale di upload della dashboard.

Per l’esecuzione reale, predisporre in un processo di manutenzione controllato le seguenti variabili, tramite il gestore dei segreti. Non scrivere chiavi in file, repository, chat, log, URL o argomenti della riga di comando:

| Variabile | Valore richiesto |
| --- | --- |
| `SUPABASE_URL` | Origine HTTPS del progetto dedicato, senza percorsi, query o credenziali |
| `LAVANDA_CMS_PROJECT_REF` | Identificativo dello stesso progetto presente nell’hostname; evita di importare nel progetto sbagliato |
| `SUPABASE_SECRET_KEY` | Chiave privilegiata server `sb_secret_…`, riservata a questa manutenzione |
| `SUPABASE_SERVICE_ROLE_KEY` | Alternativa legacy alla secret key; deve essere un JWT con ruolo `service_role` |
| `LAVANDA_CMS_AUTHOR_ID` | UUID del profilo amministratore **attivo** cui assegnare i testi importati |
| `LAVANDA_CMS_ASSET_MAP` | Opzionale: oggetto JSON completo che associa ciascun percorso locale del seed al suo URL pubblico HTTPS R2 permanente e già verificato, senza query, frammenti o firme temporanee. Se assente, conserva `/assets/…` |

Esempio della sola mappa **non segreta**, con dominio e chiavi da sostituire con gli URL effettivi:

```json
{
  "/assets/manifesto.webp": "https://media.example.org/lavanda/manifesto.webp",
  "/assets/botanical.webp": "https://media.example.org/lavanda/botanical.webp",
  "/assets/ritual.webp": "https://media.example.org/lavanda/ritual.webp",
  "/assets/tarot.webp": "https://media.example.org/lavanda/tarot.webp"
}
```

Le chiavi privilegiate sono usate soltanto dallo script di manutenzione. Non aggiungerle alle variabili del sito o alle Functions: l’applicazione continua a usare la chiave publishable e la sessione dell’utente. Il Data API richiede grant espliciti anche al ruolo server; dopo il bootstrap eseguire nel SQL Editor del progetto dedicato questo blocco per l’importatore:

```sql
grant usage on schema private to service_role;
grant execute on function private.cms_role() to service_role;
grant select on public.cms_profiles to service_role;
grant select, insert on public.cms_entries, public.cms_taxonomies, public.cms_settings to service_role;
```

Non sono necessari grant su Storage, note private, audit o revisioni per questo script. I grant sullo schema `private` permettono al trigger di validazione già presente di verificare il ruolo corrente; non rendono pubblico lo schema. I progetti Supabase nuovi richiedono l’esposizione esplicita delle tabelle, distinta dalle policy RLS. La procedura segue la documentazione corrente su [chiavi server](https://supabase.com/docs/guides/getting-started/api-keys) e [grant del Data API](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

Con l’ambiente pronto, validare il seed e l’eventuale mappa e poi applicare:

```sh
npm run cms:seed -- --dry-run
npm run cms:seed -- --apply
```

`--apply` controlla prima il profilo amministratore e legge i record esistenti. Gli identificativi sono UUID deterministici; i contenuti si confrontano per `(type, slug)` e le tassonomie per `(kind, slug)`. Gli inserimenti usano `resolution=ignore-duplicates`: un record esistente mantiene testo, stato, identità e modifiche redazionali. Le impostazioni create dal bootstrap vengono conservate; titolo, sottotitolo e descrizione del seed si inseriscono solo se il record singleton manca. Un’interruzione può lasciare una parte dei record già importata: ripetere lo stesso comando completa i mancanti senza cancellare o aggiornare gli esistenti. Non è una transazione unica fra tutte le richieste REST.

Lo script normalizza il vecchio campo `cover_alt` in `image_alt` e converte gli eventuali riferimenti del sommario ai UUID effettivi, anche quando un articolo con lo stesso slug esiste già. Le note private nel seed vengono rifiutate: si gestiscono dalla redazione. Il seed attuale ha pagine fanzine testuali; eventuali pagine con `media_id` vengono rifiutate finché il modello non supporta le immagini esterne R2 nelle singole pagine. L’importazione server non simula un utente Auth e non genera revisioni o audit attribuiti a Martina; i successivi salvataggi nella redazione producono la normale cronologia.

Al termine verificare nella dashboard tutti gli otto testi, le copertine locali o R2 e il quaderno, ricaricando i record dal database. Per il sito pubblico verificare anche che le bozze restino escluse e che solo i contenuti effettivamente pubblicati siano leggibili. Rimuovere la chiave privilegiata dall’ambiente di manutenzione quando non serve più. L’importatore non ripara contenuti già esistenti né aggiorna URL cambiati dopo la prima importazione: queste modifiche passano dalla redazione.

## Contratto HTTP

Tutte le risposte JSON hanno `Cache-Control: private, no-store`. Gli errori hanno forma `{"error":{"code":"…","message":"…"}}`. Le scritture richiedono `Content-Type: application/json`, l'origine esatta autorizzata e `X-CMS-Request: 1`; le chiamate del browser inviano automaticamente `Origin` e i cookie della sessione. `/api/event` non richiede l'header CMS ma controlla l'origine.

| Endpoint | Funzione |
| --- | --- |
| `GET /api/config` | Stato della configurazione e limiti; nessuna chiave o credenziale |
| `GET /api/auth` | Sessione verificata: `{data:{user:{id,email},profile:{id,display_name,role,active,…}}}` |
| `POST /api/auth` | `{action:'login',email,password}`, `{action:'refresh'}` o `{action:'logout'}` |
| `GET /api/cms?resource=entries` | Raccolta privata `{data:[],count:n}` con `type`, `status`, `search`, `limit`, `offset` |
| `GET /api/cms?resource=entries&id=UUID` | Record privato `{data:entry}`, con `editorial_notes` |
| `POST /api/cms?resource=entries` | Nuovo contenuto; restituisce il record persistito |
| `PATCH /api/cms?resource=entries&id=UUID` | Campi da modificare **più `version`**; `409` se obsoleta |
| `DELETE /api/cms?resource=entries&id=UUID` | `{version:n}`; spostamento nel cestino |
| `GET /api/cms?resource=analytics&days=30` | Totali, serie giornaliere e pagine; risultati reali, zero se non ci sono dati |
| `POST /api/media` | `{filename,mime_type,content_base64,title,alt,folder}`; massimo 3 MB decodificati |
| `GET /api/media?id=UUID` | Bytes del file: pubblico solo se il media è stato pubblicato |
| `DELETE /api/media?id=UUID` | `{version:n}`; file privato, non usato come copertina, con controllo ruolo |
| `GET /api/public?resource=entries` | Articoli pubblici, con `type`, `slug`, `limit`, `offset` |
| `GET /api/public?resource=issues` | Alias dei contenuti `type=fanzine` pubblicati |
| `GET /api/public?resource=media` | Solo media pubblicati; URL dello stesso dominio |
| `GET /api/public?resource=settings` | Solo impostazioni editoriali pubbliche |
| `GET /api/public?resource=taxonomies` | Categorie e tag |
| `POST /api/event` | `{event:'pageview',path:'/blog/'}`; alias canonico `page_view` |

`/api/cms` accetta anche `media`, `taxonomies`, `settings`, `profiles`, `redirects`, `comments`, `revisions` e `audit`. Le revisioni e l'audit sono di sola lettura; `revisions` accetta il filtro `entry_id`. Le impostazioni sono un unico record iniziale. I nuovi media passano soltanto dall'upload; gli account si creano da Auth. Il numero massimo di record per pagina è 100.

Campi principali di un contenuto:

```json
{
  "type": "post",
  "title": "Titolo",
  "slug": "titolo",
  "excerpt": "Introduzione",
  "body": "Testo o Markdown, sempre interpretato come testo sicuro",
  "status": "draft",
  "cover_media_id": null,
  "category_id": null,
  "tags": ["simboli"],
  "seo": {"title":"", "description":"", "canonical":"", "noindex":false},
  "metadata": {"subtitle":"", "cover_url":"/assets/ritual.webp", "image_alt":"", "category_name":"", "source_status":"", "source_note":"Nota fonte pubblica"},
  "editorial_notes": "Nota di ricerca privata, mai restituita dall'API pubblica",
  "published_at": null,
  "fanzine_pages": []
}
```

Gli stati sono `draft`, `review`, `scheduled`, `published`, `archived`, `trash`. Una fanzine usa `type:'fanzine'`, `metadata.issue_number` (anche la stringa `'00'`), `metadata.article_ids` ordinati e, quando presenti, `fanzine_pages:[{title,body,media_id,layout}]`; i layout ammessi sono `text`, `photo`, `cover`, `quote`. Copertine e pagine della fanzine devono riferirsi a media pubblicati prima di pubblicare il quaderno.

Il formato del corpo è una **stringa**, non HTML affidabile. Il renderer deve fare escaping del contenuto prima di applicare un eventuale sottoinsieme Markdown. I metadati accettano solo chiavi note e URL HTTPS o percorsi interni validati. `metadata.source_note` è una nota fonte **pubblica**: le annotazioni di lavoro vanno in `editorial_notes`, conservate nella tabella separata `cms_entry_notes`, senza privilegi `anon`.

## Permessi e persistenza

| Ruolo attivo | Lettura redazione | Scrittura | Pubblicazione | Impostazioni e utenti |
| --- | --- | --- | --- | --- |
| admin | Tutta, compreso audit | Tutta | Sì | Sì |
| editor | Tutta, escluso audit | Contenuti, media, tassonomie e moderazione | Sì | No |
| author | Redazione, escluso audit | Solo propri contenuti in bozza/revisione/cestino e propri media privati | No | No |
| viewer | Sola lettura, escluso audit | No | No | No |

Tutte le tabelle pubbliche CMS hanno Row Level Security, con `USING` e `WITH CHECK` sulle modifiche. Ogni richiesta al Data API usa il token dell'utente verificato; nessun passaggio usa privilegi globali. Le poche funzioni `SECURITY DEFINER` risiedono nello schema `private`, hanno un `search_path` vuoto e privilegi revocati per default: lookup del solo ruolo corrente, trigger interni di audit/revisioni/profili e ingestione analytics protetta da HMAC. Le funzioni REST pubbliche sono `SECURITY INVOKER`.

Per i contenuti `cms_save_entry` rende atomici lock, controllo versione, aggiornamento, revisione e salvataggio della nota privata. L'API risponde soltanto dopo la conferma del database. Le altre raccolte usano un filtro atomico `id + version`, con incremento lato database. Nessun errore remoto viene trasformato in un successo locale.

Storage è un bucket privato. Un record `cms_media.published=true` abilita la lettura pubblica; titoli e crediti non concedono accesso a file in bozza. Le policy vietano di eliminare o ricreare un oggetto finché esiste il record media corrispondente, impedendo a un autore di sostituire un file già pubblicato. Niente sovrascrittura/upsert. Sono ammessi JPEG, PNG, WEBP, GIF, AVIF e PDF, con controllo dei byte iniziali e del MIME; SVG, HTML e script non sono caricabili. I PDF vengono restituiti come allegati con CSP sandbox. Il limite di 3 MB evita di superare il payload delle Functions con la codifica base64.

## Analytics

L'app conserva contatori giornalieri per percorso ed evento, non eventi individuali. Non invia né salva IP, user agent, impronte, cookie identificativi, referrer o query string. Rispetta `DNT:1` e `Sec-GPC:1`. I provider di hosting mantengono separatamente i propri log infrastrutturali secondo la loro configurazione.

Eventi ammessi: `page_view`/`pageview`, `article_open`, `fanzine_open`, `download`, `outbound_click`. L'API firma ogni incremento con HMAC e scadenza di 60 secondi. Il database rifiuta anche firme o timestamp nulli e applica un tetto globale di 600 incrementi/minuto senza identificare il visitatore; è un contenimento degli abusi, non un conteggio di persone uniche o sessioni. Il tasso non distingue individui e non rende immuni dal traffico artificiale. I dati aggregati si conservano per 400 giorni, con pulizia all'arrivo di nuovi eventi. Il grafico espone contatori, non percentuali o metriche inventate.

## Verifica svolta e limiti

`node --test tests/cms.test.mjs`: test di API e sicurezza con fetch simulato, coprendo configurazione assente, credenziali privilegiate, origine/CSRF, dimensioni input, URL/XSS, ruoli, ownership, pubblicazione, MIME/file, cookie, JWT non verificati, profili inattivi, conflitti di versione, filtri pubblici e privacy analytics.

`node --test tests/cms-seed.test.mjs`: nove test con REST simulato, sul seed e sugli asset locali reali. Verificano dry run senza rete, URL R2 completi e HTTPS, assenza di chiamate Storage, conservazione delle bozze e delle modifiche già presenti, ripresa di un’importazione interrotta, conversione degli identificativi, controllo del profilo amministratore e mancata esposizione dei dettagli remoti o delle credenziali negli errori. Nessun database Supabase o bucket R2 reale è stato contattato da questi test.

`tests/cms-database.test.mjs`: suite opzionale su PostgreSQL WASM PGlite 0.3.14 in ambiente temporaneo, con fixture delle sole tabelle Auth/Storage. Esegue lo schema, le policy RLS, i trigger, le revisioni, il salvataggio atomico, la visibilità delle bozze, l'isolamento delle note e l'immutabilità dei file pubblicati. La funzione crittografica pgcrypto è simulata in questa sola fixture; l'HMAC effettivo è testato in Node. La suite non dimostra la disponibilità del progetto Supabase remoto né sostituisce i suoi advisor o il collaudo dopo l'attivazione.

Sono stati consultati il changelog Supabase del 15 ottobre 2026 e la documentazione corrente Auth, chiavi API, RLS e Storage. Il cambiamento TLS 1.2 del 10 novembre 2026 non coinvolge il runtime Node 22 usato qui; non usiamo adapter deprecati, `auth.role()` o Management API analytics obsolete.
