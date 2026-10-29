// node test/incarico-dal-cantiere.test.cjs
// (29/10/2026, deciso dall'utente) L'incarico è sempre puntuale: la segreteria lo dà per un cantiere, per un lotto o per
// tutti i lotti del complesso, e la visita lo eredita scegliendo il cantiere. Il tecnico non scrive il numero.
// La regola sta in un posto solo (incarico_vale_per_cantiere); il verbale su un altro cantiere non si chiude.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const radice = path.join(__dirname, '..');
const sql = fs.readFileSync(path.join(radice, 'supabase', 'sql', '2026_10_29_incarico_cantiere_lotti.sql'), 'utf8');
const html = fs.readFileSync(path.join(radice, 'index.html'), 'utf8');

/* il database */
assert.ok(/add column if not exists tutti_i_lotti boolean not null default false/.test(sql), 'incarichi.tutti_i_lotti');
assert.ok(/s_visite_richieste add column if not exists cantiere_id text/.test(sql), 'la pratica porta il cantiere');
assert.ok(/function public\.incarico_vale_per_cantiere\(p_incarico_id bigint, p_cantiere_id text\)/.test(sql));
assert.ok(/if not found or i\.cantiere_id is null then return null; end if;/.test(sql), 'gli incarichi senza cantiere non si giudicano');
assert.ok(/public\.lotti_del_cantiere\(i\.cantiere_id\) l where l\.cantiere_id = p_cantiere_id/.test(sql), 'tutti i lotti = il complesso di lotti_del_cantiere');
assert.ok(/function public\.incarichi_per_cantiere\(p_cantiere_id text\)/.test(sql), 'l\'aggancio automatico');
assert.ok(/revoke all on function public\.incarichi_per_cantiere\(text\) from public, anon;/.test(sql), 'niente accesso anonimo');
assert.ok(/'cosa','incarico-altro-cantiere'/.test(sql), 'verbale_mancanze ferma il verbale su un altro cantiere');
assert.ok(/public\.incarico_vale_per_cantiere\(inc_num, v\.cantiere_id\) = false/.test(sql), 'solo «false» ferma: null non giudica');
assert.ok(/new\.cantiere_id\s+:= old\.cantiere_id;/.test(sql) && /new\.tutti_i_lotti\s+:= old\.tutti_i_lotti;/.test(sql),
  'cantiere e lotti dell\'incarico li cambia solo la segreteria');
assert.ok(/new\.impresa_id\s+:= old\.impresa_id;/.test(sql), 'l\'impresa dell\'incarico la cambia solo la segreteria');
assert.ok(/cross join lateral public\.lotti_del_cantiere\(i\.cantiere_id\) k/.test(sql), 'chiudere un lotto non chiude l\'incarico di tutti i lotti');
assert.ok(/trg_incarichi_previste before insert/.test(sql), 'le visite previste anche sugli incarichi dell\'app');
/* la versione nuova di verbale_mancanze non ha perso i controlli di prima */
for (const cosa of ['incarico-mancante', 'incarico-chiuso', 'serie-senza-incarico', 'serie-completa', 'tipo-accesso',
  'cantiere-comune', 'nc-senza-nota', 'doppione', 'email-impresa', 'osservazioni'])
  assert.ok(sql.includes("'cosa','" + cosa + "'"), 'verbale_mancanze ha perso: ' + cosa);

/* la maschera: ogni strada che sceglie il cantiere passa da vSet('f-cant-id') */
assert.ok(/if\(id==='f-cant-id'&&window\.incDalCantiere\)window\.incDalCantiere\(v\)/.test(html), 'vSet chiama l\'aggancio');
assert.ok(/function incDalCantiere\(cid\)\{/.test(html));
assert.ok(/sb\.rpc\('incarichi_per_cantiere',\{p_cantiere_id:cid\}\)/.test(html));
assert.ok(/if\(prot\)\{ incVerificaProt\(\); return \}/.test(html), 'col numero già scritto non si sostituisce niente');
assert.ok(/if\(S\.savedId\) return/.test(html), 'una visita già salvata non si aggancia da sola');
assert.ok(/await incDaTendina\(r\.id\)/.test(html), 'la stessa strada della tendina');
assert.ok(/if\(error\|\|data!==false\) return/.test(html), 'la lettura fallita non dice «altro cantiere»');

/* incDecidi: con l'incarico di tutti i lotti il lotto scelto dal tecnico resta */
const m = html.match(/function incDecidi\(r,att\)\{[\s\S]*?\r?\n\}/);
const incDecidi = Function(m[0] + '; return incDecidi')();
assert.strictEqual(incDecidi({ id: 1, cantiere_id: 'R', tutti_i_lotti: true }, { cantiere_id: 'L2' }).cantiere, 'niente');
assert.strictEqual(incDecidi({ id: 1, cantiere_id: 'R', tutti_i_lotti: false }, { cantiere_id: 'L2' }).cantiere, 'chiedi');
assert.strictEqual(incDecidi({ id: 1, cantiere_id: 'R', tutti_i_lotti: true }, {}).cantiere, 'compila');

console.log('incarico-dal-cantiere: ok');
