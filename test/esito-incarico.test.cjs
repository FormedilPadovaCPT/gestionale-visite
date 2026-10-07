// node test/esito-incarico.test.cjs
// (07/10/2026, piano approvato dall'utente) Il tecnico va sul posto ma il cantiere è finito o non c'è: con
// «🏁 Cantiere finito / non trovato» registra l'esito con data e nota (obbligatoria). L'incarico passa a «eseguito»
// senza verbale, la segreteria lo chiude, l'uscita si paga come una visita. Finché non è chiuso, il tecnico lo ritira.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const js = fs.readFileSync(path.join(dir, 'esito-incarico.js'), 'utf8');
const yml = fs.readFileSync(path.join(dir, '.github', 'workflows', 'deploy-pages.yml'), 'utf8');
const sql = fs.readFileSync(path.join(dir, 'supabase', 'sql', '2026_10_07_incarichi_esito_senza_visita.sql'), 'utf8');

/* ── il modulo ── */
const ctx = { document: { getElementById: () => null } };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(js, ctx);
const E = ctx.EsitoIncarico;
assert.ok(E && typeof E.apri === 'function' && typeof E.annulla === 'function');
assert.strictEqual(E.etichetta('cantiere_finito'), 'cantiere già finito');
assert.strictEqual(E.etichetta('cantiere_non_trovato'), "nessun cantiere all'indirizzo");
assert.ok(/sb\.rpc\('incarico_esito_senza_visita', \{ p_id: Number\(id\), p_esito: tipo, p_data: data, p_nota: nota \}\)/.test(js), 'lo registra il database');
assert.ok(/if \(nota\.length < 10\)/.test(js) && /max="\$\{oggi\(\)\}"/.test(js), 'nota obbligatoria, niente date future');
assert.ok(/if \(error\) \{ avviso\('Esito non registrato: '/.test(js), 'un errore si dice');
assert.ok(/sb\.rpc\('incarico_esito_annulla', \{ p_id: Number\(id\) \}\)/.test(js), 'si ritira');

/* ── la pagina Incarichi ── */
assert.ok(/if\(!eseguito&&!gest&&!rif&&incTipoAccesso\(r\)!=null\)\n\s*head\+=' <button class="btn-outline btn-sm" onclick="EsitoIncarico\.apri\('\+r\.id\+'\)"/.test(html), 'il pulsante per il tecnico, solo sugli incarichi di visita');
assert.ok(/if\(eseguito&&!gest&&r\.esito_senza_visita\)/.test(html) && /EsitoIncarico\.annulla\(/.test(html), 'il tecnico lo può ritirare');
assert.ok(/eseguito&&r\.esito_senza_visita\?'<span[^']*'>🏁 senza visita: '/.test(html) || /eseguito&&r\.esito_senza_visita\?'<span[^>]*>🏁 senza visita: '/.test(html), 'la scheda non dice «visita registrata»');
assert.ok(/r\.stato==='eseguito'&&r\.esito_senza_visita\?'<span[^>]*>🏁 senza visita<\/span>'/.test(html), 'neanche la tabella');
assert.ok(/<strong>🏁 Esito senza visita<\/strong>/.test(html) && /esc\(r\.esito_nota\|\|''\)/.test(html), 'la nota del tecnico si vede');
assert.ok(/<script src="esito-incarico\.js\?v=1"><\/script>/.test(html));
assert.strictEqual((yml.match(/esito-incarico\.js/g) || []).length, 2, 'pubblicato: tutte e due le liste del deploy');

/* ── il database ── */
assert.ok(/raise exception 'L''esito lo scrive il tecnico a cui è assegnato l''incarico'/.test(sql), 'solo il tecnico dell\'incarico');
assert.ok(/new\.esito_senza_visita\s+:= old\.esito_senza_visita;/.test(sql), 'la guardia protegge l\'esito');
assert.ok(/riaprirlo la farebbe pagare due volte/.test(sql), 'riaprire non fa pagare due volte');

console.log('ok esito-incarico');
