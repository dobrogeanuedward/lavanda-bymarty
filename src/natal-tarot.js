// Correspondences: Benebell Wen, Holistic Tarot supplement, pp. 3–4.
// The card texts and the recommendation weights are original Lavanda choices.
export const TAROT_SOURCES = Object.freeze([Object.freeze({
  author: 'Benebell Wen',
  title: 'Astrological Correspondences in the Tarot — Golden Dawn System',
  url: 'https://benebellwen.com/wp-content/uploads/2025/06/astrological-correspondences-in-the-tarot-golden-dawn-system-a-holistic-tarot-supplement.pdf',
  pages: Object.freeze([3, 4]),
  use: 'Corrispondenze dei 22 Arcani maggiori; numerazione Rider–Waite–Smith.',
})]);

export const TAROT_METHOD = Object.freeze({
  tradition: 'Le associazioni fra Arcani, segni, corpi astrologici ed elementi seguono il sistema Golden Dawn riportato da Benebell Wen. La numerazione è Rider–Waite–Smith: Forza VIII, Giustizia XI. Sono corrispondenze di una tradizione esoterica, distinte dal calcolo delle posizioni celesti.',
  curation: 'Lavanda dà 3 punti al segno del Sole, 2 al segno della Luna e 2 all’Ascendente. Aggiunge Il Sole e La Papessa come complementi dei due luminari, con 1 punto ciascuno. Somma le ragioni coincidenti e propone al massimo 5 Arcani. Il punteggio ordina un percorso editoriale: non misura dominanti astrologiche o qualità della persona.',
  uncertainty: 'Una posizione con più segni possibili viene esclusa. Senza un’ora conosciuta l’Ascendente viene escluso. Le domande e le pratiche sono inviti alla riflessione, senza previsioni o promesse di risultato.',
});

const signs = Object.freeze([
  ['aries', 'Ariete', '♈'], ['taurus', 'Toro', '♉'], ['gemini', 'Gemelli', '♊'],
  ['cancer', 'Cancro', '♋'], ['leo', 'Leone', '♌'], ['virgo', 'Vergine', '♍'],
  ['libra', 'Bilancia', '♎'], ['scorpio', 'Scorpione', '♏'], ['sagittarius', 'Sagittario', '♐'],
  ['capricorn', 'Capricorno', '♑'], ['aquarius', 'Acquario', '♒'], ['pisces', 'Pesci', '♓'],
]);
export const SIGN_ARCANA = Object.freeze([4, 5, 6, 7, 8, 9, 11, 13, 14, 15, 17, 18]);

const correspondence = (type, key, label, glyph, page) => Object.freeze({ type, key, label, glyph, source: 'Golden Dawn', url: TAROT_SOURCES[0].url, page });
const sign = index => correspondence('sign', ...signs[index], index < 6 ? 3 : 4);
const planet = (key, label, glyph, page = 3) => correspondence('planet', key, label, glyph, page);
const element = (key, label, glyph, page) => correspondence('element', key, label, glyph, page);

