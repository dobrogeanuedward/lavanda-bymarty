# Lunazione: alchimia, Arcani e botanica

`content/lunar-phases.json` contiene otto percorsi redazionali originali di Lavanda — THE RIOT WITCH. Ogni fase raccoglie un'introduzione, una nota alchemica, una domanda, una pratica di lettura o osservazione, due Arcani e due piante. Sono nuovi studi editoriali della rivista, non testi originali attribuiti a Martina.

## La composizione di Lavanda

L'accostamento fra fasi lunari, colori alchemici, Arcani e piante è una composizione contemporanea di Lavanda. I nomi delle fasi lunari individuano configurazioni astronomiche; i quattro nomi alchemici organizzano un percorso culturale e simbolico. La sequenza della rivista non pretende di rappresentare una corrispondenza storica universale.

L'ordine segue otto passaggi della lunazione. I quattro principali ricevono Nigredo, Albedo, Citrinitas e Rubedo; i quattro intermedi prolungano il capitolo editoriale precedente. Questa scelta permette di accostare oscurità e decomposizione delle forme, chiarificazione, luce e coscienza, integrazione e concretezza dei corpi. Questi temi restano interpretazioni editoriali: il contenuto non attribuisce alla Luna effetti sulla salute, sul carattere, sulla crescita delle piante o sui tempi di raccolta.

| Chiave | Fase lunare | Capitolo editoriale | Arcani RWS | Criterio della coppia |
| --- | --- | --- | --- | --- |
| `new` | Luna nuova | Nigredo | XIII La Morte; II La Papessa | Disfare una forma e lasciare esistere ciò che non è ancora nominato. |
| `waxing-crescent` | Falce crescente | Nigredo | I Il Mago; II La Papessa | Provare un gesto concreto mantenendo aperta la domanda. |
| `first-quarter` | Primo quarto | Albedo | XIV La Temperanza; XVII La Stella | Distinguere e comporre senza imporre una soluzione unica. |
| `waxing-gibbous` | Gibbosa crescente | Albedo | IX L'Eremita; XIV La Temperanza | Lavorare sui dettagli e rivedere i rapporti fra le parti. |
| `full` | Luna piena | Citrinitas | XIX Il Sole; XX Il Giudizio | Rendere visibile e rileggere ciò che entra nella scena. |
| `waning-gibbous` | Gibbosa calante | Citrinitas | XII L'Appeso; XIX Il Sole | Cambiare punto di vista e condividere una lettura. |
| `last-quarter` | Ultimo quarto | Rubedo | XXI Il Mondo; VIII La Forza | Dare consistenza alle relazioni e riconoscere ciò che sostengono. |
| `waning-crescent` | Falce calante | Rubedo | VIII La Forza; IX L'Eremita | Custodire con misura e lasciare una domanda al prossimo giro. |

Gli Arcani sono identificati da numeri interi, risolti attraverso `src/natal-tarot.js`. La numerazione è Rider–Waite–Smith: Forza VIII, Giustizia XI. Le coppie qui selezionate sono originali di Lavanda; i contenuti delle carte rimangono quelli già presenti nel progetto. La prima carta è il riferimento principale, la seconda una lettura complementare.

## Lessico alchemico e limiti dell'attribuzione storica

Elisabeth Moreau documenta i quattro colori nella tradizione alchemica occidentale medievale e rinascimentale: nero (*nigredo*), bianco (*albedo*), giallo (*citrinitas*) e rosso (*rubedo*). Lo studio li colloca nelle teorie della materia e nelle analogie mediche proprie di quell'epoca; tali teorie sono qui oggetto di storia, non spiegazioni scientifiche attuali. [Moreau, *Colours, humours and material change in late Renaissance chymistry and medicine*, BJHS Themes 10, 2025, pp. 171–190](https://www.cambridge.org/core/journals/bjhs-themes/article/colours-humours-and-material-change-in-late-renaissance-chymistry-and-medicine/026E2624B83C47FAD1AC7859533C5A17), DOI [10.1017/bjt.2025.10021](https://doi.org/10.1017/bjt.2025.10021).

