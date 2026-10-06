// node test/scheda-cantiere-tre-colonne.test.cjs
// (06/10/2026) La finestra del cantiere sul PC è larga, coi campi in tre colonne (due fra 900 e 1200 px) e
// «Annulla»/«Salva» sempre in vista; sul telefono resta una colonna. Solo disposizione: i campi sono gli stessi.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const i = html.indexOf('<div class="modal-overlay hidden" id="modal-cant">');
const blocco = html.slice(i, html.indexOf('<!-- MODAL NUOVA IMPRESA -->', i));
const col = blocco.split('<div class="mc-col">').slice(1);
assert.strictEqual(col.length, 3, 'tre colonne');
const ha = (c, ids) => ids.every((x) => c.includes('id="' + x + '"'));
assert.ok(col[0].includes('>Dove<') && ha(col[0], ['mc-ind', 'mc-civ', 'mc-com', 'mc-com-altro', 'mc-cap', 'mc-comune-cod', 'mc-geo-wrap', 'mc-geo-map']), 'Dove: indirizzo, comune, codici, posizione');
assert.ok(col[1].includes('>Dati per l\'Osservatorio<') && ha(col[1], ['mc-tip-int', 'mc-tip-ope', 'mc-tip-ope-altro', 'mc-durata', 'mc-importo', 'mc-comm-search', 'mc-comm-id', 'mc-comm-info']), 'Osservatorio: i campi obbligatori e il committente');
assert.ok(col[2].includes('>Identità e date<') && ha(col[2], ['mc-cnce', 'mc-lotto', 'mc-cod-uni', 'mc-data-inizio', 'mc-data-ult', 'mc-etich', 'mc-descr']), 'Identità e date');
assert.ok(blocco.indexOf('<div class="mc-cols">') > blocco.indexOf('id="mc-visite"') && blocco.indexOf('class="modal-actions"') > blocco.lastIndexOf('<div class="mc-col">'), 'visite sopra, pulsanti sotto');
assert.ok(/@media\(min-width:900px\)\{\n  #modal-cant \.modal-box\{max-width:1240px;width:96vw\}/.test(html), 'sul PC larga');
assert.ok(/#modal-cant \.modal-actions\{position:sticky;bottom:-22px/.test(html), 'pulsanti sempre in vista');
assert.ok(/@media\(min-width:1200px\)\{#modal-cant \.mc-cols\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}\}/.test(html), 'tre colonne dai 1200 px');
console.log('scheda-cantiere-tre-colonne: ok');
