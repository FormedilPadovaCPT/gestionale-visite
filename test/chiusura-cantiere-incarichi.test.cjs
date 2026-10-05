// node test/chiusura-cantiere-incarichi.test.cjs
// (05/10/2026, regola dell'utente) Chiudendo un cantiere si chiudono anche i suoi incarichi: lo fa il database
// (chiudi_cantiere, supabase/sql/2026_10_05_chiusura_cantiere_incarichi.sql); qui si tiene fermo che la conferma
// DICA quali incarichi si chiudono e quali restano aperti, prima di chiudere, nei punti da cui si chiude.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const radice = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(radice, 'index.html'), 'utf8');
const rientri = fs.readFileSync(path.join(radice, 'rientri-giorni.js'), 'utf8');
const sql = fs.readFileSync(path.join(radice, 'supabase', 'sql', '2026_10_05_chiusura_cantiere_incarichi.sql'), 'utf8');

/* ── la regola nel database: si chiude con l'ULTIMO cantiere, gli stage no, la riapertura rimette lo stato ── */
assert.ok(/\(coalesce\(a\.n, 0\) = 0 and i\.stage_elenco_id is null\)/.test(sql), 'si_chiude = nessun altro cantiere aperto e non stage');
assert.ok(/where t\.id = i\.id and t\.si_chiude and i\.stato in \('aperto','eseguito'\)/.test(sql), 'chiudi_cantiere chiude solo gli incarichi con si_chiude');
assert.ok(/set stato = coalesce\(stato_prima_chiusura, 'aperto'\)[\s\S]*where chiuso_dal_cantiere = p_cantiere_id and stato = 'chiuso'/.test(sql), 'riapri_cantiere riapre solo quelli chiusi da quel cantiere, nello stato di prima');

/* ── le funzioni della conferma, provate con un finto database ── */
const pezzo = html.match(/async function righeIncarichiCantiere\(cantId\)\{[\s\S]*?\n\}\n[\s\S]*?function esitoIncarichiCantiere\(d,chiave\)\{[\s\S]*?\n\}\n/);
assert.ok(pezzo, 'mancano righeIncarichiCantiere ed esitoIncarichiCantiere in index.html');
const crea = (risposta) => new Function('sb', 'window', pezzo[0].replace(/window\.\w+=\w+\n/g, '') + '\nreturn { righeIncarichiCantiere, esitoIncarichiCantiere };')({ rpc: async (f, a) => { assert.strictEqual(f, 'incarichi_del_cantiere'); assert.ok(a.p_cantiere_id); return risposta; } }, {});

(async () => {
  const f1 = crea({ data: [
    { id: 965, tipo_richiesta: 'Serie di visite', tecnico_nome: 'Camuffo Arch. Marco', si_chiude: true, stage: false, altri_cantieri_aperti: 0 },
    { id: 975, tipo_richiesta: 'Serie di visite', tecnico_nome: 'Visentini Arch. Tommaso', si_chiude: false, stage: false, altri_cantieri_aperti: 21 },
    { id: 990, tipo_richiesta: 'Visita stage', tecnico_nome: null, si_chiude: false, stage: true, altri_cantieri_aperti: 0 },
  ], error: null });
  const t = await f1.righeIncarichiCantiere('10001');
  assert.ok(t.includes("Si chiude anche l'incarico:\n· #965 Serie di visite — Camuffo Arch. Marco"), 'la conferma nomina l’incarico che si chiude: ' + t);
  assert.ok(t.includes('· #975 Serie di visite — Visentini Arch. Tommaso (ha altri 21 cantieri aperti)'), 'e quello che resta, col perché');
  assert.ok(t.includes('#990 Visita stage (stage: si chiude con la relazione)'), 'lo stage resta, e si dice perché');

  const vuoto = crea({ data: [], error: null });
  assert.strictEqual(await vuoto.righeIncarichiCantiere('X'), '', 'nessun incarico: la conferma resta quella di prima');

  const rotto = crea({ data: null, error: { message: 'permission denied' } });
  const tr = await rotto.righeIncarichiCantiere('X');
  assert.ok(/Non sono riuscito a leggere gli incarichi/.test(tr) && /permission denied/.test(tr), 'lettura fallita: si dice, non «nessun incarico»');

  assert.strictEqual(f1.esitoIncarichiCantiere({ incarichi_chiusi: [{ id: 965 }] }), ' \u00b7 incarico #965 chiuso');
  assert.strictEqual(f1.esitoIncarichiCantiere({ incarichi_chiusi: [{ id: 1 }, { id: 2 }] }), ' \u00b7 2 incarichi chiusi (#1, #2)');
  assert.strictEqual(f1.esitoIncarichiCantiere({ incarichi_riaperti: [{ id: 965 }] }, 'incarichi_riaperti'), ' \u00b7 incarico #965 riaperto');
  assert.strictEqual(f1.esitoIncarichiCantiere({ incarichi_chiusi: [] }), '', 'niente incarichi chiusi, niente da aggiungere al messaggio');

  /* ── i punti da cui si chiude: la lista viene letta PRIMA della conferma ── */
  assert.ok(/async function chiudiCantiere\(cantId,label\)\{\n  const _inc=await righeIncarichiCantiere\(cantId\)\n  if\(!confirm\([^\n]*\+_inc\)\)return/.test(html), 'la scheda del cantiere legge gli incarichi prima del confirm');
  assert.ok(/window\.righeIncarichiCantiere\(v\.cantiere_id\)[\s\S]{0,400}if \(!confirm\([\s\S]{0,300}\+ incarichi\)\) return;/.test(rientri), 'i rientri leggono gli incarichi prima del confirm');
  assert.ok(/incChiusi\.push\(\.\.\.\(\(data && data\.incarichi_chiusi\) \|\| \[\]\)\)/.test(rientri), 'i rientri dicono quali incarichi hanno chiuso');
  assert.ok(/<script src="rientri-giorni\.js\?v=\d+"><\/script>/.test(html));
  console.log('chiusura-cantiere-incarichi: ok');
})().catch((e) => { console.error(e); process.exit(1); });
