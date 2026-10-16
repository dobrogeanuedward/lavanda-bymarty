# Lavanda contesto del progetto e continuità del lavoro

Lavanda è il progetto di Martina. Il payoff è **THE RIOT WITCH**. Questa gerarchia vale per entrambe le direzioni visive. La bottega della speziale è un mondo della Botanica; «Strega di quartiere» riguarda quel mondo e non sostituisce il payoff di Lavanda.

## Origine e intenzione editoriale

Il progetto nasce come rivista culturale e ricerca interdisciplinare: antropologia, filosofia della natura, botanica, tradizioni esoteriche, tarocchi e lettura degli archetipi, alchimia, Cabala e Albero della Vita. Il manifesto propone il recupero della ciclicità rispetto al tempo lineare della prestazione, attraversando corporeità, critica sociale e politica, pari opportunità e trasformazione. Instagram, sito, blog e digital fanzine sono media della stessa ricerca.

Il manifesto originale fornito da Martina è conservato integralmente in `content/manifesto-original.md`, con una copia scaricabile dal sito. Il controllo del progetto verifica il suo hash: non deve essere riscritto. Le formulazioni del messaggio tecnico iniziale non definiscono il tono di voce; il manifesto ha precedenza. Le successive proposte redazionali sono dichiarate studi, senza attribuzioni di pubblicazione o autori inventati.

La prima fanzine prevede editoriale, manifesto, corrispondenze e simboli, viaggio del Matto e Ruota dell’Inverno, antropologia politica. Il documento originale non contiene il testo della scheda naturopatica annunciata nel sommario: questa parte non è stata inventata. Le note di ricerca distinguono analogia simbolica, tesi filosofica e affermazioni biologiche o storiche che richiedono documentazione.

## Le due identità

01 conserva la prima proposta del ritorno al centro: cerchio aperto, punto, logotipo editoriale, bianco e nero attraversati da pervinca, menta, giallo e rosa. Fotografia di luce, carta, vetro, materia e un primo arcano originale.

02 sviluppa lo sketch di Martina come una prima fase, da portare a un sistema rifinito e riproducibile. Non deve imitarne letteralmente l’esecuzione a mano. Il nome Lavanda, il simbolo della boccetta nell’orbita e l’insegna sono livelli distinti. L’insegna è un elemento autonomo con testo variabile, non il logo principale. La palette lavora con magenta, giallo, lilla, viola, bianco e nero.

Lo switch 01/02 nell’header confronta loghi, fotografia, colori, favicon e applicazioni senza cambiare i contenuti. La scelta si conserva nel browser. Il vecchio tentativo troppo letterale dello sketch resta archiviato in `docs/studies/sketch-translation` come passaggio superato.

Il mondo fotografico deve rimanere ampio: bottega e botanica sono una parte, insieme a archetipi, trasformazione, relazioni fra opposti, antropologia e politica. Il footer personale, le grandi illustrazioni originali, le cornici fotografiche e il movimento fanno parte del sistema. Il parallax rispetta il movimento ridotto e non interrompe la lettura.

## Sito e redazione

Il repository di lavoro è `dobrogeanuedward/lavanda-bymarty`; il progetto Vercel è `lavanda-bymarty` nel team di Edward. La prima versione è stata verificata online su `https://lavanda-bymarty.vercel.app`. Le modifiche successive vanno buildate, controllate e sincronizzate prima di considerarle pubblicate.

Il sito comprende home, blog, manifesto, atlante, digital fanzine, progetto, studio visivo e shop vetrina. Lo shop per ora presenta le future collezioni: non contiene prodotti, prezzi o disponibilità inventati e non abilita acquisti. La vendita completa resta una decisione successiva.

Il CMS è `/admin/`. La richiesta è un’esperienza naturale, simile a scrivere in Word ma dentro l’impaginato pubblico: click sul testo, capitoli visibili, barra sottile, blocchi trascinabili, immagini, gallery e composizioni da moodboard pubblicabili. L’editor sulla pagina è `/admin/live.html`; mantiene una struttura di capitoli e un formato strutturato sicuro, senza salvare HTML arbitrario.

