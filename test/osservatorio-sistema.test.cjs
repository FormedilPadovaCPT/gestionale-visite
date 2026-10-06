// node test/osservatorio-sistema.test.cjs
// (06/10/2026) «🛠 Sistema in tabella»: le schede dei cantieri si correggono dall'elenco del controllo per
// l'Osservatorio, una tendina per campo, e la scelta si salva subito. L'utente ha chiesto due volte che non
// si perdano dati: qui si prova che
//   - le voci delle tendine sono ESATTAMENTE quelle della scheda del cantiere (stessi codici, stesse parole);
//   - si scrive solo da oss_correggi_cantiere, passando il valore letto («prima»): il database scrive solo se
//     nel frattempo nessuno l'ha cambiato, e registra ogni correzione;
//   - se il database rifiuta, il valore nella tabella torna quello di prima e non risulta salvato;
//   - il suggerimento non si salva da solo; due indizi diversi = nessun suggerimento;
//   - le note dei tecnici si mostrano senza poter iniettare codice nella pagina.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const radice = path.join(__dirname, '..');
const oss = fs.readFileSync(path.join(radice, 'osservatorio.js'), 'utf8').replace(/\r\n/g, '\n');
const html = fs.readFileSync(path.join(radice, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const sql = fs.readFileSync(path.join(radice, 'supabase', 'sql', '2026_10_06_osservatorio_correzioni.sql'), 'utf8').replace(/\r\n/g, '\n');

/* ── il database ── */
const f = sql.match(/create or replace function public\.oss_correggi_cantiere\([\s\S]*?\nend \$\$;/)[0];
assert.ok(/if not \(public\.is_segreteria\(\) or session_user = 'postgres'\) then/.test(f), 'solo la segreteria');
assert.ok(/p_campo not in \('cantiere_tip_int','cantiere_tip_ope','cantiere_tip_ope_altro','cantiere_importo',\s*'cantiere_durata','cantiere_civico','committente_tipo'\)/.test(f), 'solo i campi dell’Osservatorio');
assert.ok(/for update/.test(f) && (f.match(/if v_att is distinct from v_prima then\s+raise exception 'Nel frattempo il dato è cambiato/g) || []).length === 2,
  'lucchetto sulla riga e confronto col valore letto, per il cantiere e per il committente');
assert.ok(/if v_dopo is null then raise exception/.test(f), 'da qui non si cancella');
assert.ok(/insert into public\.cantieri_correzioni \(cantiere_id, committente_id, campo, prima, dopo\)/.test(f), 'ogni correzione nel registro col valore di prima');
assert.ok(/create table if not exists archivio\.bk_2026_10_06_cantieri_oss as/.test(sql) && /create table if not exists archivio\.bk_2026_10_06_committenti_oss as/.test(sql), 'copia di sicurezza prima di cominciare');
assert.ok(/revoke insert, update, delete on public\.cantieri_correzioni from authenticated;/.test(sql), 'il registro non si scrive a mano');
assert.ok(/revoke execute on function public\.oss_correggi_cantiere\(text, text, text, text\) from public, anon;/.test(sql));

/* ── il modulo, con dipendenze finte ── */
global.document = { querySelector: () => null };
global.CSS = { escape: (s) => s };
const finestra = {};
global.window = finestra;
const toasts = [];
let rispostaRpc = null, chiamateRpc = [];
const tabelle = {};
function query(t) {
  const q = { then(ok, ko) { return Promise.resolve({ data: tabelle[t] || [], error: null }).then(ok, ko); } };
  for (const m of ['select', 'in', 'order', 'range', 'or', 'eq', 'is']) q[m] = () => q;
  return q;
}
const sb = {
  from: query,
  rpc: async (fn, args) => { chiamateRpc.push([fn, args]); return rispostaRpc(fn, args); },
};
const crea = new Function('window', oss.replace('export function creaOsservatorio', 'function creaOsservatorio') + '\nreturn creaOsservatorio')(finestra);
const O = crea({ sb, S: { user: { email: 'x' } }, ADMIN_EMAIL: 'x', $: () => null, vGet: () => '', vSet() {}, toast: (m, t) => toasts.push([t, m]) });

/* 1. le voci sono quelle della scheda del cantiere */
for (const [campo, id] of [['cantiere_tip_int', 'mc-tip-int'], ['cantiere_tip_ope', 'mc-tip-ope'], ['cantiere_durata', 'mc-durata'], ['cantiere_importo', 'mc-importo']]) {
  const sel = html.match(new RegExp('<select id="' + id + '">([\\s\\S]*?)</select>'))[1];
  const voci = [...sel.matchAll(/<option value="(\d+)">([^<]*)<\/option>/g)].map((m) => [Number(m[1]), m[2]]);
  assert.deepStrictEqual(O._SIS_OPZ[campo], voci, 'le voci di ' + campo + ' devono essere quelle della scheda (' + id + ')');
}

/* 2. quando un campo è a posto */
const riga = (v, b = [], a = []) => ({ id: 'C1', v, blocchi: new Set(b), avvisi: new Set(a), stato: {}, note: [], sugg: {}, esercizi: ['2024-25'], verbali: [], comune: '', cantiere: 'x' });
assert.strictEqual(O._sisRisolto(riga({ cantiere_tip_int: 5 }), 'cantiere-intervento'), false, '«Altro» (5) non è ammesso');
assert.strictEqual(O._sisRisolto(riga({ cantiere_tip_int: 2 }), 'cantiere-intervento'), true);
assert.strictEqual(O._sisRisolto(riga({ cantiere_tip_ope: 16, cantiere_tip_ope_altro: '' }), 'opera-altro'), false);
assert.strictEqual(O._sisRisolto(riga({ cantiere_tip_ope: 16, cantiere_tip_ope_altro: 'parcheggio' }), 'opera-altro'), true);
assert.strictEqual(O._sisRisolto(riga({ cantiere_importo: 11 }), 'importo-nd'), false);
assert.strictEqual(O._sisRisolto(riga({ cantiere_civico: ' ' }), 'cantiere-civico'), false);
assert.strictEqual(O._sisRigaFerma(riga({ cantiere_tip_int: 2 }, ['cantiere-intervento', 'cantiere-indirizzo'])), true, 'un motivo che si sistema solo dalla scheda tiene ferma la riga');

/* 3. suggerimenti: uno solo, mai due indizi in contrasto */
assert.strictEqual(O._sisSuggerisciIntervento('lavori di demolizione del fabbricato').val, 3);
assert.strictEqual(O._sisSuggerisciIntervento('ristrutturazione e demolizione parziale'), null, 'due indizi diversi = nessun suggerimento');
assert.strictEqual(O._sisSuggerisciIntervento(''), null);
assert.ok(!/_sisSalva\([^)]*sugg/.test(oss.match(/async function _sisCarica[\s\S]*?\n  \}\n/)[0]), 'caricando l’elenco non si salva niente');

/* 4. caricamento e salvataggio */
(async () => {
  rispostaRpc = (fn, args) => {
    if (fn !== 'osservatorio_controllo') throw new Error('rpc inattesa ' + fn);
    if (args.p_dal !== '2024-10-01') return { data: { definitive: 0, ferme: 0, pronte: 0, motivi: [], cantieri: [], visite: [] }, error: null };
    return { data: { definitive: 5, ferme: 2, pronte: 3, motivi: [{ cosa: 'cantiere-intervento', testo: 'Scheda del cantiere: tipo di intervento da indicare' }],
      cantieri: [{ cantiere_id: 'C1', cantiere: 'Via Roma', comune: 'ESTE', visite: 2, verbali: ['CPT/24_25/0001', 'CPT/24_25/0009'], blocchi: ['cantiere-intervento'], avvisi: [] }], visite: [] }, error: null };
  };
  tabelle.cantieri = [{ cantiere_id: 'C1', cantiere_tip_int: 5, cantiere_tip_ope: 2, cantiere_importo: 1, cantiere_durata: 2, cantiere_civico: '3', cantiere_descrizione: null, cantiere_committente_id: null }];
  tabelle.visite = [{ visita_id: 'a', cantiere_id: 'C1', nr_verbale: 'CPT/24_25/0009', data_visita: '2025-03-01', note_lav: 'Demolizione del capannone <script>alert(1)</script>', oss_tec: '', vis_tip_int: null }];
  const d = await O._sisCarica();
  const r = d.righe.get('C1');
  assert.deepStrictEqual(r.verbali, ['CPT/24_25/0001', 'CPT/24_25/0009']);
  assert.strictEqual(r.v.cantiere_tip_int, 5);
  assert.deepStrictEqual(r.sugg.cantiere_tip_int && r.sugg.cantiere_tip_int.val, 3, 'suggerimento dalle note');
  assert.ok(!chiamateRpc.some(([fn]) => fn === 'oss_correggi_cantiere'), 'caricando non si scrive niente');

  const h = O._sisRigaHtml(r);
  assert.ok(!h.includes('<script>') && h.includes('&lt;script&gt;'), 'le note dei tecnici non possono iniettare codice');
  assert.ok(/<select data-sis-campo="cantiere_tip_int"[^>]*><option value="">ora: Altro — scegli<\/option>/.test(h), 'la tendina dice il valore di adesso («Altro», fuori elenco) e non lo nasconde');
  assert.ok(h.includes('data-sis-sugg="cantiere_tip_int" data-sis-val="3"'), 'il suggerimento è un pulsante');

  // il database rifiuta (nel frattempo qualcuno l'ha cambiato): niente risulta salvato
  const el = { value: '2', closest: () => null };
  rispostaRpc = () => ({ data: null, error: { message: 'Nel frattempo il dato è cambiato (ora: 1). Ricarica l\'elenco: non ho scritto niente' } });
  chiamateRpc = [];
  await O._sisSalva(r, 'cantiere_tip_int', '2', el);
  assert.deepStrictEqual(chiamateRpc[0], ['oss_correggi_cantiere', { p_cantiere: 'C1', p_campo: 'cantiere_tip_int', p_prima: '5', p_dopo: '2' }], 'si passa il valore letto, per il controllo del database');
  assert.strictEqual(r.v.cantiere_tip_int, 5, 'rifiutato: il valore resta quello di prima');
  assert.strictEqual(el.value, 5, 'e la tendina torna com’era');
  assert.ok(toasts.some(([t, m]) => t === 'err' && /Nel frattempo/.test(m)), 'e lo dice');

  // il database accetta
  rispostaRpc = () => ({ data: { ok: true, prima: '5', dopo: '2' }, error: null });
  await O._sisSalva(r, 'cantiere_tip_int', '2', el);
  assert.strictEqual(r.v.cantiere_tip_int, 2);
  assert.strictEqual(O._sisRigaFerma(r), false, 'la riga è sistemata');

  // stesso valore: non si chiama niente; vuoto: non si cancella
  chiamateRpc = [];
  await O._sisSalva(r, 'cantiere_tip_int', '2', el);
  await O._sisSalva(r, 'cantiere_civico', '  ', { value: '', closest: () => null });
  assert.strictEqual(chiamateRpc.length, 0, 'niente scritture inutili, e da qui non si svuota un campo');

  console.log('osservatorio-sistema: ok');
})().catch((e) => { console.error(e); process.exit(1); });
