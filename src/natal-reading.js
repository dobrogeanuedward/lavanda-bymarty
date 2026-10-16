import { SIGNS } from './natal-engine.js';
import { TAROT_CARDS, SIGN_ARCANA } from './natal-tarot.js';

// These interpretations are original cultural readings by Lavanda.
// Only the Arcana correspondences below refer to the verified Golden Dawn table.
const subjectName = key => key === 'sun' ? 'il Sole' : key === 'moon' ? 'la Luna' : PRINCIPLES[key].name;
const PLANET_ARCANA = Object.freeze({ sun: 19, moon: 2, mercury: 1, venus: 3, mars: 16, jupiter: 10, saturn: 21 });
const PRINCIPLES = {
  sun: { name: 'Sole', topic: 'orientamento e presenza', text: 'Il Sole è qui una domanda sul centro che scegliamo di dare alla nostra esperienza. La presenza non coincide con l’essere sempre visibili: può acquistare forma nella coerenza fra ciò che desideriamo, ciò che facciamo e ciò a cui concediamo attenzione.', questions: ['Che cosa desidero rendere riconoscibile nel mio modo di esserci?', 'Quale scelta sostiene il mio orientamento, anche senza un riconoscimento esterno?'] },
  moon: { name: 'Luna', topic: 'memoria e ritmi quotidiani', text: 'La Luna apre una lettura di memorie, consuetudini e ritmi. Possiamo osservare che cosa rende un luogo abitabile e quali risposte abbiamo imparato a ripetere. La familiarità può offrire sostegno e, nello stesso tempo, chiedere di essere ripensata.', questions: ['Quale abitudine mi offre un appoggio e quale desidero interrogare?', 'Come riconosco il bisogno di una pausa senza doverlo giustificare?'] },
  mercury: { name: 'Mercurio', topic: 'linguaggio e scambio', text: 'Mercurio porta il pensiero verso il gesto di nominare, tradurre e mettere in relazione. Ogni parola rende visibile qualcosa e lascia altro sul margine. La comprensione può crescere quando una conversazione ammette domande, revisioni e differenze di linguaggio.', questions: ['Quale parola sto usando come se avesse lo stesso significato per tutti?', 'Che cosa cambia se provo a raccontare questa esperienza con un altro esempio?'] },
  venus: { name: 'Venere', topic: 'valore e incontro', text: 'Venere permette di interrogare ciò a cui attribuiamo valore: un incontro, una forma, un piacere, un tempo condiviso. La domanda riguarda anche le condizioni che rendono possibile scegliere e la distanza fra un desiderio proprio e un modello ricevuto.', questions: ['Che cosa desidero per il suo valore, e che cosa per il riconoscimento che promette?', 'Quali condizioni rendono un incontro libero e reciproco?'] },
  mars: { name: 'Marte', topic: 'azione e confine', text: 'Marte mette al centro l’azione, l’attrito e la possibilità di dire di sì o di no. La fermezza può essere osservata come una relazione con i limiti: quali proteggiamo, quali incontriamo e come rispondiamo quando due intenzioni non coincidono.', questions: ['Quale confine desidero rendere più chiaro?', 'Come posso dare forma a un’intenzione senza cancellare quella altrui?'] },
  jupiter: { name: 'Giove', topic: 'orizzonte e significato', text: 'Giove apre il campo delle cornici di senso: i racconti con cui allarghiamo una prospettiva e rendiamo desiderabile un percorso. L’ampiezza acquista spessore quando incontra il dettaglio, le condizioni materiali e la possibilità che una fonte contraddica la nostra mappa.', questions: ['Quale racconto rende più ampio il mio orizzonte?', 'Che cosa potrebbe chiedermi di correggere quella mappa?'] },
  saturn: { name: 'Saturno', topic: 'tempo e responsabilità', text: 'Saturno offre una lente sul tempo, sulle strutture e sulla responsabilità. Un limite può sostenere un lavoro oppure farlo diventare una gabbia. Interrogarlo significa rendere visibile chi stabilisce la misura, chi ne beneficia e chi ne sostiene il peso.', questions: ['Quale limite rende possibile il mio lavoro e quale lo impoverisce?', 'Quale responsabilità ho scelto, e quale ho ricevuto senza discuterla?'] },
  uranus: { name: 'Urano', topic: 'discontinuità e possibilità', text: 'Nella proposta di Lavanda, Urano è una figura della discontinuità: il punto in cui una consuetudine smette di apparire inevitabile. La possibilità di cambiare si confronta con i legami e con le condizioni concrete, senza trasformare ogni rottura in una liberazione.', questions: ['Quale alternativa diventa visibile quando smetto di chiamare inevitabile una regola?', 'Che cosa vorrei conservare anche dentro un cambiamento?'] },
  neptune: { name: 'Nettuno', topic: 'immagine e porosità', text: 'Nettuno viene letto da Lavanda come una domanda sull’immaginazione e sulla porosità dei confini. Un’immagine può aprire un’esperienza; può anche rendere difficile distinguere un desiderio da un’osservazione. La ricerca lascia a entrambi uno spazio riconoscibile.', questions: ['Quale immagine mi accompagna, e quali osservazioni la sostengono?', 'Dove un confine più chiaro renderebbe possibile restare in relazione?'] },
  pluto: { name: 'Plutone', topic: 'potere e trasformazione', text: 'Plutone è qui una lente sui rapporti di potere e sulle forme che cambiano quando ne emergono le condizioni nascoste. La profondità non richiede di trovare un segreto dietro ogni cosa: può essere un’attenzione alle risorse, ai silenzi e alle possibilità di scelta.', questions: ['Quale rapporto di potere rimane sullo sfondo del mio racconto?', 'Chi può scegliere dentro questa situazione, e con quali risorse?'] },
};

