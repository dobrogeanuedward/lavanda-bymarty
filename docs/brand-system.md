# Lavanda identità visiva

Il payoff di Lavanda è **THE RIOT WITCH**. «Strega di quartiere» appartiene esclusivamente alla bottega della speziale, nell’area Botanica.

La seconda direzione prende lo sketch di Martina come prima ricerca, non come disegno definitivo da riprodurre. Il logo principale è Lavanda. L’insegna della bottega è un elemento separato, con testo variabile. Questa distinzione guida marchio, applicazioni e sito.

## Tre livelli

Il logotipo è disegnato a tracciati originali: lettere nette, contrasto controllato e spaziature ottiche. `wordmark.svg` contiene solo il nome; `logo.svg` unisce nome e simbolo per gli spazi orizzontali. Esistono versioni inverse e monocromatiche.

Il simbolo distilla boccetta e cerchio aperto in pochi tratti, senza lettering sovrapposto, effetti di schizzo o raddoppiamenti. Rimane leggibile come avatar e segno di chiusura. Sotto 32 px si usa la favicon semplificata.

L’insegna è una cornice autonoma in `sign-frame.svg`. Non fa parte del logo. Il testo si compone separatamente in HTML o nel file di impaginazione: «La bottega della speziale», «Storie e natura» o il nome di una raccolta sono possibili contenuti. Non definiscono un nuovo nome permanente del progetto.

## Colori e fotografia

Magenta `#FF1685`, giallo `#FFD600`, lilla `#B58CFF`, viola `#382096`, bianco e nero. I campi sono pieni; i testi piccoli restano scuri sui colori chiari e bianchi sui fondi scuri. Un colore guida ogni composizione, gli altri fanno da accento.

Il photoshoot della seconda direzione usa vetro, lavanda, radici, carta e luce diretta. I colori sono materia fisica nella scena, non filtri applicati alla prima direzione. Gli originali e i prompt sono conservati in `docs/image-originals` e `docs/image-prompts.md`; i file destinati al sito sono ottimizzati. La distribuzione dal bucket R2 DOGO è preparata e rinviata: per ora il sito li serve dal proprio deployment.

## Confronto sul sito

Lo switch 01/02 nell’header cambia loghi, palette e fotografia, mantenendo contenuti e navigazione. La scelta si conserva nel browser. 01 è la prima proposta editoriale del ritorno al centro; 02 è lo sviluppo dello sketch corretto secondo le indicazioni di Martina. Il vecchio tentativo troppo letterale è conservato in `docs/studies/sketch-translation`, come studio superato.

Il footer ha una propria scena illustrata e un’insegna separata dal marchio. Botaniche, carte e orbite possono muoversi lentamente nello sfondo; la lettura mantiene la precedenza e la preferenza di movimento ridotto disattiva il parallax.

## File e riproduzione

- `public/brand/brand-sheet.html`: presentazione della seconda direzione.
- `public/brand/identity-board.webp`: tavola del sistema; originale PNG in `output`.
- `public/brand-v1`: prima direzione conservata.
- `scripts/generate-brand-refined.mjs`: sorgente del sistema vettoriale senza dipendenze.
- `scripts/render-brand-board.mjs`: composizione della tavola con Sharp.

Area libera consigliata: almeno un sesto dell’altezza del marchio. Minimi: logo orizzontale180 px; solo nome120 px; simbolo32 px. Non deformare le proporzioni o aggiungere ombre, bagliori e finiture tridimensionali. Le illustrazioni sono originali contemporanee, senza attribuzioni storiche inventate.