Jennifer M. Rampling mostra che il ruolo del giallo e della citrinazione mutò fra pratiche e testi. La sequenza di quattro colori non ebbe sempre lo stesso peso; il giallo poteva comparire come passaggio instabile o segno di cambiamento materiale. Questo sostiene una presentazione contestualizzata, senza trasformare le quattro parole in un codice immutabile. [Rampling, *Citrination and its Discontents: Yellow as a Sign of Alchemical Change*, Ambix 71(1), 2024, pp. 73–97](https://doi.org/10.1080/00026980.2024.2309059).

Queste ricerche sostengono l'uso dei nomi e dei colori. L'abbinamento specifico Luna nuova → Nigredo, primo quarto → Albedo, Luna piena → Citrinitas e ultimo quarto → Rubedo appartiene alla redazione di Lavanda. Anche il prolungamento dei quattro capitoli alle fasi intermedie, le domande e le letture delle piante sono nuove scelte editoriali.

## Fatti botanici e fonti

Le sedici schede riprendono deliberatamente undici specie già studiate nel calendario. Le ricorrenze permettono di cambiare la lettura editoriale conservando riconoscibile la pianta. Nessuna collocazione in una fase lunare indica una fioritura, una disponibilità locale o un'attività da svolgere sulla pianta. Le pratiche chiedono di disegnare, osservare, leggere e annotare.

Le note botaniche sono brevi parafrasi di fonti primarie RHS e Kew, controllate il 16 ottobre 2026. `sourceUrl` collega ogni nota alla fonte pertinente. La tabella conserva un secondo riferimento per specie; [calendar-botanics.md](calendar-botanics.md) documenta anche il criterio geografico e stagionale del calendario.

| Specie | Dettagli impiegati nella lunazione | Fonti primarie |
| --- | --- | --- |
| *Hedera helix* | Sempreverde rampicante, radici aeree e forme fogliari differenti. | [RHS — common ivy](https://www.rhs.org.uk/plants/43091/hedera-helix/details), [RHS — Hedera](https://www.rhs.org.uk/plants/ivy/growing-guide) |
| *Salvia rosmarinus* | Sempreverde mediterraneo, foglie lineari, pagina inferiore chiara e portamento variabile. | [RHS — rosemary](https://www.rhs.org.uk/plants/384211/salvia-rosmarinus-ro/details), [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:457138-1/general-information) |
| *Crocus vernus* | Cormo e fiori a coppa bianchi o viola. | [RHS — spring crocus](https://www.rhs.org.uk/plants/29659/crocus-vernus/details), [RHS — Crocus](https://www.rhs.org.uk/plants/crocus/growing-guide) |
| *Ilex aquifolium* | Foglie persistenti lucide, margini variabili e sessi generalmente separati. | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:83051-1/general-information), [RHS — common holly](https://www.rhs.org.uk/plants/9087/ilex-aquifolium/details) |
| *Galanthus nivalis* | Bulbo, foglie strette, fiori penduli; tre segmenti interni più piccoli con marcature verdi. | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:64496-1/general-information), [RHS — Galanthus](https://www.rhs.org.uk/plants/snowdrops) |
| *Primula vulgaris* | Perenne a rosetta, foglie corrugate e peduncoli fiorali singoli. | [Kew Grow Wild — primrose](https://growwild.kew.org/plants/primrose), [RHS — primrose](https://www.rhs.org.uk/plants/13901/primula-vulgaris-pr-prim/details) |
| *Salvia officinalis* | Sempreverde legnosa, foglie aromatiche grigioverdi e nervature fitte. | [RHS — common sage](https://www.rhs.org.uk/plants/16356/salvia-officinalis/details), [RHS — descrizione della salvia](https://www.rhs.org.uk/herbs/sage/grow-your-own) |
| *Narcissus pseudonarcissus* | Perenne bulbosa, foglie nastriformi, un fiore per stelo e due tonalità di giallo. | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:66177-1/general-information), [RHS — Narcissus](https://www.rhs.org.uk/plants/daffodils/growing-guide) |
| *Lavandula angustifolia* | Arbusto aromatico sempreverde, foglie strette, disposizione dei fiori e famiglia Lamiaceae. | [Kew — English lavender](https://www.kew.org/plants/english-lavender), [RHS — Lavandula](https://www.rhs.org.uk/plants/lavender/growing-guide) |
| *Acer campestre* | Albero deciduo, foglie a cinque lobi arrotondati e frutti alati. | [RHS — field maple](https://www.rhs.org.uk/plants/166/acer-campestre/details), [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:781250-1/general-information) |
| *Rosa canina* | Arbusto delle siepi, fiori rosati e cinorrodi rossi ovali. | [Kew Grow Wild — dog rose](https://growwild.kew.org/blog/wild-roses-britain), [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:731955-1) |

Le associazioni editoriali si appoggiano a forme, colori, ritorni e relazioni visibili; non trasformano queste osservazioni in effetti botanici della Luna. La Nigredo, per esempio, è il capitolo della decomposizione delle forme nel racconto: la presenza di edera o rosmarino non attribuisce a tali piante il ruolo biologico di decompositori.

## Verifica del contenuto

Il JSON usa esattamente le otto chiavi richieste. Ogni fase contiene due schede pianta, due frasi introduttive e due Arcani RWS validi fra 0 e 21. Nessuna immagine nuova è necessaria. Le fonti botaniche accompagnano i fatti nei campi `noteBotanicaBreve`; i campi `editorialAssociation` e `alchemyNote` dichiarano le letture della rivista.