Bozza, salvataggio e pubblicazione sono azioni distinte. In assenza di database le modifiche restano nel browser e la UI lo dichiara. I ruoli e la persistenza condivisa richiedono il backend effettivamente attivo. Non va promessa parità con l’intero ecosistema WordPress: la richiesta guida lo sviluppo della facilità d’uso e delle funzioni editoriali, non una dichiarazione non verificata.

## Servizi e autorizzazioni

Martina ha autorizzato la pubblicazione su Vercel anche senza CMS connesso e l’uso dell’organizzazione Supabase esistente di Edward per un progetto dedicato a Lavanda. Il connettore disponibile legge organizzazione e progetti, ma le operazioni di costo/creazione non sono esposte dal server. Nessun database di altri progetti è stato riutilizzato o modificato. Bootstrap SQL, seed idempotente e controlli di attivazione sono preparati; la redazione condivisa resta da attivare e collaudare.

Per gli asset la destinazione richiesta è il bucket R2 DOGO `dogostudio`, con prefisso dedicato `lavanda/`. Ottimizzazione WebP/AVIF, varianti responsive, inventario hashato e verifica di upload sono pronti. Il caricamento è stato rinviato esplicitamente da Martina quando non erano disponibili credenziali CLI e il browser non concedeva accesso ai file locali. Fino alla verifica del manifest, il sito continua a servire gli asset locali ottimizzati. Non presentare R2 come già attivo.

## Prossimo lavoro verificabile

Completare il controllo del live editing, il confronto delle due identità su desktop e mobile e il deploy aggiornato. Attivare Supabase dedicato quando l’accesso di scrittura sarà disponibile, importare i materiali e verificare salvataggio, ruoli, media, pubblicazione e ritiro. Riprendere R2 con credenziali già esistenti o upload autorizzato, verificare gli oggetti e solo allora attivare la distribuzione CDN. Definire i prodotti dello shop con Martina prima di aprire gli acquisti.

## Carta natale e Arcani — 16 ottobre 2026

Aggiunta `/carta-natale/`, raggiungibile da header, footer, home e Atlante/Arcani. Il modulo usa data, ora e località selezionata; il calcolo avviene nel browser con Astronomy Engine 2.1.19 (MIT, versione fissata). Zodiaco tropicale, coordinate geocentriche apparenti, dieci corpi, Ascendente, Medio Cielo, case a segno intero, cinque aspetti principali e moto retrogrado. La ruota SVG conserva le longitudini nelle tacche e distanzia solo le etichette. Stampa/PDF tramite browser e download SVG; nessun salvataggio dei dati di nascita sul server o nel localStorage.

`api/places.mjs` cerca nell'estratto GeoNames cities500 ospitato nel progetto: 236.192 località, archivio gzip circa 11,6 MiB, CC BY 4.0. Attribuzione nel sito e in `data/README.md`. Nessuna richiesta a geocodificatori esterni durante l'uso. Coordinate e fuso IANA possono essere confermati manualmente. Lo script di importazione è esplicito e non parte durante il build.

Le ore inesistenti vengono rifiutate; quelle duplicate richiedono una scelta di offset. Senza ora: intervallo della giornata civile e segni possibili, niente Ascendente/case/aspetti. Le date odierne escludono istanti futuri; avviso storico prima del 1970. Il metodo usa il database dei fusi del dispositivo, da verificare per ricostruzioni storiche particolari.

Ventidue studi illustrati SVG originali e schede italiane con domanda/pratica. Corrispondenze Golden Dawn verificate sulla tavola primaria di Benebell Wen, pp. 3–4, con numerazione RWS Forza VIII/Giustizia XI. Selezione editoriale Lavanda: segno Sole 3, Luna 2, Ascendente 2, complementi planetari Sole/Papessa 1; massimo cinque, deduplica e esclusione dei segni incerti. Il punteggio ordina i suggerimenti e non misura personalità o dominanti. Il sito distingue calcolo astronomico e linguaggio simbolico.

Verifica: benchmark indipendenti Swiss/Moshier, geometria dell'orizzonte, DST Roma/New York/Lord Howe, ore storiche e cuspidi/stazioni; browser desktop/mobile, ricerca, schede, doppia ora, ora ignota e reset. Nessun servizio a pagamento o nuovo account, nessuna modifica a Supabase/R2 o al manifesto originale.

## Esplorazione interattiva e responsive — 16 ottobre 2026

