# La mappa astronomica di Lavanda

Il calcolo avviene nel browser con **Astronomy Engine 2.1.19**, già incluso nel progetto. Non richiede una chiamata a NASA, una posizione personale o un servizio remoto durante l’uso. La data determina le posizioni: l’animazione cambia l’istante simulato e ricalcola la mappa.

## Posizioni, riferimenti e unità

`computeSolarSystem(date, { engine })` restituisce dieci corpi: Sole, otto pianeti e Luna. Il riferimento comune è **l’eclittica media e l’equinozio J2000**, etichettato `J2000 ecliptic`, con vettori cartesiani `[x, y, z]` in unità astronomiche. La rotazione fissa è `Rotation_EQJ_ECL()`, non l’eclittica mobile della data.

Le coordinate `position` sono geometriche ed eliocentriche allo stesso istante: per i pianeti si usa `HelioVector`; la Luna è `Terra + GeoMoon`. Non si applicano ritardo della luce o aberrazione, correzioni necessarie per una diversa domanda: dove un corpo *appare* a un osservatore. Queste convenzioni sono documentate nell’[API ufficiale di Astronomy Engine](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md#heliovectorbody-date--vector).

Il Sole ha `position: [0, 0, 0]` perché è l’origine eliocentrica. `sunBarycentric`, ottenuto da `BaryState('Sun', date)`, descrive invece la sua posizione rispetto al baricentro del Sistema Solare, nello stesso orientamento J2000. Ogni `barycentricPosition` è `position + sunBarycentric`. La vista del baricentro mostra quindi il moto solare previsto dal modello, senza introdurre un percorso galattico. [Riferimento BaryState](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md#barystatebody-date--statevector).

`moonGeocentric` conserva la posizione della Luna rispetto al centro terrestre. `distanceSunAU` e `distanceEarthAU` sono norme dei vettori nello stesso istante. Una AU corrisponde a **149.597.870,7 km**, secondo la definizione IAU riportata nei [parametri astrodinamici JPL](https://ssd.jpl.nasa.gov/astro_par.html).

## Traiettorie e tempo

`sampleOrbit(key, centerDate, { engine, samples: 192 })` produce **193 punti**, compresi i due estremi: `samples` indica il numero di intervalli temporali uguali. Ogni punto deriva da una nuova effemeride. Si conservano distanza variabile, inclinazione e velocità non uniforme; non si disegnano cerchi ideali. Le tracce sono porzioni di traiettoria attorno alla data scelta, non ellissi immutabili. Gli estremi non vengono forzati a coincidere: `closed` è sempre `false`.

Per i pianeti l’intervallo copre un periodo siderale tabellare ed è centrato sulla data scelta (`origin: 'sun'`). Per la Luna si campiona un periodo siderale geocentrico (`origin: 'earth'`), utile alla vista Terra–Luna.

Per il Sole si campiona invece una **finestra scelta di dodici anni**, da sei anni prima a sei anni dopo, con `origin: 'ssb'` e `intervalLabel: 'Traiettoria del Sole su 12 anni'`. In questo caso `periodDays: 4383` è soltanto la durata della finestra API. **Non è un periodo orbitale del Sole**: il Sole nei metadati ha `orbitalPeriodDays: null`.

`sampleOrbitAsync` produce gli stessi dati in blocchi di 24 punti, cedendo il controllo fra i blocchi. Accetta `AbortSignal`; il cambio di epoca può annullare una traccia precedente con `AbortError`.

Gli istanti selezionabili sono dal 1900 al 2100 compresi. Le tracce più lunghe possono oltrepassare questi estremi; i campioni sono limitati al 1700–2300. Per esempio, un percorso completo di Nettuno centrato nel 2100 arriva circa al 2183. Questo allargamento serve a mostrare la traiettoria, senza estendere i controlli temporali dell’interfaccia.

## Dati fisici e scelte grafiche

`radiusKm` è il **raggio medio volumetrico**, non quello equatoriale. I periodi dei pianeti provengono dalla tabella JPL in anni e sono convertiti in giorni usando l’anno giuliano di 365,25 giorni. Servono a scegliere l’intervallo delle tracce; non determinano le posizioni. [Dati fisici JPL](https://ssd.jpl.nasa.gov/planets/phys_par.html), [definizione dell’anno giuliano](https://ssd.jpl.nasa.gov/astro_par.html).

| Corpo | Raggio medio, km | Periodo tabellare |
|---|---:|---:|
| Sole | 695.700 | non assegnato |
| Mercurio | 2.439,4 | 0,2408467 anni |
| Venere | 6.051,8 | 0,61519726 anni |
| Terra | 6.371,0084 | 1,0000174 anni |
| Marte | 3.389,5 | 1,8808476 anni |
| Giove | 69.911 | 11,862615 anni |
| Saturno | 58.232 | 29,447498 anni |
| Urano | 25.362 | 84,016846 anni |
| Nettuno | 24.622 | 164,79132 anni |
| Luna | 1.737,4 | 27,3217 giorni, intorno alla Terra |

Il raggio solare viene dal [Sun Fact Sheet NASA](https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html); raggio e periodo lunari dal [Moon Fact Sheet NASA](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html). Fonti consultate il 16 ottobre 2026.

I colori sono una scelta grafica di Lavanda. Il renderer mantiene le distanze lineari. La modalità iniziale amplifica soltanto i raggi, con moltiplicatori dichiarati nell’interfaccia; “Raggi reali in scala” e la vista Sole–baricentro usano raggi fisici. Queste scelte non modificano i dati astronomici. La trasformazione per una scena Three.js con asse verticale Y può essere `(x, y, z) → (x, z, −y)`, applicata anche ai poli.

Quando `RotationAxis` è disponibile, ogni corpo include `rotation.north`, vettore unitario nel medesimo riferimento eclittico, e `primeMeridianDegrees`, angolo IAU normalizzato fra 0 e 360°. Il renderer usa `north` per orientare l’asse e gli anelli. L’angolo IAU resta un metadato: senza una convenzione del meridiano di riferimento non basta a orientare una mappa geografica. La rotazione quotidiana non è animata; le superfici sono schematiche. La luce conserva la direzione solare, con intensità diagrammatica per rendere leggibili anche i pianeti esterni; non è una simulazione fotometrica o delle eclissi. La libreria documenta il modello [IAU WGCCRE 2015](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md#rotationaxisbody-date--axisinfo).

## Accuratezza e verifica indipendente

Astronomy Engine è un modello compatto per uso divulgativo, con obiettivo dichiarato di circa un minuto d’arco sulle posizioni angolari; non è un’effemeride per navigazione spaziale. [Descrizione ufficiale del modello](https://github.com/cosinekitty/astronomy#overview).

I test salvano dati indipendenti di **JPL Horizons** per `2000-01-01T12:00:00Z` e `2026-10-16T00:00:00Z`: Terra, Mercurio, Giove e Nettuno rispetto al Sole, Luna rispetto alla Terra e Sole rispetto al baricentro. La prima data è mezzogiorno UTC, distinto dall’istante preciso J2000 definito in TT. Le fixture verificano vettori geometrici nel riferimento eclittico J2000. [API Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html), [manuale JPL](https://ssd.jpl.nasa.gov/horizons/manual.html).

Parametri riproducibili della richiesta a `https://ssd.jpl.nasa.gov/api/horizons.api`:

```text
format=json
OBJ_DATA=NO
MAKE_EPHEM=YES
EPHEM_TYPE=VECTORS
REF_PLANE=ECLIPTIC
REF_SYSTEM=ICRF
OUT_UNITS=AU-D
VEC_TABLE=2
VEC_CORR=NONE
TIME_TYPE=UT
TLIST_TYPE=CAL
TLIST='2000-01-01 12:00:00' '2026-10-16 00:00:00'
CSV_FORMAT=YES
```

Target `COMMAND`: Terra `399`, Mercurio `199`, Giove `599`, Nettuno `899`, con `CENTER='500@10'`. Per la Luna: `COMMAND='301'`, `CENTER='500@399'`; per il Sole: `COMMAND='10'`, `CENTER='500@0'`. I risultati consultati usano DE441 per Sole, Terra, Mercurio e Luna, `jup365_merged` per Giove e `nep098_merged` per Nettuno.

| Vettore | Tolleranza del test, AU |
|---|---:|
| Terra → eliocentrico | 0,00003 |
| Mercurio → eliocentrico | 0,00002 |
| Giove → eliocentrico | 0,0004 |
| Nettuno → eliocentrico | 0,005 |
| Luna → geocentrico | 0,00000015 |
| Sole → baricentrico | 0,000015 |

Sono margini di confronto per l’approssimazione della libreria, **non incertezze JPL e non una garanzia uniforme su ogni data**. Nei due confronti, la discrepanza del vettore solare baricentrico è circa 0,00000691 AU e 0,00000167 AU. Vicino all’origine SSB un piccolo errore lineare può diventare un errore angolare relativamente grande; per quel vettore il test usa la norma in AU.

Altri controlli verificano l’identità Terra–Luna, il cambio di origine eliocentrico/baricentrico, eccentricità e velocità variabile di Mercurio, variazione annuale della distanza terrestre, poli unitari, limiti temporali e cancellazione del campionamento asincrono.

## Rendering e interazione

Three.js 0.186.1 è fissato nel lockfile e servito con i suoi moduli e la licenza dallo stesso dominio; nessun CDN esegue codice. Il modello richiede WebGL 2; in sua assenza le schede e la tabella conservano le effemeridi calcolate. Le viste sono pianeti interni, sistema completo, Terra–Luna e Sole–baricentro. Gli anelli principali C/B/A di Saturno usano i limiti della [scheda NASA](https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html), orientati secondo il polo del modello IAU.

Il tempo parte a 1× sull’orologio UTC del dispositivo; accelerazioni, pausa, data scelta e ritorno ad Adesso sono espliciti. Le posizioni vengono ricalcolate fino a 30 volte al secondo quando il tempo è accelerato; la tabella si aggiorna una volta al secondo. Il renderer limita il pixel ratio, sospende il disegno fuori schermo e non applica rotazioni automatiche della camera. La vista espansa usa un dialog nativo, conserva lo stesso canvas e ripristina il focus alla chiusura.
