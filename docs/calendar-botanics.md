# Botanica del calendario Lavanda

`content/calendar-months.json` contiene dodici brevi percorsi redazionali originali: due piante, una domanda e una pratica di osservazione o lettura per mese. Sono nuovi studi di sviluppo per Lavanda — THE RIOT WITCH, non testi originali attribuiti a Martina.

Le associazioni sono scelte editoriali contemporanee di Lavanda. Non sono corrispondenze botaniche universali, attribuzioni storiche a una tradizione, indicazioni mediche o effetti dei pianeti sulle piante e sulle persone. Segni, Arcani e dati astronomici vengono gestiti separatamente dal codice del calendario.

## Stagioni e geografia

Il percorso prende come riferimento l'emisfero boreale e piante familiari al contesto italiano ed europeo. L'accostamento a un mese non certifica la presenza o la fioritura della specie in ogni luogo. Clima, quota, esposizione, varietà e andamento dell'anno modificano l'aspetto delle piante. Le indicazioni temporali britanniche di RHS e Kew non sono state trasformate in finestre di fioritura valide per l'Italia.

Il ritmo del percorso riprende alcune specie: sempreverdi in inverno, bulbose e piante a rosetta nel racconto primaverile, lavanda fra giugno e luglio, edera e rosmarino nel ritorno autunnale. La ripetizione è una scelta di continuità del quaderno, non una richiesta di trovare una specie nuova a ogni giro.

## Schema del contenuto

L'oggetto JSON usa le chiavi `january`–`december`. Ogni valore contiene `title`, `introduction` (due frasi), `question`, `practice` e un array `plants` con due elementi. `seasonNote` è opzionale. Ogni pianta contiene `commonName`, `scientificName`, `noteBotanicaBreve`, `editorialAssociation` e `sourceUrl`.

La fonte della nota botanica appare direttamente nella scheda attraverso `sourceUrl`. La lettura simbolica resta nel campo distinto `editorialAssociation`. Non sono presenti istruzioni di raccolta, ingestione, uso terapeutico o coltivazione; le pratiche chiedono di osservare, disegnare, leggere e annotare.

## Fonti primarie controllate

Controllo: 16 ottobre 2026. Per ciascuna delle undici specie sono riportate due fonti primarie: una descrizione utile alla scheda e una seconda descrizione, guida di genere o verifica tassonomica. I fatti sono parafrasati in modo breve; nessun brano è riprodotto letteralmente.

| Specie | Elementi controllati | Fonti |
| --- | --- | --- |
| *Salvia rosmarinus* | Portamento arbustivo, foglie persistenti e lineari, provenienza mediterranea; *Rosmarinus officinalis* è un sinonimo. | [RHS — rosemary](https://www.rhs.org.uk/plants/384211/salvia-rosmarinus-ro/details), [Kew POWO — nome accettato e descrizioni](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:457138-1/general-information) |
| *Hedera helix* | Sempreverde rampicante; radici aeree; differenze fra foglie dei rami rampicanti e fioriferi; piccoli fiori gialloverdi. | [RHS — common ivy](https://www.rhs.org.uk/plants/43091/hedera-helix/details), [RHS — guida Hedera](https://www.rhs.org.uk/plants/ivy/growing-guide) |
| *Galanthus nivalis* | Pianta bulbosa, foglie strette, fiori bianchi penduli, presenza della specie anche in Italia. | [Kew POWO — common snowdrop](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:64496-1/general-information), [RHS — guida Galanthus](https://www.rhs.org.uk/plants/snowdrops) |
| *Crocus vernus* | Cormo distinto da un bulbo; foglie strette; fiori a coppa bianchi o viola. | [RHS — spring crocus](https://www.rhs.org.uk/plants/29659/crocus-vernus/details), [RHS — guida Crocus](https://www.rhs.org.uk/plants/crocus/growing-guide) |
| *Narcissus pseudonarcissus* | Perenne bulbosa; foglie nastriformi; un fiore per stelo e corona centrale più scura. La guida di genere chiarisce i sei tepali. | [Kew POWO — wild daffodil](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:66177-1/general-information), [RHS — morfologia dei Narcissus](https://www.rhs.org.uk/plants/daffodils/growing-guide) |
| *Primula vulgaris* | Rosetta basale, foglie corrugate e nervature visibili; fiori generalmente giallo pallido su peduncoli singoli. | [RHS — primrose](https://www.rhs.org.uk/plants/13901/primula-vulgaris-pr-prim/details), [Kew Grow Wild — primrose](https://growwild.kew.org/plants/primrose) |
| *Rosa canina* | Arbusto delle Rosaceae presente spontaneamente in Italia; fiori rosati e cinorrodi rossi ovali. | [Kew Grow Wild — dog rose](https://growwild.kew.org/blog/wild-roses-britain), [Kew POWO — tassonomia e distribuzione](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:731955-1) |
| *Salvia officinalis* | Sempreverde legnosa, foglie grigioverdi e aromatiche; colori delle foglie variabili nelle cultivar. | [RHS — common sage](https://www.rhs.org.uk/plants/16356/salvia-officinalis/details), [RHS — descrizione della salvia](https://www.rhs.org.uk/herbs/sage/grow-your-own) |
| *Lavandula angustifolia* | Lamiaceae; arbusto sempreverde aromatico; foglie strette e gruppi di fiori all'apice degli steli. | [Kew — English lavender](https://www.kew.org/plants/english-lavender), [RHS — guida Lavandula](https://www.rhs.org.uk/plants/lavender/growing-guide) |
| *Acer campestre* | Albero deciduo, foglie a cinque lobi, colorazione autunnale e frutti alati; nome accettato. | [RHS — field maple](https://www.rhs.org.uk/plants/166/acer-campestre/details), [Kew POWO — tassonomia](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:781250-1/general-information) |
| *Ilex aquifolium* | Sempreverde, foglie spesso spinose ma variabili sullo stesso individuo, sessi generalmente separati. | [Kew POWO — common holly](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:83051-1/general-information), [RHS — common holly](https://www.rhs.org.uk/plants/9087/ilex-aquifolium/details) |

Le fonti possono comprendere sezioni su alimentazione, salute, folklore o tecniche colturali. Le schede del calendario usano soltanto i fatti botanici indicati nella tabella; quelle altre sezioni non fondano le associazioni editoriali e non vengono presentate come pratiche di Lavanda.