const STYLES = [
  ['Iniziare e prendere posizione', 'Ariete propone uno stile dell’inizio: mettere un’intenzione in movimento, nominare una posizione e misurarla nell’incontro. La direzione emerge attraverso il gesto, senza essere già una garanzia sul suo esito.', 'La tensione è fra la chiarezza del primo passo e il tempo necessario ad ascoltarne le conseguenze. Decidere e rivedere possono appartenere allo stesso movimento.', 'Quale primo passo posso fare mantenendo aperta la possibilità di correggerlo?'],
  ['Dare continuità e consistenza', 'Toro porta l’attenzione alla continuità, alla materia e a ciò che offre sostegno. Uno stile può prendere forma nella ripetizione di un gesto, nell’uso delle risorse e nella possibilità di abitare un tempo meno accelerato.', 'La tensione è fra custodire ciò che sostiene e lasciare che una forma cambi. Una continuità scelta può essere distinta da un’abitudine diventata obbligo.', 'Che cosa desidero custodire, e che cosa sto mantenendo soltanto perché è familiare?'],
  ['Tradurre e attraversare differenze', 'Gemelli apre uno stile fatto di passaggi, domande e traduzioni. Un’esperienza può essere osservata da più angolazioni: la pluralità acquista valore quando rende una relazione più leggibile, invece di dissolvere ogni criterio.', 'La tensione è fra moltiplicare le possibilità e assumere una scelta temporanea. Lasciare una domanda aperta non impedisce di darle, per ora, una forma.', 'Quale differenza di linguaggio potrebbe aggiungere qualcosa alla mia comprensione?'],
  ['Costruire appartenenza', 'Cancro propone una lente sui luoghi, sulle memorie e sulle forme di appartenenza. La protezione può essere pensata come una pratica condivisa, capace di riconoscere che le persone abitano uno stesso spazio con bisogni differenti.', 'La tensione è fra offrire un riparo e lasciare libertà di movimento. Un legame può restare significativo anche quando cambia la distanza fra chi vi partecipa.', 'Quale forma di vicinanza permette a ciascuno di conservare una voce propria?'],
  ['Rendere visibile una presenza', 'Leone mette in gioco lo spazio della presenza e dell’espressione. Dare una forma riconoscibile a ciò che facciamo può aprire uno scambio: il riconoscimento diventa una relazione, non una prova definitiva del nostro valore.', 'La tensione è fra il desiderio di essere visti e la possibilità di condividere la scena. La visibilità può accogliere anche ciò che non vuole esibirsi.', 'Come cambia il mio modo di esprimermi quando considero anche lo spazio degli altri?'],
  ['Distinguere e prendersi cura del dettaglio', 'Vergine offre uno stile dell’attenzione: distinguere le parti, osservare un dettaglio e rendere una pratica più leggibile. La precisione può diventare una forma di cura del lavoro e delle condizioni in cui viene svolto.', 'La tensione è fra migliorare una forma e concederle di essere incompiuta. Un criterio utile può essere rivisto quando comincia a sottrarre spazio all’esperienza.', 'Quale dettaglio merita attenzione, e quale posso lasciare provvisorio?'],
  ['Esplicitare la misura di una relazione', 'Bilancia apre uno stile del confronto e della misura. Un accordo diventa più comprensibile quando rende visibili i propri criteri e le differenze fra le persone che coinvolge, comprese quelle di risorse e di potere.', 'La tensione è fra cercare un accordo e conservare la possibilità del dissenso. L’equilibrio non richiede che ogni posizione occupi, in ogni momento, lo stesso spazio.', 'Quale differenza deve entrare nell’accordo perché sia discutibile e condivisibile?'],
  ['Sostare sulle soglie del cambiamento', 'Scorpione propone uno stile che interroga intensità, fiducia e passaggi. La soglia rende visibile il rapporto fra ciò che desideriamo trattenere e ciò che può cambiare, senza imporre una trasformazione a ogni esperienza.', 'La tensione è fra cercare profondità e lasciare un margine di riservatezza. Un incontro non diventa più vero soltanto perché pretende di conoscere tutto.', 'Quale parte di un’esperienza posso rispettare senza doverla possedere o spiegare?'],
  ['Allargare una prospettiva', 'Sagittario porta lo sguardo alle mappe, ai racconti e agli incontri che allargano una prospettiva. Uno stile di ricerca può tenere insieme il desiderio di un orizzonte e l’attenzione alle storie concrete che lo compongono.', 'La tensione è fra la forza di una visione e la disponibilità a verificarla. Una domanda precisa può dare più respiro a una mappa di una spiegazione universale.', 'Quale incontro o fonte potrebbe rendere più complessa la mia visione?'],
  ['Costruire nel tempo', 'Capricorno propone uno stile della costruzione: dare continuità a un lavoro, riconoscere i vincoli e rendere esplicite le responsabilità. Una struttura acquista significato anche attraverso le condizioni materiali di chi la sostiene.', 'La tensione è fra il valore della durata e il costo della prestazione continua. Portare a termine qualcosa può includere il diritto a cambiarne la misura.', 'Quale misura del lavoro lascia spazio anche al limite e alla pausa?'],
  ['Ripensare il comune', 'Acquario apre uno stile che osserva le forme del comune da una certa distanza. Una regola o un’appartenenza possono essere interrogate per immaginare alternative, rendendo visibili le differenze che un insieme tende a lasciare fuori.', 'La tensione è fra cercare un orizzonte collettivo e ascoltare la singolarità di chi lo abita. Un’idea condivisa può mantenere aperta la possibilità di modificarla.', 'Chi resta fuori dall’idea di comunità che sto usando?'],
  ['Lasciare spazio all’immaginazione', 'Pesci propone uno stile della risonanza e dell’immaginazione. Le immagini possono mettere in relazione esperienze lontane, purché resti riconoscibile il passaggio fra un’osservazione, una memoria e una lettura simbolica.', 'La tensione è fra la disponibilità a lasciarsi attraversare e la necessità di dare una forma all’esperienza. Un confine può sostenere uno scambio invece di chiuderlo.', 'Quale forma aiuterebbe un’intuizione a diventare condivisibile senza esaurirla?'],
].map(([title, text, tension, question]) => ({ title, text, tension, question }));

