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
