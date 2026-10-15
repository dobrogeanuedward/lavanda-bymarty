# LAVANDA — La bottega della speziale

Prima traduzione della bozza di Martina, ottobre 2026. La versione editoriale precedente è conservata in `public/brand-v1` e `docs/studies/brand-v1`. Il manifesto originale rimane in `content/manifesto-original.md`; la guida visiva non lo riscrive e non fissa il tono dei testi.

## Il punto di partenza

La bozza sposta il marchio verso una presenza personale: una bottega di quartiere, abitata da chi legge le carte, osserva le piante e racconta storie. Il rapporto con esoterismo, antropologia e filosofia rimane nei contenuti; il marchio introduce il luogo e la persona che li accoglie.

Gli elementi del disegno vengono mantenuti:

- il cerchio grande, aperto sul lato dell'insegna;
- la bottiglia panciuta, il collo stretto e il tappo rigato;
- il nome **LAVANDA**, alto e centrale;
- l'insegna **La bottega della speziale**;
- la scritta **Aperto**;
- il payoff **Strega di quartiere**.

Non vengono introdotti ulteriori nomi o payoff. **The riot witch** rimane nella documentazione della prima fase e non è inserito nel marchio corrente.

## Lettering e disegno

LAVANDA è disegnato a tracciati originali. Le lettere alte, angolari e lievemente irregolari riprendono l'energia della bozza, evitando di dipendere da un font commerciale. A e V danno un ritmo triangolare; N e D interrompono la ripetizione. I piccoli scarti di altezza sono intenzionali.

La bottiglia e il cerchio sono illustrazioni vettoriali originali. Il magenta è un secondo tratto, simile a una registrazione di stampa leggermente spostata. Può essere eliminato senza perdere la forma.

La parola attraversa la bottiglia con uno spazio di rispetto che cancella i tratti retrostanti. Il nome deve rimanere leggibile. Nel marchio completo, l'insegna è separata e riconoscibile; nelle versioni piccole viene rimossa insieme alle scritte di servizio.

Le scritte secondarie del marchio completo sono convertite in tracciati a partire da URW Base 35: Nimbus Sans Narrow per l'insegna, Z003 Medium Italic per «Aperto» e «Strega di quartiere». I file SVG finali sono autonomi e non richiedono font installati. La scrittura più personale del payoff potrà essere affinata con un passaggio di lettering dedicato dopo la scelta della direzione.

## Famiglia di marchi

| File | Impiego | Misure SVG |
| --- | --- | --- |
| `logo-bottega.svg` | Aperture, copertina, presentazione, stampa ampia. Comprende tutte le parole della bozza. | 830 × 790 |
| `logo-bottega-mono.svg` | Marchio completo a un colore. | 830 × 790 |
| `logo-bottega-inverse.svg` | Marchio completo bianco e magenta, su fondo scuro. | 830 × 790 |
| `logo.svg` | Logo orizzontale per il sito: simbolo + LAVANDA. | 1080 × 230 |
| `logo-inverse.svg` | Versione orizzontale bianca e magenta. | 1080 × 230 |
| `logo-mono.svg` | Versione orizzontale nera a un colore. | 1080 × 230 |
| `wordmark.svg` / `wordmark-inverse.svg` | Il solo lettering LAVANDA. | 655 × 185 |
| `emblem.svg` / `emblem-inverse.svg` | Bottiglia e cerchio per avatar, navbar, chiusure. | 165 × 178 |
| `emblem-mono.svg` | Simbolo nero a un colore. | 165 × 178 |
| `favicon.svg` | Simbolo ridotto su campo magenta. | 64 × 64 |

Il primo contatto con il progetto deve contenere il nome LAVANDA. Il simbolo isolato segue, dopo che il nome è stato presentato.

## Palette dalla bozza

| Colore | Valore | Uso proposto |
| --- | --- | --- |
| Magenta | `#FF1685` | Firma, secondo tratto, richiamo principale. |
| Giallo | `#FFD600` | Campo vivace per avatar, carta, annuncio. |
| Lilla | `#B58CFF` | Campi editoriali e immagini del sistema. |
| Blu viola | `#382096` | Campo scuro, testi e versione alternativa del tratto. |
| Bianco | `#FFFFFF` | Pagina e spazio di lettura. |
| Nero | `#000000` | Lettering, disegno, testo e versione a un colore. |