const CONTEXTS = [
  ['Presenza e modo di entrare', 'La prima casa apre il contesto della presenza: come entriamo in una situazione, rendiamo riconoscibile un’intenzione e incontriamo lo sguardo altrui. Qui una forma personale può essere pensata insieme alle condizioni dell’incontro.', 'Come desidero entrare in una situazione senza doverne controllare ogni risposta?'],
  ['Risorse e valore', 'La seconda casa offre un contesto per interrogare risorse, disponibilità e criteri di valore. Il sostegno materiale può essere osservato insieme alla possibilità di scegliere e alla distribuzione del tempo e dei mezzi.', 'Quali risorse rendono praticabile ciò a cui attribuisco valore?'],
  ['Linguaggi e prossimità', 'La terza casa porta la riflessione negli scambi vicini, nell’apprendimento e nei linguaggi quotidiani. Le parole con cui orientiamo una giornata possono essere rilette insieme a chi ci ascolta e a ciò che abbiamo ancora da imparare.', 'Quale conversazione quotidiana vorrei rendere più attenta?'],
  ['Radici e luoghi abitabili', 'La quarta casa apre il contesto di memorie, radici e luoghi abitabili. Un’origine può essere riconosciuta senza diventare un obbligo a ripeterla; l’appartenenza può includere il diritto di scegliere una distanza.', 'Che cosa rende un luogo abitabile per me oggi?'],
  ['Creazione e gioco', 'La quinta casa offre spazio a creazione, gioco ed espressione. Un gesto può avere valore anche senza diventare un risultato da esibire: il contesto invita a interrogare il tempo disponibile per provare, inventare e lasciare qualcosa aperto.', 'Dove posso concedermi un tentativo che non debba subito diventare utile?'],
  ['Pratiche e lavoro quotidiano', 'La sesta casa porta l’attenzione a pratiche ripetute, lavoro quotidiano e condizioni della cura. Una routine può essere osservata insieme a chi ne sostiene il peso e alle possibilità concrete di riposo e di revisione.', 'Quale pratica quotidiana sostiene la mia giornata e chi la rende possibile?'],
  ['Accordi e incontro', 'La settima casa apre il contesto degli accordi e dell’incontro con un’altra posizione. Reciprocità e differenza possono essere pensate insieme: un rapporto resta discutibile quando ciascuno conserva la possibilità di nominarsi e di dissentire.', 'Quale accordo renderebbe più riconoscibile la voce di entrambe le parti?'],
  ['Risorse condivise e fiducia', 'L’ottava casa offre una lente su risorse condivise, fiducia e rapporti di dipendenza. Condividere può richiedere di rendere visibili le condizioni, i margini di scelta e la possibilità di rinegoziare un impegno.', 'Quali condizioni di uno scambio comune meritano di essere esplicitate?'],
  ['Mappe e orizzonti', 'La nona casa apre il contesto delle mappe di senso, delle fonti e dell’incontro con altre prospettive. Un orizzonte può allargarsi quando una tradizione viene situata nella propria storia e lascia spazio a una domanda nuova.', 'Quale fonte o prospettiva desidero incontrare senza ridurla alla mia mappa?'],
  ['Ruolo pubblico e responsabilità', 'La decima casa porta la riflessione verso ruoli pubblici, responsabilità e forme del riconoscimento. Il contesto invita a distinguere una posizione scelta dalle aspettative che la accompagnano e dal lavoro che spesso rimane fuori dalla scena.', 'Quale responsabilità pubblica desidero assumere e con quali condizioni?'],
  ['Reti e progetti comuni', 'L’undicesima casa apre il contesto di reti, amicizie e progetti comuni. Un’appartenenza può essere osservata attraverso le sue pratiche: come si decide, quali differenze trovano ascolto e quanto è possibile modificare le regole.', 'Quale differenza vorrei che trovasse più spazio in un progetto comune?'],
  ['Retroscena e tempo invisibile', 'La dodicesima casa offre una lente sui retroscena, sul silenzio e sul tempo che non viene riconosciuto come produzione. Può rendere visibili un lavoro nascosto e il diritto a un’esperienza che non debba sempre essere spiegata o mostrata.', 'Quale parte invisibile della mia esperienza desidero riconoscere senza esibirla?'],
].map(([title, text, question]) => ({ title, text, question }));

