// node test/modifica-dal-verbale.test.cjs
// (06/10/2026, chiesto dall'utente) Nella visita di ritorno la maschera arriva compilata dal verbale precedente:
// il tecnico deve poter correggere i dati sbagliati o mancanti del cantiere e delle imprese già inserite.
// - «✏️ Modifica cantiere» c'era, ma compariva solo scegliendo il cantiere dalla ricerca: con la visita di ritorno
//   (e la bozza riaperta) la maschera si ricostruisce da applySnap, che non disegnava il riepilogo del cantiere;
// - dopo «Salva» nella scheda del cantiere aperta dal verbale, il riepilogo restava quello vecchio;
// - sulle imprese già scelte non c'era modo di aprire la scheda: ora «✏️ Modifica», e la riga si aggiorna.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const pezzo = (re, cosa) => { const m = html.match(re); assert.ok(m, 'non trovo ' + cosa); return m[0]; };

/* ── cantiere ── */
const apply = pezzo(/function applySnap\(snap\)\{[\s\S]*?\n\}\n/, 'applySnap');
assert.ok(/if\(snap\.cantiere_id\)\{vSet\('f-cant-id',snap\.cantiere_id\)[\s\S]{0,600}_verbaleRinfrescaCantiere\(snap\.cantiere_id,\{soloScheda:true\}\)\}/.test(apply),
  'la visita di ritorno e la bozza riaperta mostrano il riepilogo del cantiere e «Modifica cantiere»');
assert.ok(/else if\(_from==='visita'\)\{[^}]*\*\/_verbaleRinfrescaCantiere\(_salvato\)\}/.test(html), 'dopo il salvataggio della scheda aperta dal verbale, il riepilogo si rilegge');

const rinfC = pezzo(/async function _verbaleRinfrescaCantiere\(cid,opt\)\{[\s\S]*?\n\}\n/, '_verbaleRinfrescaCantiere');
function provaCantiere({ campoCant, soloScheda, errore }) {
  const scritti = {}, mostrati = [], el = { style: {} }, det = { textContent: '' };
  const S = { fd: {} };
  const fn = new Function('sb', '$', 'vSet', 'vGet', 'renderCantCard', 'S', rinfC + '\nreturn _verbaleRinfrescaCantiere;')(
    { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => errore ? { data: null, error: { message: 'giù' } } : { data: { cantiere_id: 'C1', cantiere_cnce: 'CNCE9', nodo_id: 'NDM-x', data_ult: '2026-12-31', comune_nome: 'PADOVA', cantiere_indirizzo: 'VIA ROMA', cantiere_civico: '3' }, error: null } }) }) }) },
    (id) => (id === 'btn-edit-cant' ? el : id === 'cant-detail' ? det : null),
    (id, v) => { scritti[id] = v; }, (id) => (id === 'f-cant-id' ? campoCant : ''), (c) => mostrati.push(c.cantiere_id), S);
  return fn('C1', soloScheda ? { soloScheda: true } : undefined).then(() => ({ scritti, mostrati, el, det, S }));
}
(async () => {
  let r = await provaCantiere({ campoCant: 'C1', soloScheda: true });
  assert.strictEqual(r.el.style.display, 'inline-flex', '«Modifica cantiere» compare');
  assert.deepStrictEqual(r.mostrati, ['C1'], 'il riepilogo si disegna');
  assert.deepStrictEqual(r.scritti, {}, 'con soloScheda i campi copiati dal verbale precedente non si toccano');
  r = await provaCantiere({ campoCant: 'C1' });
  assert.strictEqual(r.scritti['f-cod-uni'], 'NDM-x', 'dopo il salvataggio della scheda, il codice univoco nel verbale è quello nuovo');
  assert.strictEqual(r.scritti['f-cnce'], 'CNCE9');
  assert.strictEqual(r.S.fd.comune_nome, 'PADOVA');
  r = await provaCantiere({ campoCant: 'C2' });
  assert.deepStrictEqual(r.mostrati, [], 'se nel frattempo il verbale ha cambiato cantiere, non si tocca niente');
  r = await provaCantiere({ campoCant: 'C1', errore: true });
  assert.deepStrictEqual(r.mostrati, [], 'una lettura fallita non disegna dati inventati');

  /* ── imprese ── */
  assert.ok(/\$\{im\.impresa_id\?`<button class="btn-outline btn-sm" data-imp-edit="\$\{idx\}"[^`]*✏️ Modifica<\/button>`:''\}/.test(html), '«✏️ Modifica» solo sulle righe con un’impresa scelta');
  assert.ok(/wrap\.querySelectorAll\('\[data-imp-edit\]'\)\.forEach\(b=>\{[\s\S]{0,200}if\(id&&typeof admEditImpresa==='function'\)admEditImpresa\(id\)/.test(html), 'apre la finestra «Modifica impresa»');
  const salva = pezzo(/async function admSaveEditImpresa\(\) \{[\s\S]*?\n\}\n/, 'admSaveEditImpresa');
  assert.ok(salva.indexOf("verbaleRinfrescaImpresa(_editImpId)") > salva.indexOf("hide('modal-edit-imp')"), 'dopo il salvataggio la riga del verbale si aggiorna');

  const rinfI = pezzo(/async function verbaleRinfrescaImpresa\(id\) \{[\s\S]*?\n\}\n/, 'verbaleRinfrescaImpresa');
  const S = { imprese: [
    { impresa_id: 'A', impresa_nome: 'Vecchio nome', piva: '', cf_imp: '', tipo_imp: '3', nr_lav: 4, capo_cog: 'Rossi' },
    { impresa_id: 'B', impresa_nome: 'Altra', piva: '111', cf_imp: '111', tipo_imp: '4', nr_lav: 2 }] };
  let disegni = 0;
  const fnI = new Function('sb', '$', 'S', 'renderImpreseAccordion', rinfI + '\nreturn verbaleRinfrescaImpresa;')(
    { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { impresa_nome: 'Nome giusto S.r.l.', piva: '02524300239', impresa_cf: '02524300239' }, error: null }) }) }) }) },
    () => ({}), S, () => { disegni++; });
  await fnI('A');
  assert.deepStrictEqual(S.imprese[0], { impresa_id: 'A', impresa_nome: 'Nome giusto S.r.l.', piva: '02524300239', cf_imp: '02524300239', tipo_imp: '3', nr_lav: 4, capo_cog: 'Rossi' },
    'la riga prende i dati nuovi dell’anagrafica; ruolo, lavoratori e capocantiere (dati del verbale) restano');
  assert.strictEqual(S.imprese[1].impresa_nome, 'Altra', 'le altre righe non si toccano');
  assert.strictEqual(disegni, 1);
  await fnI('Z');
  assert.strictEqual(disegni, 1, 'un’impresa che non è nel verbale non ridisegna niente');

  console.log('ok — dalla visita di ritorno si correggono cantiere e imprese');
})().catch((e) => { console.error(e); process.exit(1); });