Nero su magenta, giallo, lilla e bianco. Bianco su nero o blu viola. Per il testo piccolo non usare bianco su magenta, lilla su bianco o blu viola sul nero. Il colore non deve essere l'unico criterio di riconoscimento di una sezione.

Un colore dominante per composizione. Il secondo tratto magenta può restare nel marchio anche quando il campo cambia. I colori non hanno assegnazioni esoteriche obbligatorie: le relazioni storiche e simboliche appartengono ai contenuti e vanno trattate con le loro fonti.

## Regole essenziali

| Elemento | Minimo digitale, larghezza | Minimo stampa, larghezza |
| --- | --- | --- |
| Marchio con insegna | 320 px | 70 mm |
| Logo orizzontale | 180 px | 40 mm |
| Solo lettering | 120 px | 28 mm |
| Simbolo | 32 px | 9 mm |
| Icone | 24 px | 6 mm |

Per misure inferiori a 32 px usare la favicon. Lasciare un margine libero pari ad almeno un sesto dell'altezza del marchio scelto. Non deformare, chiudere il cerchio, spostare il lettering o cambiare il rapporto fra bottiglia e tappo. Non applicare ombre, bagliori, finiture metalliche o rilievi.

Su fotografie utilizzare una zona uniforme che garantisca la lettura; in alternativa inserire un campo pieno. Il marchio completo non è adatto a un piccolo pulsante o alla navbar. Le parole dell'insegna non devono essere ristrette per farle entrare in una composizione.

## Icone funzionali

Le sei icone in `public/icons` rimangono un livello funzionale distinto dal disegno del marchio. Griglia `32 × 32`, tratto `1.5`, terminali e giunzioni arrotondati, colore `currentColor`.

| File | Funzione |
| --- | --- |
| `ciclo.svg` | Ritmi e ritorno. |
| `botanica.svg` | Piante e materia vivente. |
| `arcani.svg` | Tarocchi e lettura archetipica. |
| `alchimia.svg` | Trasformazione. |
| `corrispondenze.svg` | Relazioni fra sistemi. |
| `lettura.svg` | Blog e fanzine. |

Sono disegni contemporanei originali. Corrispondenze non riproduce l'Albero della Vita; Arcani non riproduce un arcano tradizionale. Le icone decorative vanno escluse dalla lettura assistita, quelle interattive vanno accompagnate da un'etichetta accessibile. Per ereditare il colore del testo usare SVG inline o sprite; un SVG caricato con `img` rimane nero.

## Materiale di studio

- `public/brand/studio-bottega.png`: board creativa generata con lo strumento integrato ImageGen, usando la bozza come riferimento di composizione e carattere. Presenta una configurazione principale, un avatar e una composizione orizzontale coerenti.
- `public/brand/brand-sheet.html`: presentazione consultabile, responsive e stampabile con un confronto esplicito fra prima direzione e nuova bozza.
- `public/brand-v1/primo-studio.png`: la prima direzione conservata per il confronto richiesto.
- `public/brand/generate-brand.py`: sorgente del sistema vettoriale corrente. Richiede Python e fontTools soltanto per rigenerare gli asset. I file esportati non richiedono dipendenze.

La board raster è una ricerca creativa; i file SVG costituiscono la prima traduzione riproducibile per l'uso nel progetto. Le differenze di dettaglio fra board e SVG sono intenzionali: l'export nativo riduce tratti e ridondanze per garantire leggibilità.

## Generazione e verifica

Eseguire dalla root del progetto: `python public/brand/generate-brand.py`.

Il logotipo e il marchio completo sono stati controllati visivamente tramite rendering SVG. I file sono stati verificati come XML. Non contengono script, risorse remote o dipendenze da font in visualizzazione. Il brand sheet è predisposto per stampa A4 orizzontale; in questa fase non è stata eseguita una prova di stampa browser.