const ASPECTS = {
  conjunction: { label: 'Congiunzione', text: 'Due principi vengono accostati nella stessa scena. La domanda è come riconoscere la voce di ciascuno senza presumere che dicano la stessa cosa.', question: 'Quali due esigenze sto trattando come se fossero una sola?' },
  opposition: { label: 'Opposizione', text: 'Due poli possono rendere visibile una differenza. La lettura invita a cercare una relazione che lasci esistere entrambi, senza trasformare il confronto in una scelta obbligata fra vincitore e sconfitto.', question: 'Quale distanza rende possibile ascoltare entrambe le posizioni?' },
  square: { label: 'Quadratura', text: 'Una frizione può mostrare che due esigenze non trovano ancora una forma comune. Il confronto riguarda le condizioni della situazione, senza assegnare un difetto alla persona che la attraversa.', question: 'Quale condizione potrebbe cambiare per rendere più abitabile questa tensione?' },
  trine: { label: 'Trigono', text: 'Una continuità permette di osservare che cosa collega due principi. La facilità può essere riconosciuta come una risorsa e, insieme, interrogata quando diventa un automatismo che non lascia vedere altre possibilità.', question: 'Che cosa funziona con continuità, e che cosa merita ancora una domanda?' },
  sextile: { label: 'Sestile', text: 'Un collegamento offre una possibilità di scambio fra due principi. La lettura lascia aperto come coltivarlo: un gesto, una conversazione o una revisione possono dare una forma concreta a quella possibilità.', question: 'Quale gesto renderebbe più concreto questo collegamento?' },
};

