# Il calendario di una lunazione

Il calendario lunare di Lavanda segue una lunazione effettiva: dall’ultima Luna nuova precedente o coincidente con l’istante visualizzato alla Luna nuova successiva. Otto passaggi astronomici delimitano otto intervalli cronologici. I riferimenti ad alchimia, Arcani e piante sono un livello editoriale distinto.

## Eventi, intervalli e nomi

`SearchMoonPhase` cerca una differenza di longitudine eclittica geocentrica fra Luna e Sole. Le soglie 0°, 90°, 180° e 270° definiscono i quattro eventi principali; le soglie intermedie completano la suddivisione adottata qui. Il campo `phaseAngle` segue questa convenzione, mentre `illuminatedFraction` viene da `Illumination('Moon').phase_fraction`. Non va confuso con `Illumination.phase_angle`, l’angolo fisico Sole–Luna–Terra, che usa una convenzione diversa. [API ufficiale Astronomy Engine](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md).

| Key | Nome | Passaggio iniziale | Gruppo editoriale |
|---|---|---|---|
| `new` | Luna nuova | 0° | Nigredo |
| `waxing-crescent` | Falce crescente | 45° | Nigredo |
| `first-quarter` | Primo quarto | 90° | Albedo |
| `waxing-gibbous` | Gibbosa crescente | 135° | Albedo |
| `full` | Luna piena | 180° | Citrinitas |
| `waning-gibbous` | Gibbosa calante | 225° | Citrinitas |
| `last-quarter` | Ultimo quarto | 270° | Rubedo |
| `waning-crescent` | Falce calante | 315° | Rubedo |

Ogni settore comprende il suo istante iniziale ed esclude quello finale. Per esempio, il settore `full` va dal passaggio a 180° a quello a 225°: **la Luna piena esatta è l’evento iniziale**, non uno stato invariato per tutta la durata del settore. Le etichette indicano il passaggio che apre l’intervallo; la falce crescente esiste anche prima della soglia editoriale a 45°. Non sono otto intervalli della stessa durata né una tassonomia osservativa esclusiva della forma visibile.

`mainEvents` conserva soltanto i quattro eventi principali, con le stesse key dei rispettivi settori. Le durate vengono calcolate dalle date trovate, senza dividere una durata media per otto. La frazione illuminata varia continuamente e non è ricavata dall’indice del settore.

## Geometria e rappresentazione

I punti sono posizioni **geometriche geocentriche**, in AU: `GeoMoon(date)` viene ruotato con `Rotation_EQJ_ECL()` nell’eclittica media fissa J2000. Anche gli eventi ricevono la posizione allo stesso istante. La definizione delle fasi tramite longitudini geocentriche resta distinta dall’orientamento J2000 della scena. [Riferimento delle coordinate](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md).

