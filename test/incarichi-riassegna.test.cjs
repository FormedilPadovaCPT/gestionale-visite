// node test/incarichi-riassegna.test.cjs
// (07/10/2026, deciso dall'utente) La segreteria riassegna anche un incarico che il tecnico NON ha rifiutato (cambi di
// zona, tecnico non più in servizio): prima «Riassegna» compariva solo sui rifiutati. Non si propone lo stesso tecnico,
// si chiede il motivo, che resta nelle note. Un incarico nato da una pratica dei servizi CPT si riassegna dalla pratica
// nell'app Segreteria (cambiano insieme e partono le bozze): dal gestionale la pratica resterebbe al tecnico di prima.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8').replace(/\r\n/g, '\n');

/* ── il tasto ── */
assert.ok(/: '<span style="font-size:11px;color:#bbb">non ancora vista dal tecnico<\/span>'\)\n[^\n]*\n[^\n]*\n\s*\+\(rif\?'':' <button class="btn-outline btn-sm" onclick="incRiassegna\('\+r\.id\+'\)"/.test(html),
  'la segreteria vede Riassegna anche sugli incarichi aperti non rifiutati');
assert.ok(/data-aiuto="Passa l\\'incarico a un altro tecnico/.test(html), 'il tasto ha la sua nuvoletta');

/* ── la funzione ── */
const f = html.slice(html.indexOf('async function incRiassegna(id){'), html.indexOf('window.incRiassegna=incRiassegna'));
assert.ok(/const _pr=await incPraticaCollegata\(id\)/.test(f) && /if\(_pr===false\)\{toast\('Non sono riuscito a controllare/.test(f) && /Riassegnalo da quella pratica/.test(f),
  'se nasce da una pratica dei servizi rimanda alla pratica; se non riesce a controllare non riassegna');
assert.ok(/String\(t\.email\)\.toLowerCase\(\)!==_ora/.test(f), 'non propone il tecnico che ha già l’incarico');
assert.ok(/if\(eTec\)\{toast\('Non sono riuscito a leggere l\\u2019elenco dei tecnici/.test(f) && /if\(ePrima\|\|!_prima\)/.test(f), 'una lettura fallita si dice');
assert.ok(/const _motivo=_prima\.rifiuto_motivo\?'':prompt\('Perché lo riassegni\?/.test(f) && /_motivo&&_motivo\.trim\(\)\?' — '\+_motivo\.trim\(\)/.test(f), 'il motivo resta nelle note');
assert.ok(/visite già fatte restano a/.test(f), 'su una serie dice che le visite fatte restano a chi le ha firmate');

/* ── la pratica collegata, eseguita su un database finto ── */
const g = html.slice(html.indexOf('async function incPraticaCollegata(id){'));
const src = g.slice(0, g.indexOf('\n}\n') + 3);
const prova = (risposte) => {
  const ctx = { sb: { from: (t) => ({ select: () => ({ eq: () => ({ limit: async () => risposte[t] || { data: [], error: null } }) }) }) } };
  vm.createContext(ctx); vm.runInContext(src + ';this.f=incPraticaCollegata', ctx);
  return ctx.f(1081);
};
(async () => {
  assert.strictEqual(await prova({}), null, 'nessuna pratica');
  assert.strictEqual(await prova({ s_segnalazioni: { data: [{ id: 42 }], error: null } }), 'segnalazione n. 42');
  assert.strictEqual(await prova({ s_consulenze: { data: null, error: { message: 'timeout' } } }), false, 'lettura fallita ≠ nessuna pratica');
  for (const t of ['s_visite_richieste', 's_segnalazioni', 's_consulenze', 's_conferenze_cantiere']) assert.ok(src.includes(`'${t}'`), t);
  console.log('ok incarichi-riassegna');
})().catch((e) => { console.error(e); process.exit(1); });