// Each description, question and practice is original Italian editorial copy.
const cards = [
  [0, '0', 'Il Matto', 'Inizio',
    'Un passo apre il percorso prima che la mappa sia completa. Il Matto invita a distinguere la disponibilità a incontrare qualcosa di nuovo dall’impulso a ignorarne le conseguenze.',
    'Quale inizio posso esplorare lasciando spazio anche al dubbio?',
    'Scrivi una curiosità che vorresti seguire e un piccolo passo reversibile con cui avvicinarla.', '🜁', '#FFD600', element('air', 'Aria', '🜁', 3)],
  [1, 'I', 'Il Mago', 'Facoltà',
    'Gli strumenti sul tavolo chiedono una scelta e un uso consapevole. Il Mago porta l’attenzione sul passaggio fra ciò che sappiamo fare, il linguaggio con cui lo raccontiamo e l’effetto che produciamo.',
    'Che cosa posso comporre con le risorse che ho già?',
    'Elenca tre strumenti a tua disposizione e scegli un gesto concreto che li metta in relazione.', '☿', '#FF1685', planet('mercury', 'Mercurio', '☿')],
  [2, 'II', 'La Papessa', 'Ascolto',
    'Una soglia custodisce ciò che non è ancora pronto a diventare discorso. La Papessa propone un ascolto che lascia esistere l’ambiguità e distingue un’intuizione dalle prove necessarie per sostenerla.',
    'Che cosa sto cercando di nominare troppo in fretta?',
    'Annota un’impressione e, accanto, una domanda ancora aperta. Lascia le due frasi separate.', '☾', '#B58CFF', planet('moon', 'Luna', '☾')],
  [3, 'III', 'L’Imperatrice', 'Generazione',
    'Dare forma implica materia, tempo e relazione. L’Imperatrice permette di interrogare la creatività senza ridurla a produzione continua, riconoscendo anche le condizioni e il lavoro che la sostengono.',
    'Di quali condizioni ha bisogno ciò che desidero far crescere?',
    'Scegli un progetto e descrivi il tempo, i materiali e le relazioni che gli offrono spazio.', '♀', '#FF1685', planet('venus', 'Venere', '♀')],
  [4, 'IV', 'L’Imperatore', 'Struttura',
    'Un confine può sostenere una forma oppure irrigidirla. L’Imperatore apre una domanda sull’autorità: come si costruisce una regola, chi ne trae protezione e chi ne sostiene il costo?',
    'Quale regola merita di essere conservata, e quale di essere discussa?',
    'Disegna il perimetro di una responsabilità e annota ciò che comprende, ciò che esclude e chi può modificarlo.', '♈', '#FFD600', sign(0)],
  [5, 'V', 'Il Papa', 'Trasmissione',
    'Una tradizione consegna parole, gesti e appartenenze. Il Papa invita a osservare come un sapere viene trasmesso e a mantenere aperta la possibilità di interrogarlo, attribuendogli una storia e un contesto.',
    'Che cosa ho ricevuto, e come scelgo di trasmetterlo?',
    'Rintraccia una frase o un’abitudine ereditata. Scrivi da dove arriva e che cosa significa per te oggi.', '♉', '#B58CFF', sign(1)],
  [6, 'VI', 'Gli Amanti', 'Scelta',
    'L’incontro rende visibili differenze e possibilità. Gli Amanti portano la riflessione sul rapporto fra desiderio, accordo e scelta: una relazione acquista forma anche attraverso ciò che ciascuno può liberamente nominare.',
    'Quali valori entrano nella scelta che sto considerando?',
    'Metti per iscritto due possibilità, i valori che sostengono ciascuna e le informazioni che ancora ti mancano.', '♊', '#FF1685', sign(2)],
  [7, 'VII', 'Il Carro', 'Direzione',
    'Muoversi richiede di comporre forze che possono tirare in direzioni diverse. Il Carro invita a interrogare il senso del percorso, il ritmo scelto e ciò che rende possibile fermarsi o cambiare strada.',
    'La direzione che seguo corrisponde ancora a una mia scelta?',
    'Traccia una breve mappa del percorso attuale, includendo una sosta e una possibile deviazione.', '♋', '#382096', sign(3)],
  [8, 'VIII', 'La Forza', 'Relazione',
    'La forza può prendere la forma di un rapporto attento con ciò che resiste. Questa immagine invita a distinguere la fermezza dal dominio e a chiedersi come tenere insieme intensità, misura e rispetto.',
    'Dove posso esercitare fermezza senza cancellare ciò che incontro?',
    'Descrivi una tensione usando prima il linguaggio del controllo, poi quello della relazione. Osserva che cosa cambia.', '♌', '#FFD600', sign(4)],
  [9, 'IX', 'L’Eremita', 'Ricerca',
    'Una luce circoscritta rende visibile un tratto di strada, senza pretendere di illuminarla tutta. L’Eremita propone un tempo di ricerca in cui una domanda precisa può contare più di una risposta definitiva.',
    'Quale domanda merita una parte della mia attenzione?',
    'Scegli una domanda, un testo o un dettaglio da osservare. Annota ciò che trovi e ciò che resta fuori dal campo.', '♍', '#B58CFF', sign(5)],
  [10, 'X', 'La Ruota della Fortuna', 'Contingenza',
    'La ruota rende pensabile un movimento che non dipende interamente dalla volontà. Invita a distinguere ciò su cui possiamo intervenire dalle circostanze e dalle relazioni che richiedono una diversa forma di risposta.',
    'Che cosa posso scegliere dentro una situazione che non controllo del tutto?',
    'Dividi un foglio fra possibilità di intervento e condizioni esterne. Cerca un gesto proporzionato alle prime.', '♃', '#FF1685', planet('jupiter', 'Giove', '♃')],
  [11, 'XI', 'La Giustizia', 'Responsabilità',
    'Una misura prende significato quando rende espliciti i propri criteri. La Giustizia chiede attenzione alle conseguenze delle decisioni e alle differenze che una regola apparentemente uguale può lasciare in ombra.',
    'Quali criteri rendono una decisione comprensibile e discutibile?',
    'Rileggi una scelta dal punto di vista di chi ne riceve gli effetti. Annota una domanda che quel punto di vista aggiunge.', '♎', '#382096', sign(6)],
  [12, 'XII', 'L’Appeso', 'Sospensione',
    'Cambiare orientamento modifica ciò che una scena permette di vedere. L’Appeso offre una figura della pausa, da distinguere dall’obbligo di sopportare: sospendere una conclusione può lasciare emergere altre letture.',
    'Che cosa vedrei rinunciando, per un momento, alla prima spiegazione?',
    'Descrivi una situazione da un’angolazione diversa e conserva entrambe le versioni senza forzarle a coincidere.', '🜄', '#B58CFF', element('water', 'Acqua', '🜄', 4)],
  [13, 'XIII', 'La Morte', 'Passaggio',
    'Una forma che finisce lascia una discontinuità. La Morte, qui letta come immagine simbolica del cambiamento, invita a riconoscere ciò che si conclude senza imporre che ogni perdita debba trasformarsi in crescita.',
    'Quale conclusione posso riconoscere senza doverla già spiegare?',
    'Scrivi il nome di una fase conclusa e una cosa che desideri conservarne. Non è necessario trovare una morale.', '♏', '#382096', sign(7)],
  [14, 'XIV', 'La Temperanza', 'Composizione',
    'Accostare elementi diversi richiede attenzione ai rapporti e ai tempi. La Temperanza invita a cercare una composizione praticabile, capace di cambiare, senza presumere che ogni differenza debba essere cancellata.',
    'Quale relazione fra le parti renderebbe più abitabile questa situazione?',
    'Rappresenta due esigenze con forme o colori diversi. Prova più accostamenti e annota che cosa rimane distinto.', '♐', '#FFD600', sign(8)],
  [15, 'XV', 'Il Diavolo', 'Legame',
    'Un legame può offrire piacere, appartenenza e vincoli allo stesso tempo. Il Diavolo invita a guardare come desideri, abitudini e rapporti di potere si intrecciano, lasciando aperta la domanda sulla possibilità di scegliere.',
    'Che cosa rende un legame desiderato, e che cosa lo rende difficile da discutere?',
    'Descrivi un’abitudine quotidiana: che cosa offre, che cosa richiede e quale piccola alternativa puoi immaginare.', '♑', '#FF1685', sign(9)],
  [16, 'XVI', 'La Torre', 'Discontinuità',
    'Una struttura attraversata da una frattura rivela come era costruita. La Torre propone di interrogare ciò che una certezza teneva insieme e ciò che lasciava fuori, senza trasformare la crisi in un destino necessario.',
    'Quale presupposto è diventato visibile quando qualcosa ha smesso di reggere?',
    'Individua un’idea che hai rivisto. Scrivi quali osservazioni ti hanno chiesto di modificarla.', '♂', '#FFD600', planet('mars', 'Marte', '♂', 4)],
  [17, 'XVII', 'La Stella', 'Orientamento',
    'Un punto luminoso permette di orientarsi senza indicare un percorso obbligato. La Stella invita a distinguere una possibilità desiderata da una garanzia e a riconoscere le condizioni concrete che potrebbero darle spazio.',
    'Quale possibilità desidero tenere aperta?',
    'Annota una possibilità e un gesto piccolo che la renda esplorabile, lasciando il risultato aperto.', '♒', '#B58CFF', sign(10)],
  [18, 'XVIII', 'La Luna', 'Ambiguità',
    'Una luce indiretta modifica contorni e distanze. La Luna offre un’immagine per sostare fra percezione, memoria e immaginazione, distinguendo ciò che abbiamo osservato dalle interpretazioni che gli abbiamo accostato.',
    'Quali parti del mio racconto sono osservazioni, e quali sono ipotesi?',
    'Riscrivi una scena in due colonne: dettagli osservabili e letture possibili. Mantieni riconoscibile la differenza.', '♓', '#382096', sign(11)],
  [19, 'XIX', 'Il Sole', 'Chiarezza',
    'La luce rende una scena condivisibile e lascia vedere anche ciò che la compone. Il Sole invita a cercare chiarezza nel linguaggio e nelle relazioni, senza confondere ciò che appare evidente con una verità già completa.',
    'Che cosa posso rendere più chiaro, a me e a chi mi ascolta?',
    'Racconta un’idea con parole semplici e un esempio concreto. Annota il punto che richiede ancora una domanda.', '☉', '#FFD600', planet('sun', 'Sole', '☉', 4)],
  [20, 'XX', 'Il Giudizio', 'Rilettura',
    'Riascoltare una storia può cambiarne l’ordine e il significato. Il Giudizio apre uno spazio per rispondere a ciò che riconosciamo oggi, senza ridurre un’esistenza a un verdetto o a una versione definitiva di sé.',
    'Quale storia posso rileggere lasciando parlare anche ciò che avevo escluso?',
    'Riprendi una tua vecchia annotazione e aggiungi una voce del presente, conservando leggibile quella precedente.', '🜂', '#FF1685', element('fire', 'Fuoco', '🜂', 4)],
  [21, 'XXI', 'Il Mondo', 'Relazione',
    'Una figura compiuta può essere un punto di sosta dentro una rete più ampia. Il Mondo invita a riconoscere il lavoro concluso, i legami che lo hanno reso possibile e le domande che continuano oltre il suo bordo.',
    'Che cosa considero compiuto, e quali relazioni restano aperte?',
    'Disegna una mappa di un lavoro concluso includendo persone, materiali e luoghi che vi hanno partecipato.', '♄', '#B58CFF', planet('saturn', 'Saturno', '♄', 4)],
];