const validSign = value => Number.isInteger(value) && value >= 0 && value < 12;
const unknownTime = chart => (chart?.meta?.unknownTime ?? chart?.unknownTime) === true;
const positions = chart => Array.isArray(chart?.planets) ? chart.planets.filter(point => point && Object.hasOwn(PRINCIPLES, point.key)) : [];
const signIndex = value => validSign(value) ? value : SIGNS.findIndex(sign => sign.key === String(value).toLowerCase());
const pointSigns = point => {
  if (!point) return [];
  if (Array.isArray(point.possibleSignIndices)) return point.possibleSignIndices.every(validSign) ? [...new Set(point.possibleSignIndices)] : [];
  return validSign(point.signIndex) && point.signCertain !== false ? [point.signIndex] : [];
};
const certainSign = point => {
  const options = pointSigns(point);
  return point?.signCertain !== false && options.length === 1 && (!validSign(point.signIndex) || point.signIndex === options[0]) ? options[0] : null;
};
const join = values => values.length < 2 ? values[0] || '' : values.slice(0, -1).join(', ') + ' e ' + values.at(-1);
const housesFor = (chart, index) => unknownTime(chart) || !Array.isArray(chart?.houses) ? [] : [...new Map(chart.houses.filter(house => house?.signIndex === index && Number.isInteger(house.number) && house.number >= 1 && house.number <= 12).map(house => [house.number, house])).values()];
const descriptor = (type, key, label) => ({ type, key, label });
const signRelated = index => descriptor('sign', SIGNS[index].key, SIGNS[index].name);
const planetRelated = point => descriptor('planet', point.key, PRINCIPLES[point.key].name);
const angleRelated = key => descriptor('angle', key, key === 'ascendant' ? 'Ascendente' : 'Medio Cielo');

