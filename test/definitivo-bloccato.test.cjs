// node test/definitivo-bloccato.test.cjs
// (06/10/2026, chiesto dall'utente) «quando schiaccio definitivo su un verbale riesco comunque a cambiare i dati e a
// rischiacciare definitivo»; «la segreteria dovrebbe poter riaprire il verbale definitivo del tecnico che lo vede poi in
// bozza pronto da correggere». Dopo «Definitivo» la maschera si blocca; il salvataggio non riscrive un definitivo (salvo
// la segreteria); la segreteria riapre con riapri_verbale, col motivo che il tecnico legge in testa alla bozza.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const sql = fs.readFileSync(path.join(dir, 'supabase', 'sql', '2026_10_06_riapri_verbale.sql'), 'utf8');
const pezzo = (re, cosa) => { const m = html.match(re); assert.ok(m, 'non trovo ' + cosa); return m[0]; };

/* ── blocco e sblocco, su una finta pagina ── */
const blocca = pezzo(/function bloccaMascheraDefinitivo\(\)\{[\s\S]*?\n\}\n/, 'bloccaMascheraDefinitivo');
const sblocca = pezzo(/function sbloccaMascheraDefinitivo\(\)\{[\s\S]*?\n\}\n/, 'sbloccaMascheraDefinitivo');
const campo = () => ({ disabled: false, dataset: {} });
const zona = { dataset: { tab: '5' }, inert: false };
const ora = campo();
const riepilogo = { dataset: { tab: '15' }, inert: false, querySelectorAll: () => [ora] };
const bottoni = { 'btn-bozza': { classList: new Set() }, 'btn-final': { classList: new Set() } };
for (const b of Object.values(bottoni)) { b.classList.add = Set.prototype.add.bind(b.classList); b.classList.remove = Set.prototype.delete.bind(b.classList); }
let banner = null;
const area = { prepend: (el) => { banner = el; } };
const vista = {
  querySelectorAll: (q) => (q === '.tab-content' ? [zona, riepilogo] : q === '[data-blocco-def]' ? [ora].filter((x) => x.dataset.bloccoDef) : []),
  querySelector: () => area,
};
const doc = { createElement: () => { const el = { style: {}, remove() { banner = null; } }; return el; } };
const S = {};
const $ = (id) => (id === 'view-form' ? vista : id === 'banner-definitivo' ? (banner && banner.id === 'banner-definitivo' ? banner : null) : bottoni[id] || null);
const fn = new Function('$', 'S', 'document', blocca + sblocca + '\nreturn { bloccaMascheraDefinitivo, sbloccaMascheraDefinitivo };')($, S, doc);
fn.bloccaMascheraDefinitivo();
assert.strictEqual(zona.inert, true, 'le aree del verbale non si toccano più');
assert.strictEqual(riepilogo.inert, false, 'il riepilogo resta vivo: lì ci sono PDF e mail');
assert.strictEqual(ora.disabled, true, 'ma i suoi campi sono fermi');
assert.ok(bottoni['btn-bozza'].classList.has('hidden') && bottoni['btn-final'].classList.has('hidden'), '«Salva bozza» e «Definitivo» spariscono');
assert.ok(banner && /Verbale definitivo/.test(banner.innerHTML) && /chiedi alla segreteria di riaprirlo/.test(banner.innerHTML), 'l’avviso dice perché e che cosa fare');
assert.strictEqual(S._definitivoBloccato, true);
fn.sbloccaMascheraDefinitivo();
assert.ok(!zona.inert && !ora.disabled && !bottoni['btn-final'].classList.has('hidden') && !S._definitivoBloccato, 'una maschera nuova riparte sbloccata');