La ruota è ora interattiva: pianeti, dodici segni, Ascendente e Medio Cielo aprono pannelli con testi simbolici originali, contesto del segno e della casa effettiva, moto apparente e fino a tre aspetti più vicini per orbe. Ogni pannello contiene domande, Arcani espandibili e collegamenti ad altre posizioni. Sette pianeti classici hanno la corrispondenza Golden Dawn verificata; Urano, Nettuno e Plutone passano solo dall'Arcano del segno. Le posizioni incerte vengono trattate come possibilità, con case/aspetti omessi quando manca l'ora. Nessun nuovo servizio remoto o salvataggio di dati personali.

Selezione evidenziata sulla ruota e sugli aspetti connessi; Enter/Spazio e frecce per i controlli SVG, pulsanti HTML di almeno 44 px nell'elenco alternativo, selezione rapida da Sole/Luna/Ascendente e dalla tabella. Zoom 100–220% con scorrimento interno; vista ampia in dialog nativo, stessa istanza del grafico e stesso pannello, chiusura Escape, focus e posizione di lettura ripristinati. Il download rimane SVG statico.

QA carta a 320/390/768/1024/1440 px e dialog a 320/390/768/1440: nessun overflow orizzontale della pagina, zoom confinato al grafico, titoli visibili sotto l'intestazione fissa. Verificati selezione da grafico/tastiera, Arcani espandibili, cambio selezione, ora ignota all'equinozio, chiusura/reset e console pulita. Controllate anche home/Atlante/shop/blog/fanzine a 320/390/768 e tutte le pagine della fanzine: layout già corretto. Suite completa: 170 passati, 2 skip opzionali; 26 test letture/SVG ripassati dopo le ultime finiture.

## Osservatorio astronomico 3D — 16 ottobre 2026

Aggiunto `/osservatorio/`, collegato da header, footer, home e carta natale. Mostra Sole, otto pianeti e Luna tramite Astronomy Engine 2.1.19 e Three.js 0.186.1, entrambi locali e fissati. Posizioni geometriche simultanee, eclittica J2000, distanze lineari in AU; nessuna orbita circolare inventata. Luna relativa alla Terra nella vista locale e Sole rispetto al baricentro in una finestra di dodici anni, distinta da un periodo orbitale. Il moto galattico non è rappresentato.

Default tempo reale 1× UTC del dispositivo; selezione date 1900–2100, pausa/ripresa, accelerazioni fino a 30 giorni al secondo e Adesso. Dimensioni amplificate e dichiarate per la visibilità; opzione raggi fisici, sempre fisici nella vista Sole–baricentro. Superfici procedurali schematiche, poli/anelli orientati, luce dalla direzione solare con intensità diagrammatica. Nessuna rotazione quotidiana artificiale.

Rotazione e zoom della camera, selezione dei corpi, schede con dati fisici e distanze aggiornate, tabella delle coordinate, viste dedicate e dialog espanso accessibile. Il modello funziona in WebGL 2; il fallback mantiene dati e schede. Nessun nuovo servizio remoto, asset fotografico o dato personale. Fonti e benchmark indipendenti JPL Horizons in `docs/solar-science.md`.

QA del modello su Chrome e browser interno; layout a 320/390/768/844 orizzontale/1060/1440 px senza overflow della pagina, data UTC2000 verificata nelle coordinate, pausa stabile, modalità fisica e selezione dal grafico. Suite completa: 190 test passati, 0 fallimenti, 2 skip opzionali; build, 909 riferimenti e manifesto originale verificati.

## Carta natale e sistema solare collegati — 16 ottobre 2026

Dopo il calcolo, il risultato apre il sistema solare 3D all’UTC autorevole `chart.meta.utc`, fermo. Il selettore “Sistema solare 3D / Ruota astrale” e la vista ampia condividono un solo pannello di lettura. Sole, Luna e sette pianeti comuni richiamano esattamente `describeSelection` e gli stessi Arcani della ruota; selezione, evidenza e ritorno alla mappa restano sincronizzati. La selezione nella ruota viene ritrovata e centrata riaprendo il 3D.

“Terra e Luna” mostra la traiettoria lunare geocentrica intorno alla Terra. Selezionare la Luna inquadra l’intera coppia e l’orbita, invece di isolare una sfera e tagliare la traiettoria; il comportamento vale anche nell’osservatorio. Le distanze restano lineari, i raggi amplificati sono dichiarati e la modalità fisica è disponibile. La Terra ha una scheda di riferimento senza segno o Arcano attribuito. Plutone, segni, Ascendente e Medio Cielo rimangono esplorabili nella ruota e nelle letture; non vengono sostituiti da corpi del modello.

