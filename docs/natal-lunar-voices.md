# Voci per la lettura lunare personale

`content/natal-lunar-voices.json` contiene dodici voci redazionali originali di Lavanda — THE RIOT WITCH. Ogni voce offre un titolo, una lente, quattro brevi intrecci con i capitoli alchemici, una domanda e una pratica. Sono testi nuovi di sviluppo della rivista, non parole originali attribuite a Martina.

La lettura si rivolge al lettore in seconda persona e propone possibilità di osservazione. Un segno fornisce una lente narrativa; il testo non attribuisce caratteristiche necessarie alla persona, non deduce il suo vissuto e non anticipa eventi o risultati. La selezione automatica rende pertinente un percorso editoriale ai dati della carta, senza trasformarlo in una verità individuale.

## Struttura e composizione

Il JSON è un oggetto con le dodici chiavi `aries`, `taurus`, `gemini`, `cancer`, `leo`, `virgo`, `libra`, `scorpio`, `sagittarius`, `capricorn`, `aquarius`, `pisces`. Ogni valore contiene esattamente:

- `title`: titolo originale della lente, in italiano;
- `lens`: una frase di al massimo 25 parole;
- `bridge`: oggetto con quattro stringhe, nelle chiavi `nigredo`, `albedo`, `citrinitas`, `rubedo`;
- `question`: una domanda rivolta al lettore;
- `practice`: un invito a osservare, annotare, disegnare o rileggere.

Ogni `bridge` comprende due frasi connesse, di al massimo 40 parole complessive. La prima mette in relazione il capitolo alchemico e il segno; la seconda sviluppa un gesto o una domanda coerente con quell'accostamento. Le quarantotto combinazioni sono scritte singolarmente, senza comporre una frase attraverso una lista di tratti.

La composizione prevista affianca l'introduzione della fase in `content/lunar-phases.json`, la lente del segno lunare e il `bridge` del capitolo pertinente. Piante e Arcani restano quelli selezionati dagli altri dati e dai criteri del progetto: questo file non aggiunge schede botaniche, numeri di carte o nuove corrispondenze astrologiche.

| Fase del percorso | Chiave del bridge |
| --- | --- |
| Luna nuova; falce crescente | `nigredo` |
| Primo quarto; gibbosa crescente | `albedo` |
| Luna piena; gibbosa calante | `citrinitas` |
| Ultimo quarto; falce calante | `rubedo` |

Le possibilità di segno o di fase dovute all'ora sconosciuta richiedono un'introduzione condizionale da parte del modello e dell'interfaccia. Il JSON offre testi per ogni combinazione, senza stabilire quale sia certa. Un codice di segno o di capitolo mancante non va ricostruito dal tono della voce o da un abbinamento vicino: la lettura personale va presentata con il grado di certezza disponibile.

## Dodici lenti

| Segno | Tema della voce | Movimento fra i quattro capitoli |
| --- | --- | --- |
| Ariete | Il gesto e il tempo di ascoltarne le conseguenze | Un inizio ancora da definire trova parole, visibilità e una misura concreta. |
| Toro | Materia e continuità dei giorni | Un'abitudine viene interrogata, distinta dall'obbligo e custodita attraverso una variazione scelta. |
| Gemelli | Voci, parole e versioni di un ricordo | Una frase incompleta apre traduzioni, scambio e un accordo che può essere riaperto. |
| Cancro | Luoghi, memoria e appartenenza | La distanza da una scena passata permette di rileggere soglie, racconti condivisi e vicinanza. |
| Leone | Presenza e spazio nella scena | Un'immagine personale prende parole e riconosce le relazioni che rendono possibile la visibilità. |
| Vergine | Dettaglio e diritto al provvisorio | I pezzi di una forma trovano criteri rivedibili e una pratica compatibile con la giornata reale. |
| Bilancia | Accordi e possibilità di dissenso | Una misura condivisa viene interrogata, resa esplicita e tradotta in un accordo modificabile. |
| Scorpione | Fiducia e riservatezza | Una soglia accompagna conclusioni, confini e scelte su ciò che rendere visibile o custodire. |
| Sagittario | Mappe e racconti di orientamento | Una direzione perde certezza, incontra dettagli e fonti, poi prende forma in un gesto circoscritto. |
| Capricorno | Tempo, responsabilità e strutture | Le giunture di un impegno rendono leggibili lavoro, limiti e condizioni da ridiscutere. |
| Acquario | Consuetudini e regole della convivenza | Una frattura apre alternative che possono diventare comprensibili e discutibili da chi le abita. |
| Pesci | Memoria, immaginazione e contorni | Un'immagine sospesa distingue osservazioni e letture, incontra altre voci e trova una forma modificabile. |

## Attribuzione delle associazioni

Le lenti e i quarantotto `bridge` sono composizioni culturali contemporanee di Lavanda. Riprendono il registro e i temi del progetto presenti in `src/natal-reading.js`, mantenendo prosa originale. L'intreccio segno lunare → capitolo alchemico non viene attribuito alla Golden Dawn.

Le corrispondenze degli Arcani già documentate in `src/natal-tarot.js` conservano la loro attribuzione e la numerazione Rider–Waite–Smith. Le coppie Arcani → fase lunare in `content/lunar-phases.json` rimangono scelte editoriali di Lavanda, distinte da quelle corrispondenze tradizionali. Il lessico storico dei quattro colori è documentato in [lunar-botanics.md](lunar-botanics.md).

Le piante associate alle fasi conservano i fatti e le fonti primarie verificati in quel documento. Queste voci non aggiungono affermazioni botaniche o effetti lunari sulle piante. Le domande e le pratiche non propongono trattamenti, rituali con efficacia promessa o istruzioni di salute.

## Verifica

Controllati i dodici codici di segno e i quattro codici alchemici, i tipi dei campi e l'assenza di campi aggiuntivi. Le dodici `lens` hanno una frase e 18–22 parole; i quarantotto `bridge` hanno due frasi e 26–34 parole. Ogni intreccio nomina il proprio capitolo e il proprio segno, e mantiene un invito in seconda persona. Il file contiene soltanto testo semplice, senza HTML, segnaposto da interpolare o modifiche al manifesto.
