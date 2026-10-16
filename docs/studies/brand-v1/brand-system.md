# LAVANDA — Sistema di identità, prima direzione

Stato: proposta di lavoro da discutere con Martina. Il manifesto originale resta in `content/manifesto-original.md`; questa guida non lo sostituisce e non presume di fissare il suo tono di voce.

## Idea

**Il ritorno al centro** è il principio compositivo estratto dalla chiusura dell'editoriale. La composizione lavora con un centro riconoscibile, due polarità e uno spazio di attraversamento. Il cerchio rimane aperto: la ciclicità non è rappresentata come una chiusura perfetta o un sistema immobile.

Due archi identici, ruotati di 180° e leggermente sfalsati, costruiscono l'emblema. Il punto centrale è il luogo di ritorno, una presenza minima e non un vertice. I tagli laterali interrompono la continuità e permettono al segno di respirare. La forma conserva la sua leggibilità in nero su bianco e in bianco su nero.

È un **segno contemporaneo originale**, disegnato per LAVANDA. Non è un glifo antico, un sigillo cabalistico, una lettera ebraica o un simbolo alchemico storico. Nessuna di queste attribuzioni deve essere usata per descriverlo.

## Logotipo

Il logotipo LAVANDA è composto da lettere disegnate direttamente a tracciati SVG. Non richiede font. Il ritmo alterna la geometria triangolare di A e V alla curva ampia della D. Le A hanno aste volutamente asimmetriche e un traverso basso; le grazie servono la lettura editoriale, mentre i tagli sono netti e senza ornamenti.

La parola ha priorità: l'emblema può vivere da solo come avatar, favicon o segno di chiusura; non deve sostituire il nome nel primo punto di contatto con il progetto. `The riot witch` resta la tagline esistente: in questa fase si compone come testo separato e non viene saldata al logo.

## Colori

| Nome | Valore | Ruolo |
| --- | --- | --- |
| Nero | `#000000` | Testo, ombra, campo pieno, polo di massima densità. |
| Bianco | `#FFFFFF` | Pagina, respiro, campo di lettura, polo di massima apertura. |
| Pervinca | `#8093F1` | Colore principale di riconoscimento; soglia fra i due poli. |
| Menta | `#9FFFCB` | Accento botanico e relazione con la materia vivente. |
| Giallo | `#FFD60A` | Richiamo puntuale, nota, indice o luce. |
| Rosa | `#FDC5F5` | Corpo, relazione e dimensione sensibile. |

Le associazioni cromatiche sono scelte del sistema grafico; non vengono presentate come corrispondenze esoteriche universali. Non esiste un codice «rosa = femminile» obbligatorio: i colori possono attraversare le aree tematiche.

Nero e bianco restano la base. Un solo colore dominante per pagina, copertina o composizione; un secondo accento può svolgere una funzione puntuale. I quattro accenti possono comparire insieme in un indice o in un diagramma quando sono utili a orientarsi. Evitare sfondi con gradienti come sostituto del contenuto.

Per i testi utilizzare nero sui quattro colori e sui fondi bianchi; bianco sul nero. Il pervinca non è un colore per testo piccolo sul bianco. I colori non devono essere l'unico modo di distinguere contenuti o stati.

## Tipografia e composizione

- Il marchio contiene già la propria voce tipografica e non va riscritto con un font simile.
- Nel sito: una serif di lettura per la componente editoriale e una sans discreta per navigazione, didascalie e metadati. La scelta definitiva del font del sito viene coordinata con l'implementazione; non è incorporata nel marchio.
- Testo principale allineato a sinistra, righe normalmente fra 55 e 75 caratteri; la centratura è riservata a copertine, citazioni brevi e aperture.
- Gli spazi vuoti sono parte del discorso. Evitare di saturare ogni margine con stelle, lune, mani, occhi o decorazioni pseudo-occultiste.
- Geometrie e numeri possono diventare regole compositive verificabili. Ogni relazione con la Cabala o con un sistema storico deve essere spiegata e documentata separatamente; il logo non ne simula l'autorità.
- Fotografia, illustrazione e diagramma devono avere funzioni distinte e riconoscibili. Il marchio non richiede filtri fotografici permanenti.

## Uso minimo

| Elemento | Dimensione minima digitale | Dimensione minima stampa |
| --- | --- | --- |
| Logo orizzontale | 180 px di larghezza; 220 px consigliati | 40 mm di larghezza |
| Solo logotipo | 140 px di larghezza | 30 mm di larghezza |
| Emblema | 24 px; per 16–23 px usare la favicon semplificata | 7 mm |
| Icone | 24 px; griglia nativa 32 px | 6 mm |

Area di rispetto del logo: almeno l'altezza del punto centrale dell'emblema moltiplicata per due, su tutti i lati. Per l'emblema isolato, lasciare almeno un sesto del diametro. Non stirare, inclinare, chiudere gli archi, spostare il punto o applicare ombre e contorni. Usare la versione inversa sui fondi neri o sulle immagini con una zona scura uniforme. Una fotografia che rende il marchio illeggibile richiede un campo bianco o nero dedicato.

## Icone originali

Sei icone di orientamento, griglia `32 × 32`, tratto `1.5`, terminali e giunzioni arrotondati. Si possono usare fra 24 e 48 px con proporzioni invariate. Sono interamente a `currentColor` per seguire il colore del testo.

| File | Significato nell'interfaccia | Costruzione |
| --- | --- | --- |
| `ciclo.svg` | Cicli e ritmo | Due archi con direzione e punto centrale. |
| `botanica.svg` | Botanica | Stelo e foglie a crescita alternata. |
| `arcani.svg` | Tarocchi e archetipi | Carte sovrapposte con figura geometrica originale. |
| `alchimia.svg` | Alchimia e trasformazione | Recipiente, livello e punto di materia. |
| `corrispondenze.svg` | Relazioni fra sistemi | Nodi connessi e percorsi di ritorno. Non rappresenta l'Albero della Vita. |
| `lettura.svg` | Blog, testi e fanzine | Libro aperto. |

Le icone sono disegni funzionali contemporanei. L'icona Arcani non riproduce un arcano tradizionale e l'icona Corrispondenze non deve essere chiamata «Sephiroth». Quando decorative, aggiungere `aria-hidden="true"`; quando interattive, accompagnarle con un'etichetta testuale accessibile. Se incorporate come immagini esterne, il `currentColor` non eredita il colore della pagina: usare SVG inline/sprite oppure nero su fondo chiaro.

## File

- `public/brand-v1/logo.svg`: nero, fondo trasparente, emblema e parola.
- `public/brand-v1/logo-inverse.svg`: bianco, fondo trasparente.
- `public/brand-v1/wordmark.svg` e `wordmark-inverse.svg`: sola parola.
- `public/brand-v1/emblem.svg`, `emblem-inverse.svg`, `emblem-periwinkle.svg`: segno isolato.
- `public/brand-v1/favicon.svg`: emblema semplificato, fondo pervinca.
- `public/brand-v1/brand-sheet.html`: presentazione consultabile e stampabile.
- `scripts/generate-brand-v1.py`: sorgente riproducibile dei tracciati della prima direzione.
- `public/icons/*.svg`: sei icone singole e `sprite.svg`.

Rigenerazione: `python scripts/generate-brand-v1.py` dalla root del progetto. I file SVG non contengono script né risorse esterne.
