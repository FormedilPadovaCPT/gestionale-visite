// node test/scheda-cantiere-comune-altro.test.cjs
// (06/10/2026) Nella scheda del cantiere la tendina del comune ha la provincia di Padova; per il raro cantiere
// fuori provincia c'è «➕ Altro comune»: si scrive il nome, l'elenco ISTAT propone (prima il Veneto) e solo un
// comune scelto dall'elenco entra nella tendina, col suo codice ISTAT (lo chiede l'Osservatorio). Un nome
// scritto a mano e mai scelto non si salva.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');

assert.ok(/<select id="mc-com">[\s\S]{0,200}<div id="mc-com-altro-wrap" class="hidden"[\s\S]{0,200}<input type="text" id="mc-com-altro" list="mc-com-altro-lista"/.test(html), 'la casella sta sotto la tendina, nascosta');
assert.ok(/o\.value='__altro__'; o\.textContent='➕ Altro comune \(fuori provincia\)…'/.test(html), 'la voce in fondo alla tendina');
assert.ok(/\$\('btn-mc-save'\)\.onclick=async\(\)=>\{\n  if\(vGet\('mc-com'\)==='__altro__'\)\{toast\(/.test(html), '«Altro comune» senza un comune scelto non si salva');
assert.ok(/const istat=ISTAT_PD\[sel\.value\]\|\|\(sel\.selectedOptions\[0\]&&sel\.selectedOptions\[0\]\.dataset\.istat\)\|\|''/.test(html), 'il codice viene dal comune scelto');
assert.ok(/\.from\('comuni_istat'\)\.select\('nome,cod,prov,regione'\)\.ilike\('nome','%'\+q\+'%'\)\.is\('soppresso_il',null\)/.test(html), 'si cerca nell’elenco ISTAT, senza i comuni soppressi');
assert.ok(/if\(error\)\{if\(info\)info\.textContent='Non sono riuscito a leggere l.{1,2}elenco ISTAT/.test(html), 'una lettura fallita si dice');
assert.ok(/const w=\$\('mc-com-altro-wrap'\);if\(w\)w\.classList\.add\('hidden'\)/.test(html), 'un cantiere nuovo riparte con la casella chiusa');

/* la scelta: un'opzione sola in più, col codice, e la tendina che cambia */
const pezzo = html.match(/function mcScegliComuneAltro\(c\)\{[\s\S]*?\n\}\n/)[0];
const opzioni = [{ value: 'Padova', dataset: {} }, { value: 'VECCHIO', dataset: { extra: '1' }, remove() { opzioni.splice(opzioni.indexOf(this), 1); } }];
let cambi = 0;
const sel = {
  value: '', get options() { return opzioni; },
  querySelectorAll: () => opzioni.filter((o) => o.dataset.extra === '1'),
  appendChild: (o) => opzioni.push(o),
  dispatchEvent: () => { cambi++; },
};
const info = { textContent: '' };
const document = { createElement: () => ({ dataset: {} }) };
const $ = (id) => (id === 'mc-com' ? sel : id === 'mc-com-altro-info' ? info : null);
class Event { constructor(t) { this.type = t; } }
new Function('$', 'document', 'Event', pezzo + '\nreturn mcScegliComuneAltro;')($, document, Event)({ nome: 'Castelfranco Veneto', cod: '026012', prov: 'TV', regione: 'Veneto' });
assert.strictEqual(sel.value, 'Castelfranco Veneto', 'il comune si salva col nome ISTAT');
const nuova = opzioni.find((o) => o.value === 'Castelfranco Veneto');
assert.strictEqual(nuova.dataset.istat, '026012');
assert.strictEqual(nuova.dataset.extra, '1');
assert.ok(!opzioni.some((o) => o.value === 'VECCHIO'), 'il comune fuori elenco di prima non resta');
assert.strictEqual(cambi, 1, 'la tendina avvisa del cambio (codice e CAP si aggiornano)');
assert.ok(info.textContent.includes('026012'));
console.log('scheda-cantiere-comune-altro: ok');