La mappa 3D usa coordinate geometriche eliocentriche J2000; la carta usa coordinate apparenti geocentriche della data. Condividono l’istante, non il riferimento, come dichiarato nel dettaglio “Un istante, due sguardi”. Senza ora, il 3D è etichettato come istante rappresentativo della giornata, anche nei nomi accessibili; le letture mantengono segni incerti e Arcani condizionali. Nessun dato di nascita viene passato all’osservatorio tramite URL o salvato. Cambio dati, ricalcolo e reset cancellano il vecchio canvas, annullano le traiettorie pendenti e rimuovono i dati del risultato.

Il motore solare ammette il 31 dicembre 1899 UTC per le nascite locali del primo gennaio 1900 in fusi positivi; controlli temporali dell’osservatorio ancora 1900–2100. Nessun clamp o ricostruzione dell’UTC. Verifica browser reale in Chrome e browser interno: Roma1990 UTC12:30, Luna/Arcani identici passando alla ruota, raycaster, drag/zoom, dialog, date storiche, ora ignota all’equinozio, ricalcolo e reset. Responsive a 320/390/768/1440 px e 844 orizzontale, senza overflow di pagina o dialog. Suite: 200 passati, 0 fallimenti, 2 skip opzionali; 911 riferimenti locali e manifesto originale verificati.

## Calendario orbitale, mesi e botaniche — 16 ottobre 2026

L’osservatorio apre ora la vista “Calendario terrestre”: dodici mesi civili UTC sull’effettivo percorso eliocentrico J2000 della Terra, con durata gregoriana e geometria calcolata. Quattro colori raggruppano le stagioni meteorologiche boreali (tre mesi ciascuna); quattro raggi tratteggiati indipendenti segnano equinozi e solstizi astronomici nelle loro date precise. La fascia è un’annotazione diagrammatica, dichiarata nel metodo. Non vengono equiparati mesi, segni, costellazioni o confini astronomici delle stagioni.

Nomi dei mesi, stagioni, eventi e settori della fascia sono cliccabili. Ogni mese apre un quaderno con intervalli dei segni tropicali calcolati, Arcani Golden Dawn espandibili, due botaniche documentate, domanda/pratica editoriale originale, fasi lunari UTC e soglie astronomiche del mese. Ventiquattro schede botaniche in `content/calendar-months.json`, con fonti RHS/Kew e associazioni esplicitamente editoriali. Dettagli scientifici, fonti e limiti in `docs/solar-calendar.md`; ricerca botanica in `docs/calendar-botanics.md`.

Aprire una scheda non modifica l’orologio. “Visita questo mese in pausa” porta all’inizio civile del mese; “Adesso” ripristina il tempo reale 1×. Il calendario si rigenera al cambio d’anno conservando la lettura, gli Arcani aperti e il focus. Le etichette si possono trascinare; la selezione dei pianeti ha priorità sul raycaster della fascia. L’elenco HTML dei dodici mesi resta l’alternativa accessibile. Vista ampia con lo stesso modello e scheda affiancata su desktop, impilata e scorrevole su mobile; Luna e vista Terra–Luna conservano la traiettoria relativa.

QA su Chrome e browser interno: selezione da etichette/fascia/elenco, schede mese/stagione/evento, passaggio dicembre–gennaio, pausa/Adesso, Terra–Luna, drag delle etichette, dropdown ed Escape. Layout a 320/390/768/1440 px e 844 orizzontale senza overflow della pagina o del dialog. Benchmark indipendenti USNO per equinozi/solstizi e NASA GSFC per fasi lunari, mesi bisestili e vettori reali della Terra. Nessun nuovo asset raster o servizio remoto; manifesto originale conservato.

Verifica finale calendario: 211 test passati, 0 fallimenti, 2 skip opzionali; build e 912 riferimenti locali verificati. Confermata nel browser la conservazione del focus sull’Arcano XV e della disclosure aperta al passaggio al 2027, chiusura della scheda senza chiudere il dialog, Escape e ripristino del focus sul comando Espandi.