function addCard(cards, number, reason) {
  if (!cards.some(item => item.card === number)) cards.push({ card: number, reason });
}
function finish(panel) {
  panel.related = [...new Map(panel.related.filter(item => !(item.type === panel.type && item.key === panel.key)).map(item => [`${item.type}:${item.key}`, item])).values()];
  panel.questions = [...new Set(panel.questions)].slice(0, 3);
  return panel;
}
function base(type, key, title, intro) {
  return { type, key, title, kicker: 'Lettura simbolica · proposta originale di Lavanda', intro, sections: [], questions: [], cards: [], related: [] };
}
function addHouses(panel, chart, index) {
  const houses = housesFor(chart, index);
  for (const house of houses) {
    const context = CONTEXTS[house.number - 1];
    panel.sections.push({ title: `Casa ${house.number} · ${context.title}`, text: context.text });
  }
  return houses[0] ? CONTEXTS[houses[0].number - 1].question : null;
}

function describePlanet(chart, key) {
  const principle = Object.hasOwn(PRINCIPLES, key) ? PRINCIPLES[key] : null, point = positions(chart).find(point => point.key === key);
  if (!principle || !point) return null;
  const index = certainSign(point), options = pointSigns(point), unknown = unknownTime(chart);
  const panel = base('planet', key, index === null ? `${principle.name} · il segno resta aperto` : `${principle.name} in ${SIGNS[index].name}`, principle.text);
  let contextQuestion;
  if (index !== null) {
    const style = STYLES[index];
    panel.sections.push({ title: `${principle.name} in ${SIGNS[index].name} · ${style.title}`, text: `${style.text} In questa combinazione la lente è ${principle.topic}.` });
    panel.sections.push({ title: 'Una tensione da interrogare', text: style.tension });
    contextQuestion = addHouses(panel, chart, index);
    panel.questions.push(style.question);
    addCard(panel.cards, SIGN_ARCANA[index], `${principle.name} in ${SIGNS[index].name} → ${TAROT_CARDS[SIGN_ARCANA[index]].name}`);
    if (Object.hasOwn(PLANET_ARCANA, key)) addCard(panel.cards, PLANET_ARCANA[key], `Corrispondenza planetaria ${key === 'sun' ? 'del Sole' : key === 'moon' ? 'della Luna' : `di ${principle.name}`} · Golden Dawn`);
    panel.related.push(signRelated(index));
  } else {
    panel.sections.push({ title: 'La posizione non è assegnata a un solo segno', text: options.length ? `Nell’intervallo calcolato ${subjectName(key)} può essere in ${join(options.map(index => SIGNS[index].name))}. Ogni possibilità rimane distinta: queste letture non descrivono un segno certo della nascita.` : 'I dati disponibili non permettono di assegnare un segno certo. Il principio simbolico può essere esplorato senza attribuirgli una posizione.' });
    for (const option of options) {
      panel.sections.push({ title: `Se ${subjectName(key)} fosse in ${SIGNS[option].name}`, text: STYLES[option].text });
      addCard(panel.cards, SIGN_ARCANA[option], `Se ${subjectName(key)} fosse in ${SIGNS[option].name} → ${TAROT_CARDS[SIGN_ARCANA[option]].name}`);
      panel.related.push(descriptor('sign', SIGNS[option].key, `${SIGNS[option].name} · possibilità`));
    }
    panel.questions.push('Quali parti di queste possibilità parlano alla mia esperienza, e quali desidero lasciare aperte?');
  }
  if (typeof point.retrograde === 'boolean') panel.sections.push({ title: point.retrograde ? 'Moto apparente retrogrado' : 'Moto apparente diretto', text: `${unknown ? 'Nell’intervallo calcolato' : 'All’istante calcolato'} il moto geocentrico apparente è ${point.retrograde ? 'retrogrado' : 'diretto'}. Lavanda usa il dato per interrogare il rapporto fra avanzare e rivedere, senza assegnargli un esito necessario o un giudizio sulla persona.` });
  if (!unknown && index !== null) {
    const byKey = new Map(positions(chart).map(point => [point.key, point]));
    const aspects = (Array.isArray(chart.aspects) ? chart.aspects : []).filter(aspect => aspect && Object.hasOwn(ASPECTS, aspect.type) && Number.isFinite(aspect.orb) && aspect.orb >= 0 && (aspect.from === key || aspect.to === key)).map(aspect => ({ ...aspect, other: byKey.get(aspect.from === key ? aspect.to : aspect.from) })).filter(aspect => aspect.other && certainSign(aspect.other) !== null).sort((a, b) => a.orb - b.orb).slice(0, 3);
    for (const aspect of aspects) {
      const other = PRINCIPLES[aspect.other.key], meaning = ASPECTS[aspect.type];
      panel.sections.push({ title: `${meaning.label} con ${other.name}`, text: `${meaning.text} Qui il confronto è fra «${principle.topic}» e «${other.topic}». ${meaning.question} Orbe calcolato: ${aspect.orb.toFixed(1).replace('.', ',')}°.` });
      panel.related.push(planetRelated(aspect.other));
    }
  }
  panel.questions.push(contextQuestion || principle.questions[0], principle.questions[1]);
  if (unknown || index === null) panel.caveat = unknown ? 'Ora sconosciuta: nessuna casa o lettura degli aspetti viene attribuita. Un segno indicato come certo rimane tale nell’intervallo della giornata calcolato, non stabilisce l’ora di nascita.' : 'Un segno incerto non viene trasformato in una posizione certa. Le associazioni degli Arcani restano condizionali.';
  if (!Object.hasOwn(PLANET_ARCANA, key)) panel.caveat = [panel.caveat, `${principle.name} non riceve qui una corrispondenza planetaria diretta Golden Dawn. Gli Arcani proposti derivano soltanto dai segni; il testo del pianeta è una scelta simbolica di Lavanda.`].filter(Boolean).join(' ');
  return finish(panel);
}

