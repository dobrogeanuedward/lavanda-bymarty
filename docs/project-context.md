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
