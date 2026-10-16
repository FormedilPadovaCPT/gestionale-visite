// node test/visite-mese.test.cjs
// (16/10/2026, scelta dell'utente) IL COORDINATORE AUMENTA LE VISITE DEL MESE. Il numero è uno solo: «cantieri
// assegnati» della lettera di incarico (s_incarichi_mensili), che il trigger ricopia nella scheda del tecnico
// (target_visite_mensili). Il gestionale chiama s_inc_mensile_aumenta: solo il Coordinatore, solo in aumento, solo a
// lettera aperta, motivo obbligatorio, traccia e avvisi al tecnico e alla segreteria. Niente lettera nuova protocollata.
// La maschera della segreteria salva solo i campi cambiati, così non rimette il numero di prima.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const js = fs.readFileSync(path.join(dir, 'visite-mese.js'), 'utf8');
const yml = fs.readFileSync(path.join(dir, '.github', 'workflows', 'deploy-pages.yml'), 'utf8');
const sql = fs.readFileSync(path.join(dir, 'supabase', 'sql', '2026_10_16_visite_mese_aumentate_dal_coordinatore.sql'), 'utf8');
const aiuto = fs.readFileSync(path.join(dir, 'aiuto.js'), 'utf8');
/* la segreteria è un altro repo: in locale sta accanto, nel workflow di GitHub no */
const segPath = path.join(dir, '..', 'segreteria-app', 'js', 'fatture-tecnici.js');
const seg = fs.existsSync(segPath) ? fs.readFileSync(segPath, 'utf8').replace(/\r\n/g, '\n') : null;

/* ── il modulo ── */
const ctx = { prompt: () => null, alert() {} };
ctx.window = ctx;
vm.createContext(ctx); vm.runInContext(js, ctx);
const M = ctx.VisiteMese;
assert.ok(M && ['box', 'aumenta', 'rigaScheda', 'valutaNuovo'].every((k) => typeof M[k] === 'function'), 'il modulo espone le sue funzioni');
assert.strictEqual(M.valutaNuovo(12, '15').n, 15, 'un numero più alto passa');
assert.strictEqual(M.valutaNuovo(12, ' 13 ').ok, true, 'gli spazi non contano');
assert.strictEqual(M.valutaNuovo(12, '12').ok, false, 'uguale non è un aumento');
assert.strictEqual(M.valutaNuovo(12, '10').ok, false, 'in diminuzione no');
assert.strictEqual(M.valutaNuovo(12, '14.5').ok, false, 'solo numeri interi');
assert.strictEqual(M.valutaNuovo(12, 'quindici').ok, false, 'solo numeri');
assert.strictEqual(M.valutaNuovo(12, '201').ok, false, 'un numero non credibile si ferma');
assert.ok(/if \(!radice\.__isCoordinatoreVero\)/.test(js), 'aumenta solo il Coordinatore vero');
assert.ok(/rpc\('s_inc_mensile_aumenta'/.test(js), 'passa dalla funzione del database');
assert.ok(!/from\('target_visite_mensili'\)\.(upsert|update|insert)/.test(js), 'la scheda del tecnico non si scrive da qui');
assert.ok(/motivo\.length < 5/.test(js), 'senza motivo non parte');
assert.ok(/x\.stato !== 'aperto'/.test(js), 'a mese chiuso niente pulsante');
assert.ok(/Non sono riuscito a leggere tutto/.test(js), 'un errore di lettura si dice, non si tace');

/* ── index.html, deploy, nuvolette ── */
assert.ok(/id="adm-visite-mese"/.test(html), 'il riquadro nella Zona Coordinatore');
assert.ok(/<script src="visite-mese\.js\?v=\d+"><\/script>/.test(html), 'lo script è incluso');
assert.ok(html.indexOf('src="cantieri-critici-coord.js') < html.indexOf('src="visite-mese.js'), 'e dopo cantieri-critici-coord.js, che crea aggiornaZonaCoord');
assert.ok(/loadTargetCard\(\)\.then\(\(\)=>window\.VisiteMese&&window\.VisiteMese\.rigaScheda\(\)\)/.test(html), 'la riga dell\'aumento sotto l\'obiettivo del tecnico');
assert.ok(/- 'visite-mese\.js'/.test(yml) && / visite-mese\.js /.test(yml), 'e pubblicato (deploy-pages.yml, tutte e due le liste)');
['t:aumenta', 'vm-prec', 'vm-succ'].forEach((k) => assert.ok(aiuto.includes(`'${k}':`), 'nuvoletta ' + k));

/* ── il database ── */
assert.ok(/if not public\.is_coordinatore\(\) then/.test(sql), 'solo il Coordinatore');
assert.ok(/if i\.stato <> 'aperto' then/.test(sql), 'solo a lettera aperta');
assert.ok(/if p_nuovo is null or p_nuovo <= v_da then/.test(sql) && /check \(a > da\)/.test(sql), 'solo in aumento, anche nella traccia');
assert.ok(/length\(v_mot\) < 5/.test(sql), 'il motivo è obbligatorio');
assert.ok(/update public\.s_incarichi_mensili\n\s+set cantieri_assegnati = p_nuovo/.test(sql), 'si cambia la lettera (il trigger porta la scheda)');
assert.ok(/note_interne = concat_ws/.test(sql), 'la riga nelle annotazioni interne, che non vanno in lettera');
assert.ok(/push_accoda\(v_mail, 'visite_aumentate:'/.test(sql) && /push_alla_segreteria\('visite_aumentate'/.test(sql), 'avviso al tecnico e alla segreteria');
assert.ok(/revoke execute on function public\.s_inc_mensile_aumenta\(bigint, integer, text\) from public, anon/.test(sql), 'niente anon');
assert.ok(/enable row level security/.test(sql) && !/create policy [^\n]* for (insert|update|delete)/.test(sql), 'la traccia si legge e basta: si scrive solo dalla funzione');
assert.ok(!/s_protocollo|s_crea_protocollo/.test(sql), 'nessun protocollo (scelta dell\'utente)');

/* ── la segreteria (solo dove il repo c'è) ── */
if (seg) {
  assert.ok(/from\('s_incarichi_mensili_aumenti'\)/.test(seg) && /↑ dal Coordinatore/.test(seg), 'la segreteria vede gli aumenti nella colonna dei cantieri');
  assert.ok(/const cambiati = i \? Object\.fromEntries/.test(seg) && /update\(cambiati\)/.test(seg), 'la maschera della lettera salva solo i campi cambiati');
} else {
  console.log('visite-mese: repo segreteria non presente, maschera non controllata');
}

console.log('visite-mese: ok');