function describeSign(chart, index) {
  if (!validSign(index)) return null;
  const sign = SIGNS[index], style = STYLES[index], all = positions(chart);
  const certain = all.filter(point => certainSign(point) === index);
  const possible = all.filter(point => certainSign(point) === null && pointSigns(point).includes(index));
  const angles = unknownTime(chart) ? [] : ['ascendant', 'midheaven'].filter(key => certainSign(chart[key]) === index);
  const panel = base('sign', sign.key, sign.name, style.text);
  panel.sections.push({ title: 'Stile e tensione', text: style.tension });
  panel.sections.push({ title: 'Le presenze nella carta', text: certain.length ? `In questo segno sono assegnati con certezza ${join(certain.map(point => PRINCIPLES[point.key].name))}. ${certain.slice(0, 3).map(point => `${PRINCIPLES[point.key].name} apre la lente di ${PRINCIPLES[point.key].topic}.`).join(' ')}` : 'Nessun pianeta viene assegnato con certezza a questo segno nella carta. Questo dato non indica una mancanza di qualità: il segno resta una lente simbolica da esplorare, senza farne una misura della persona.' });
  if (possible.length) panel.sections.push({ title: 'Presenze possibili, non assegnate', text: `${join(possible.map(point => PRINCIPLES[point.key].name))} ${possible.length === 1 ? 'potrebbe' : 'potrebbero'} trovarsi in ${sign.name} nell’intervallo calcolato. La possibilità viene mantenuta distinta dalle posizioni certe.` });
  if (angles.length) panel.sections.push({ title: 'I punti di orientamento', text: `${join(angles.map(key => key === 'ascendant' ? 'Ascendente' : 'Medio Cielo'))} ${angles.length === 1 ? 'cade' : 'cadono'} in ${sign.name} nella carta calcolata. Puoi seguire ${angles.length === 1 ? 'questo punto' : 'questi punti'} per interrogare ${angles.length === 2 ? 'il modo di entrare in una situazione e il rapporto con un ruolo pubblico' : angles[0] === 'ascendant' ? 'il modo di entrare in una situazione' : 'il rapporto con un ruolo pubblico'}.` });
  const contextQuestion = addHouses(panel, chart, index);
  panel.questions.push(style.question, contextQuestion || 'Che cosa di questa lente desidero tenere, discutere o riscrivere?', 'Come cambia questa lettura se la confronto con una situazione concreta?');
  const conditional = !certain.length && !angles.length && possible.length;
  addCard(panel.cards, SIGN_ARCANA[index], conditional ? `Se ${join(possible.map(point => subjectName(point.key)))} ${possible.length === 1 ? 'fosse' : 'fossero'} in ${sign.name} → ${TAROT_CARDS[SIGN_ARCANA[index]].name}` : `Corrispondenza del segno ${sign.name} → ${TAROT_CARDS[SIGN_ARCANA[index]].name}`);
  panel.related.push(...certain.map(planetRelated), ...possible.map(point => descriptor('planet', point.key, `${PRINCIPLES[point.key].name} · segno incerto`)), ...angles.map(angleRelated));
  if (unknownTime(chart)) panel.caveat = 'Ora sconosciuta: case e punti di orientamento non vengono attribuiti. Le presenze possibili sono separate da quelle certe nell’intervallo della giornata calcolato.';
  return finish(panel);
}