/* ── dove si blocca e dove si sblocca ── */
assert.ok(/hide\('btn-email-verbale'\)\n  sbloccaMascheraDefinitivo\(\)\n/.test(pezzo(/async function initForm\(snap=null\)\{[\s\S]{0,600}/, 'initForm')), 'initForm sblocca');
assert.ok(/if\(stato==='definitivo'&&\(!_eraDefinitivo\|\|!window\.__isCoord\)\)bloccaMascheraDefinitivo\(\)/.test(html), 'dopo la chiusura la maschera si blocca (la segreteria che corregge un definitivo con «Modifica» no)');
assert.ok(/if\(byId&&byId\.stato==='definitivo'&&!window\.__isCoord\)\{bloccaMascheraDefinitivo\(\);throw new Error\('questo verbale è già definitivo/.test(html), 'il salvataggio non riscrive un definitivo aperto da un tecnico');
assert.ok(/if\(byNr\.stato==='definitivo'&&!window\.__isCoord\)throw new Error/.test(html), 'nemmeno ritrovato per numero');

/* ── la riapertura dalla segreteria ── */
assert.ok(/acts\.push\(`<button class="btn-warn btn-sm" onclick="riapriAlTecnico\('\$\{vid\}'/.test(html), 'nella scheda del verbale definitivo, per la segreteria, «Riapri al tecnico»');
const riapri = pezzo(/async function riapriAlTecnico\(vid,nr\)\{[\s\S]*?\n\}\n/, 'riapriAlTecnico');
assert.ok(/if\(!window\.__isCoord\)/.test(riapri) && /motivo\.trim\(\)\.length<3/.test(riapri), 'solo segreteria, e col motivo');
assert.ok(/sb\.rpc\('riapri_verbale',\{p_visita_id:vid,p_motivo:motivo\.trim\(\)\}\)/.test(riapri), 'la riapertura la fa il database');
assert.ok(/if\(error\|\|!data\|\|!data\.ok\)\{toast\('Non riaperto: /.test(riapri), 'un rifiuto si dice');
assert.ok(/mostraRiapertura\(vid\)\.catch/.test(pezzo(/async function riapriBozza\(vid\)\{[\s\S]*?\n\}\n/, 'riapriBozza')), 'il tecnico, riaprendo la bozza, legge chi l’ha riaperta e perché');
const mostra = pezzo(/async function mostraRiapertura\(vid\)\{[\s\S]*?\n\}\n/, 'mostraRiapertura');
assert.ok(/\.is\('richiuso_il',null\)/.test(mostra) && /esc\(ri\.motivo\)/.test(mostra), 'la riapertura ancora aperta, col motivo scritto in sicurezza');

/* ── il database ── */
const fnSql = sql.slice(sql.indexOf('create or replace function public.riapri_verbale('));
assert.ok(/if not \(coalesce\(public\.is_segreteria\(\), false\) or session_user = 'postgres'\) then/.test(fnSql), 'solo segreteria');
assert.ok(/if v\.stato is distinct from 'definitivo' then/.test(fnSql) && /length\(btrim\(coalesce\(p_motivo, ''\)\)\) < 3/.test(fnSql));
assert.ok(fnSql.indexOf("update public.visite set stato = 'bozza'") < fnSql.indexOf('insert into public.visite_riaperture'), 'torna bozza e la riapertura resta scritta');
assert.ok(/perform public\.push_accoda\(mail_tec, 'verbale_riaperto'/.test(fnSql) && /exception when others then raise warning 'riapri_verbale \(notifica\)/.test(fnSql), 'notifica al tecnico, che se fallisce non annulla la riapertura');
assert.ok(/perform public\.riapertura_richiusa\(p_visita_id\);/.test(sql.slice(sql.indexOf('create or replace function public.chiudi_verbale('))), 'richiudendo, la riapertura si chiude');
assert.ok(/revoke execute on function public\.riapri_verbale\(text, text\) from public, anon;/.test(sql));
assert.ok(/revoke all on public\.visite_riaperture from public, anon, authenticated;\ngrant select on public\.visite_riaperture to authenticated;/.test(sql), 'la tabella si legge soltanto');

console.log('ok — definitivo bloccato; la segreteria riapre al tecnico, col motivo');
