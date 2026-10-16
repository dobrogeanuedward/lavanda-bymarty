# Il calendario sull’orbita terrestre

Il calendario di Lavanda mostra **dodici mesi civili**, da gennaio a dicembre. I mesi sono ritagliati sull’effettiva traiettoria terrestre: le loro date e durate non vengono convertite in dodici angoli uguali. Le informazioni botaniche e le corrispondenze simboliche appartengono a un livello editoriale separato dai dati di questo modulo.

## Mesi e stagioni: due convenzioni distinte

Ogni anno rappresentato va dal **1° gennaio alle 00:00 UTC** al medesimo istante dell’anno successivo. Gli intervalli includono l’inizio ed escludono la fine. Febbraio dura 28 o 29 giorni secondo il calendario gregoriano; gli altri mesi durano 30 o 31 giorni. Gennaio e febbraio appartengono quindi all’anno civile corrente, senza un cambio di ciclo all’equinozio.

I quattro colori stagionali usano la **convenzione meteorologica dei tre mesi**, descritta da [NOAA/NCEI](https://www.ncei.noaa.gov/news/meteorological-versus-astronomical-seasons):

| Emisfero nord | Mesi | Emisfero sud |
|---|---|---|
| Primavera | marzo, aprile, maggio | Autunno |
| Estate | giugno, luglio, agosto | Inverno |
| Autunno | settembre, ottobre, novembre | Primavera |
| Inverno | dicembre, gennaio, febbraio | Estate |

L’inversione dei gruppi nell’emisfero sud segue la convenzione illustrata dal [Bureau of Meteorology australiano](https://www.bom.gov.au/news-and-media/solstices-equinoxes-and-the-seasons). Quattro stagioni temperate sono una convenzione di lettura; non descrivono ogni clima locale, né sostituiscono calendari stagionali regionali.

Il gruppo dicembre–gennaio–febbraio attraversa il bordo del calendario. Il modello conserva gli indici ciclici `[11, 0, 1]`; i suoi `intervals` contengono le due porzioni presenti nell’anno visualizzato: gennaio–febbraio e dicembre. `durationDays` somma i giorni di quei tre mesi nell’anno civile rappresentato, senza assegnare le due porzioni a un unico inverno o a un’unica estate climatologica.

**Equinozi e solstizi sono marcatori separati.** Il modulo calcola le quattro date astronomiche annuali e la posizione della Terra a ciascun evento. Un equinozio di marzo non viene spostato al 1° marzo, né una divisione mensile viene presentata come equinozio. Le due definizioni stagionali non coincidono. [Spiegazione NOAA](https://www.ncei.noaa.gov/news/meteorological-versus-astronomical-seasons), [servizio astronomico USNO](https://aa.usno.navy.mil/data/Earth_Seasons).

## Calcolo astronomico

Il motore è **Astronomy Engine 2.1.19**, distribuito con il sito e usato nel browser:

- `Seasons(year)` restituisce equinozi di marzo/settembre e solstizi di giugno/dicembre.
- `SearchSunLongitude` trova gli ingressi del Sole nei dodici intervalli tropicali da 30°; `SunPosition` determina l’intervallo già in corso all’inizio di ogni mese.
- `SearchMoonPhase` trova Luna nuova, primo quarto, Luna piena e ultimo quarto, rispettivamente a differenze di longitudine geocentrica di 0°, 90°, 180° e 270° rispetto al Sole.
- `HelioVector('Earth', date)` e `Rotation_EQJ_ECL()` producono la geometria eliocentrica terrestre nell’eclittica media J2000.

[API ufficiale Astronomy Engine](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md).

I nomi Ariete–Pesci in `solarSigns` sono **etichette astrologiche tropicali** di intervalli uguali di longitudine solare; non sono un calcolo delle costellazioni IAU. Le date degli ingressi vengono calcolate per l’anno richiesto e ritagliate entro il mese. Il campo `longitude` indica l’origine del segno tropicale, non la longitudine esatta del Sole al bordo civile del mese.

Le fasi lunari sono eventi, non una divisione dei mesi in quattro parti uguali. Un mese può contenere cinque eventi principali, compresa una seconda Luna nuova o piena. Le date sono ordinate e limitate all’effettivo intervallo del mese.

Le posizioni `startPosition`, `endPosition`, `points` e quelle degli eventi sono vettori **geometrici eliocentrici**, in AU e con orientamento fisso `J2000 ecliptic`. Gli istanti degli eventi solari sono invece definiti tramite la longitudine solare **apparente geocentrica nell’eclittica della data**. Si usa poi il medesimo istante per collocare la Terra nella scena. Questi due riferimenti non devono essere scambiati né ricondotti a raggi di angolo prefissato J2000.

Ogni curva mensile contiene campioni a intervalli di tempo uguali; eccentricità e velocità variabile fanno parte del calcolo. Un anno civile non coincide esattamente con un periodo siderale: gli estremi della curva annuale non vengono forzati a coincidere. Un’eventuale fascia colorata attorno alla curva è una rappresentazione grafica del calendario, non un oggetto fisico nello spazio.

## API e aggiornamento

```js
const calendar = computeSolarCalendar(date, {
  engine: Astronomy,
  hemisphere: 'north',
  samplesPerSector: 12,
});
const progress = getSolarCalendarProgress(calendar, laterDate);
```

`date` accetta un `Date`, millisecondi Unix finiti o una stringa ISO con fuso esplicito. L’intervallo dell’istante osservato coincide con quello del motore solare: **31 dicembre 1899 UTC–31 dicembre 2100 UTC**. Il giorno di margine iniziale conserva nascite locali valide del 1° gennaio 1900 in fusi positivi; i controlli dell’osservatorio rimangono 1900–2100.

Il risultato è serializzabile in JSON e contiene:

- `year`, `startDate`, `endDate`, `durationDays`, `frame`, `hemisphere`, `timeZone: 'UTC'`, `seasonConvention: 'meteorological'`.
- `sectors`: dodici mesi con `key` inglese (`january`–`december`), `name`/`label`/`monthLabel` italiani, `index` da 0, `month` da 1, `seasonKey`, `seasonLabel`, date, durata, punti, `solarSigns` e `lunarPhases`.
- `seasons`: quattro gruppi con `key`, `label`, `sectorIndices` e `monthIndices` da 0, `months` da 1, intervalli e somma delle durate annuali del gruppo.
- `astronomicalEvents`: quattro oggetti con `key`, `label`, `date`, `longitude` e `position`.
- `currentSectorIndex`, `currentSectorKey`, `sectorProgress`, `yearProgress` e `cycleProgress` (alias di `yearProgress`). Ogni settore conserva anche `current` e `progress` al momento della costruzione.

Il progresso è una **frazione del tempo trascorso**, non un angolo o una percentuale di longitudine percorsa. `getSolarCalendarProgress` aggiorna soltanto questi valori senza richiamare il motore, modificare la geometria o mutare il calendario. Se cambia l’anno UTC, restituisce l’errore `CALENDAR_YEAR_MISMATCH`: il chiamante deve costruire il nuovo anno. Anche un cambio di emisfero richiede la ricostruzione dei nomi stagionali.

L’anno completo include necessariamente punti precedenti o successivi all’istante osservato. Per esempio, il calendario 2100 termina al 1° gennaio 2101; il margine non estende i controlli temporali dell’interfaccia.

## Accuratezza e verifiche

Astronomy Engine è un modello divulgativo compatto, non uno strumento di navigazione. Le sue date sono approssimazioni numeriche; UT1 e UTC vengono trattati come equivalenti entro gli obiettivi del modello. [Limiti dichiarati dalla libreria](https://github.com/cosinekitty/astronomy#overview).

I test confrontano gli otto eventi cardinali del 2024 e 2026 con dati **indipendenti USNO**, usando esplicitamente UTC (`tz: 0`, `dst: false`): [2024](https://aa.usno.navy.mil/api/seasons?year=2024), [2026](https://aa.usno.navy.mil/api/seasons?year=2026). La tolleranza del test è due minuti, includendo l’approssimazione della libreria e la precisione al minuto della fonte. Non è una garanzia uniforme per l’intero intervallo storico.

Per le quattro fasi di gennaio 2024, i test usano la tabella in tempo universale di **Fred Espenak / NASA GSFC**, [Phases of the Moon: 2001–2025](https://eclipse.gsfc.nasa.gov/phase/phase2001gmt.html), sempre con un margine di due minuti. Altri controlli coprono febbraio bisestile e secoli gregoriani, passaggi di mese/anno, nomi dell’emisfero sud, ingressi solari ritagliati, mesi con cinque fasi, intervallo UTC iniziale e geometria terrestre non uniforme.