function describeAngle(chart, key) {
  if (!['ascendant', 'midheaven'].includes(key)) return null;
  const name = key === 'ascendant' ? 'Ascendente' : 'Medio Cielo', point = chart[key], index = certainSign(point);
  if (unknownTime(chart) || index === null) {
    const panel = base('angle', key, `${name} non disponibile`, unknownTime(chart) ? 'Questo punto richiede un’ora di nascita attendibile. Una mappa del giorno non gli assegna un segno.' : 'Il calcolo non restituisce un punto disponibile per questi dati. La posizione non viene ricostruita attraverso un’ipotesi.');
    panel.caveat = 'Nessun segno, casa o Arcano viene attribuito a un punto non disponibile.';
    return panel;
  }
  const panel = base('angle', key, `${name} in ${SIGNS[index].name}`, key === 'ascendant' ? 'L’Ascendente è il punto dell’eclittica sull’orizzonte orientale. Lavanda lo legge come una domanda sul modo di entrare in una situazione e incontrare uno sguardo, senza ridurlo a una maschera immutabile.' : 'Il Medio Cielo è il punto dell’eclittica sul meridiano superiore. Lavanda lo legge come una domanda sul rapporto fra ruolo pubblico, riconoscimento e responsabilità, senza assegnare una professione o un esito futuro.');
  panel.sections.push({ title: STYLES[index].title, text: STYLES[index].text }, { title: 'Una tensione da interrogare', text: STYLES[index].tension });
  const contextQuestion = addHouses(panel, chart, index);
  panel.questions.push(key === 'ascendant' ? 'Come desidero entrare in una relazione senza dover fissare una versione definitiva di me?' : 'Quale rapporto desidero fra il ruolo che occupo e il lavoro che lo rende possibile?', STYLES[index].question, contextQuestion || 'Quale situazione concreta rende questa domanda più leggibile?');
  addCard(panel.cards, SIGN_ARCANA[index], `${name} in ${SIGNS[index].name} → ${TAROT_CARDS[SIGN_ARCANA[index]].name}`);
  panel.related.push(signRelated(index), ...positions(chart).filter(point => certainSign(point) === index).map(planetRelated));
  const other = key === 'ascendant' ? 'midheaven' : 'ascendant';
  if (certainSign(chart[other]) !== null) panel.related.push(angleRelated(other));
  if (key === 'midheaven') panel.caveat = 'Il Medio Cielo è un punto distinto: la casa indicata deriva dalle case a segno intero effettivamente calcolate e non viene assunta come decima casa.';
  return finish(panel);
}

/** Pure, plain-text descriptions for interactive chart selections. */
export function describeSelection(chart, selection) {
  if (!chart || typeof chart !== 'object' || !selection || typeof selection !== 'object') return null;
  const type = selection.type, key = selection.key;
  if (type === 'planet') return describePlanet(chart, String(key).toLowerCase());
  if (type === 'sign') return describeSign(chart, signIndex(key));
  if (type === 'angle') return describeAngle(chart, ({ asc: 'ascendant', mc: 'midheaven' })[String(key).toLowerCase()] || String(key).toLowerCase());
  return null;
}