Un mese sinodico medio dura circa 29,53 giorni; il periodo siderale della Luna è circa 27,32 giorni. Per questo la traccia geocentrica di una lunazione supera un giro. Non viene richiusa artificialmente e può sovrapporsi. [NASA GSFC, fasi lunari](https://eclipse.gsfc.nasa.gov/phase/phase2001gmt.html), [NASA, dati lunari](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html).

Ogni settore campiona la posizione a intervalli temporali uguali e mantiene variazioni di raggio, velocità e inclinazione. Gli estremi adiacenti coincidono; gli estremi dell’intera lunazione non vengono forzati a coincidere. Nella vista Terra–Luna il renderer può traslare tutti questi vettori per la posizione terrestre del momento. Il calendario rappresenta un insieme di date, mentre la Luna fisica resta nella posizione dell’istante visualizzato. Un’eventuale fascia colorata attorno alla traccia è un’annotazione grafica, non un anello o una struttura nello spazio.

## Alchimia: la scelta di Lavanda

Nigredo, albedo, citrinitas e rubedo appartengono alla storia delle trasformazioni cromatiche in tradizioni alchemiche occidentali: nero, bianco, giallo e rosso. La ricerca di Elisabeth Moreau ne ricostruisce il contesto medievale e rinascimentale e le trasformazioni interpretative. [Moreau, *Colours, humours and material change in late Renaissance chymistry and medicine*, BJHS Themes 10 (2025), 171–190](https://www.cambridge.org/core/journals/bjhs-themes/article/colours-humours-and-material-change-in-late-renaissance-chymistry-and-medicine/026E2624B83C47FAD1AC7859533C5A17).

L’associazione delle quattro coppie di settori ai quattro nomi è **una proposta editoriale contemporanea di Lavanda** (`convention: 'lavanda-editorial'`). La fonte storica documenta i termini e il loro contesto; non dimostra questa corrispondenza lunare né una sequenza universale applicabile a ogni autore. I nomi non sono risultati astronomici e non sostengono previsioni, effetti terapeutici o indicazioni botaniche pratiche.

## API, cache e limiti

```js
const calendar = computeLunarCalendar(date, {
  engine: Astronomy,
  samplesPerSector: 10,
});
const timeOnly = getLunarCalendarProgress(calendar, laterDate);
const withPhase = getLunarCalendarProgress(calendar, laterDate, {
  engine: Astronomy,
});
```

`date` accetta un `Date`, millisecondi Unix finiti oppure una stringa ISO con fuso esplicito. L’istante osservato deve rientrare in `SOLAR_DATE_RANGE`: **1899-12-31T00:00:00Z–2100-12-31T23:59:59.999Z**. Il giorno iniziale di margine conserva nascite locali valide del 1° gennaio 1900 nei fusi positivi; i controlli dell’osservatorio restano 1900–2100. Una lunazione completa può iniziare prima o finire dopo questi limiti, come avviene anche per le altre tracce temporali del modello.

Il risultato è serializzabile in JSON:

- `date`, `frame: 'J2000 ecliptic'`, `origin: 'earth'`, `timeZone: 'UTC'`, `startDate`, `endDate`, `durationDays`.
- `sectors`: otto oggetti con `key`, `index`, `label`, `phaseLabel`, `angle`, `alchemyKey`, `alchemyLabel`, date, durata, `points`, `startPosition`, `endPosition`, `current`, `progress`. `eventDate` coincide con `startDate`.
- `mainEvents`: quattro eventi con key, nomi, angolo, gruppo editoriale, `position`, `date` ed `eventDate`.
- `groups`: quattro coppie con `key`, `label`, `sectorIndices`, date, durata e convenzione editoriale.
- `currentSectorKey`, `currentSectorIndex`, `sectorProgress`, `lunationProgress`, `alchemyKey`, `phaseAngle`, `illuminatedFraction`, `phaseAngleConvention: 'geocentric-ecliptic-elongation'`.

`samplesPerSector` è un numero intero fra 2 e 128; indica gli intervalli di campionamento, quindi ogni settore contiene `samplesPerSector + 1` punti. Gli array dei punti sono dati da trattare come immutabili.

Il chiamante conserva il calendario e riusa la geometria fino alla Luna nuova successiva. `getLunarCalendarProgress` restituisce un nuovo oggetto senza mutare il calendario: data, settore, gruppo e frazioni di **tempo trascorso**. Senza `engine` non esegue calcoli astronomici e omette fase e illuminazione, evitando valori apparentemente aggiornati ma obsoleti. Con `engine` ricalcola questi due valori all’istante richiesto. `current` e `progress` nei singoli settori restano quelli del momento di costruzione: per gli aggiornamenti si usano i campi restituiti dall’helper.

Fuori dall’intervallo `[startDate, endDate)` l’helper solleva `LUNATION_MISMATCH`: occorre costruire la nuova lunazione. Gli altri errori comprendono `INVALID_DATE`, `DATE_OUT_OF_RANGE`, `MISSING_ENGINE`, `INVALID_SAMPLES`, `INVALID_CALENDAR` e `INVALID_EPHEMERIS`. Non viene usata implicitamente l’ora corrente, né viene richiesto un servizio remoto.

## Precisione e verifiche

Il motore distribuito con il sito è Astronomy Engine 2.1.19. La ricerca iniziale degli eventi viene rifinita rispetto a `MoonPhase` al primo millisecondo rappresentabile dopo la soglia, per rendere riproducibili i confini durante ricostruzioni successive. **Questa scelta numerica non implica accuratezza fisica al millisecondo.** Il modello tratta UT1 e UTC come equivalenti entro i suoi obiettivi divulgativi. [Limiti della libreria](https://github.com/cosinekitty/astronomy#overview).

I test confrontano Luna nuova, primo quarto, Luna piena e ultimo quarto della lunazione gennaio–febbraio 2024, più la Luna nuova successiva, con la tabella indipendente di **Fred Espenak / NASA GSFC in tempo universale**. Il margine di due minuti comprende l’approssimazione del modello e la precisione al minuto della tabella; non garantisce lo stesso errore in ogni epoca. [Tabella NASA 2001–2025](https://eclipse.gsfc.nasa.gov/phase/phase2001gmt.html).

Altri test verificano continuità degli otto intervalli, passaggi esatti e ricostruzione sulle soglie in più secoli, durate non uniformi, coincidenza con la Luna della scena solare allo stesso istante, traccia aperta oltre un giro, frazione illuminata, aggiornamento senza mutazioni e lunazioni complete ai limiti supportati.
