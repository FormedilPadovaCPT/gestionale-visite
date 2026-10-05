// node test/scheda-cantiere-visite.test.cjs
// (05/10/2026) La finestra di un cantiere in archivio mostra in cima le sue visite (numero del verbale,
// data, tecnico, impresa, stato), in sola lettura: chiesto dall'utente aprendo la scheda dal controllo
// per l'Osservatorio. Una lettura fallita si dice; «nessuna» solo se il database risponde senza righe.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');

assert.ok(/<h3 id="modal-cant-title">Nuovo cantiere<\/h3>\n\s*<div id="mc-visite" class="hidden"/.test(html), 'il riquadro sta in cima alla finestra del cantiere, nascosto finché non serve');
assert.ok(/function resetModalCantiere\(\)\{[\s\S]*?const mv=\$\('mc-visite'\);if\(mv\)\{mv\.classList\.add\('hidden'\);mv\.innerHTML=''\}\n\}/.test(html), 'un cantiere nuovo non mostra le visite di quello aperto prima');
assert.ok(/  mcGeoFill\(c\)\n  show\('modal-cant'\)\n  mcVisiteFill\(cantId\)\n\}/.test(html), 'aprendo un cantiere in modifica si leggono le sue visite');

const pezzo = html.match(/async function mcVisiteFill\(cantId\) \{[\s\S]*?\n\}\n/);
assert.ok(pezzo, 'manca mcVisiteFill');

/* un finto database: risponde con le righe date, o con un errore */
function finto(risposte) {
  const chiamate = [];
  const sb = {
    from(t) {
      const q = { t, filtri: [] };
      const catena = {
        select() { return catena; },
        eq(c, v) { q.filtri.push(['eq', c, v]); return catena; },
        or(f) { q.filtri.push(['or', f]); return catena; },
        in(c, v) { q.filtri.push(['in', c, v]); return Promise.resolve(risposte[t]); },
        order() { chiamate.push(q); return Promise.resolve(risposte[t]); },
      };
      return catena;
    },
  };
  return { sb, chiamate };
}
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtDate = (d) => (d ? d.split('-').reverse().join('/') : '');
async function prova(risposte) {
  const box = { innerHTML: '', classList: { remove() {}, add() {} } };
  const window = { _editCantId: 'C1' };
  const { sb, chiamate } = finto(risposte);
  const f = new Function('sb', '$', 'esc', 'fmtDate', 'window', pezzo[0] + '\nreturn mcVisiteFill;')(sb, () => box, esc, fmtDate, window);
  await f('C1');
  return { h: box.innerHTML, chiamate };
}

(async () => {
  const { h, chiamate } = await prova({
    visite: { data: [
      { visita_id: 'a', nr_verbale: 'CPT/25_26/0568', data_visita: '2026-05-04', stato: 'definitivo', chiusa: false, tecnico_id: 'T1', impresa_id: 'I1' },
      { visita_id: 'b', nr_verbale: 'CPT/24_25/0012', data_visita: '2024-11-02', stato: 'definitivo', chiusa: true, tecnico_id: 'T2', impresa_id: 'I1' },
    ], error: null },
    tecnici: { data: [{ tecnico_id: 'T1', tecnico_cognome: 'Caon' }, { tecnico_id: 'T2', tecnico_cognome: 'De Marco' }], error: null },
    imprese: { data: [{ impresa_id: 'I1', impresa_nome: 'GALIAZZO F.LLI' }], error: null },
  });
  const qv = chiamate.find((q) => q.t === 'visite');
  assert.deepStrictEqual(qv.filtri.find((f) => f[0] === 'eq'), ['eq', 'cantiere_id', 'C1'], 'si leggono le visite di QUESTO cantiere');
  assert.ok(qv.filtri.some((f) => f[0] === 'or' && /elimina/.test(f[1])), 'le visite eliminate non compaiono');
  assert.ok(h.includes('Visite su questo cantiere (2)'));
  assert.ok(h.includes('<b>CPT/25_26/0568</b>') && h.includes('04/05/2026') && h.includes('Caon') && h.includes('GALIAZZO F.LLI'), 'numero, data, tecnico, impresa');
  assert.ok(h.includes('>chiusa<'), 'la visita chiusa si riconosce');

  const vuoto = await prova({ visite: { data: [], error: null } });
  assert.ok(vuoto.h.includes(': nessuna.'));

  const rotto = await prova({ visite: { data: null, error: { message: 'timeout' } } });
  assert.ok(rotto.h.includes('Non sono riuscito a leggere le visite del cantiere (timeout)'), 'una lettura fallita si dice, non diventa «nessuna»');
  assert.ok(!rotto.h.includes('nessuna'));

  console.log('scheda-cantiere-visite: ok');
})().catch((e) => { console.error(e); process.exit(1); });
