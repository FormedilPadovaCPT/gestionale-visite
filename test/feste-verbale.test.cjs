/* Veste delle feste della mail del verbale (27/11/2026, scelta dell'utente: grafica C, frase 5).
   Prova il modulo puro feste.js (periodo sull'ora di Roma, riquadro), il suo uso in
   send-verbale (mai nella rettifica, riquadro dopo i saluti, banner di sempre fuori periodo),
   l'anteprima del gestionale con le stesse date e il banner pubblicato da GitHub Pages. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const dir = path.join(__dirname, '..');
const leggi = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

(async () => {
  const F = await import(pathToFileURL(path.join(dir, 'supabase/functions/send-verbale/feste.js')).href);

  /* ── il periodo, giorno per giorno sull'ora di Roma ── */
  assert.strictEqual(F.FESTE.dal, '2026-11-27', "anticipato al 27/11 su richiesta dell'utente");
  assert.strictEqual(F.FESTE.al, '2027-01-06');
  assert.strictEqual(F.inFeste(new Date('2026-11-26T22:30:00Z')), false, '26/11 alle 23:30 di Roma: ancora fuori');
  assert.strictEqual(F.inFeste(new Date('2026-11-26T23:30:00Z')), true, '27/11 alle 00:30 di Roma: già dentro, anche se in UTC è il 26/11');
  assert.strictEqual(F.inFeste(new Date('2026-12-25T10:00:00Z')), true);
  assert.strictEqual(F.inFeste(new Date('2027-01-06T22:30:00Z')), true, '6/1 alle 23:30 di Roma: ultimo giorno');
  assert.strictEqual(F.inFeste(new Date('2027-01-06T23:30:00Z')), false, '7/1 alle 00:30 di Roma: tornata la mail di sempre');
  assert.strictEqual(F.inFeste(new Date('2027-12-25T10:00:00Z')), false, 'il periodo è di un anno solo');

  /* ── il riquadro ── */
  const h = F.augurioHtml();
  assert.ok(h.includes('Buon riposo, e a presto in cantiere'));
  assert.ok(h.includes('La sicurezza si costruisce insieme, un giorno alla volta.'), 'frase 5 delle proposte');
  assert.ok(h.includes('bgcolor="#3f444c"'), 'fondo anche come attributo, per Outlook');
  assert.ok(F.augurioHtml({ ...F.FESTE, titolo: '<b>x</b>' }).includes('&lt;b&gt;x&lt;/b&gt;'), 'il testo si scappa');
  assert.ok(/^https:\/\/formedilpadovacpt\.github\.io\/gestionale-visite\/natale-2026-verbale\.png$/.test(F.FESTE.banner),
    'il sito Pages del repo è /gestionale-visite/ (con /gestionale/ il banner dava 404)');

  /* ── send-verbale ── */
  const sv = leggi('supabase/functions/send-verbale/index.ts');
  assert.ok(sv.includes("import { FESTE, inFeste, augurioHtml } from './feste.js'"));
  assert.ok(/const feste = !isRett && inFeste\(\)/.test(sv), 'mai nella rettifica');
  assert.ok(/const bannerSrc = feste \? FESTE\.banner : BANNER_CANTIERI/.test(sv), 'fuori periodo il banner di sempre');
  assert.ok(sv.includes('Banner%20mail%20cantieri.png?token='), 'il banner di sempre resta nel codice');
  assert.ok(/<img src="\$\{bannerSrc\}"/.test(sv));
  const iCorpo = sv.indexOf('${corpoHtml}'), iAug = sv.indexOf('${augurio}'), iVal = sv.indexOf('${valutaHtml}');
  assert.ok(iCorpo > 0 && iCorpo < iAug && iAug < iVal, 'riquadro dopo i saluti, prima di «Com\'è andata la visita?»');

  /* ── anteprima del gestionale: stesse date ── */
  const idx = leggi('index.html');
  const m = idx.match(/const _EV_FESTE=\{dal:'([\d-]+)',al:'([\d-]+)'\}/);
  assert.ok(m, 'anteprima: _EV_FESTE presente');
  assert.deepStrictEqual([m[1], m[2]], [F.FESTE.dal, F.FESTE.al], 'anteprima e send-verbale con le stesse date');
  assert.ok(idx.includes("timeZone:'Europe/Rome'") && idx.includes('...(_evFeste()?['), 'anteprima: giorno di Roma e riga delle feste');

  /* ── il banner viene pubblicato da GitHub Pages ── */
  assert.ok(fs.existsSync(path.join(dir, 'natale-2026-verbale.png')), 'banner nella radice del repo');
  assert.ok(/'\*\.png'/.test(leggi('.github/workflows/deploy-pages.yml')) && / \*\.png; do/.test(leggi('.github/workflows/deploy-pages.yml')), 'deploy-pages copia i .png della radice');

  console.log('feste-verbale: ok');
})().catch((e) => { console.error(e); process.exit(1); });