export const TAROT_CARDS = Object.freeze(cards.map(([number, roman, name, keyword, description, question, practice, glyph, color, correspondence]) => Object.freeze({ number, roman, name, keyword, description, question, practice, glyph, color, correspondence })));

function certainSign(point) {
  if (!point || typeof point !== 'object') return null;
  const valid = index => Number.isInteger(index) && index >= 0 && index < 12;
  if (Object.hasOwn(point, 'possibleSignIndices')) {
    if (!Array.isArray(point.possibleSignIndices) || !point.possibleSignIndices.length || !point.possibleSignIndices.every(valid)) return null;
    const options = [...new Set(point.possibleSignIndices)];
    if (options.length !== 1 || (valid(point.signIndex) && point.signIndex !== options[0])) return null;
    return options[0];
  }
  return valid(point.signIndex) ? point.signIndex : null;
}

/** Curatorial reading suggestions; scores are not astronomical or psychological measures. */
export function recommendArcana(chart) {
  if (!chart || typeof chart !== 'object') return [];
  const planets = Array.isArray(chart.planets) ? chart.planets : chart.planets && typeof chart.planets === 'object' ? Object.entries(chart.planets).map(([key, value]) => value && typeof value === 'object' ? { key, ...value } : null).filter(Boolean) : [];
  const identity = point => String(point?.key || point?.name || '').trim().toLocaleLowerCase('it');
  const sun = planets.find(point => ['sun', 'sole'].includes(identity(point)));
  const moon = planets.find(point => ['moon', 'luna'].includes(identity(point)));
  const selected = new Map();
  function add(number, score, reason) {
    const existing = selected.get(number);
    if (existing) { existing.score += score; if (!existing.reasons.includes(reason)) existing.reasons.push(reason); }
    else selected.set(number, { card: TAROT_CARDS[number], reasons: [reason], score });
  }
  function fromSign(point, label, weight) {
    const index = certainSign(point);
    if (index === null) return false;
    const number = SIGN_ARCANA[index];
    add(number, weight, `${label} in ${signs[index][1]} → ${TAROT_CARDS[number].name}`);
    return true;
  }
  const solar = fromSign(sun, 'Sole', 3), lunar = fromSign(moon, 'Luna', 2);
  if (chart.timeKnown !== false && chart.unknownTime !== true) fromSign(chart.ascendant, 'Ascendente', 2);
  if (solar) add(19, 1, 'Corrispondenza planetaria del Sole');
  if (lunar) add(2, 1, 'Corrispondenza planetaria della Luna');
  return [...selected.values()].sort((a, b) => b.score - a.score).slice(0, 5);
}
