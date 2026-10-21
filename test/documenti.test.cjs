// node test/documenti.test.cjs
// (21/10/2026, chiesto dall'utente) DOCUMENTI CON PRESA VISIONE: la segreteria pubblica un PDF (prima applicazione: le
// informative sulla chat del team e sui sistemi automatizzati), chi lo riceve lo apre o lo scarica dall'app e poi preme
// «Ho letto e preso visione». La presa visione si dà solo dopo l'apertura, che registra la funzione; resta scritto chi,
// quando e quale versione (SHA-256); una versione nuova ritira la vecchia e la presa visione si chiede di nuovo;
// segreteria e Coordinatore vedono chi l'ha presa e chi no; Direttore e consiglieri non ricevono niente da qui.
// I permessi li fa rispettare il DATABASE: qui si controlla che le regole ci siano, e che i controlli sappiano fallire
// su una copia rotta apposta. La prova dal vivo (stessi casi, con accessi finti e transazione annullata) è in
// tools/prova_documenti.sql ed è riuscita il 21/10/2026, con la controprova.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const leggi = (...p) => fs.readFileSync(path.join(dir, ...p), 'utf8').replace(/\r\n/g, '\n');
const html = leggi('index.html');
const js = leggi('documenti.js');
const veste = leggi('veste-v2.js');
const yml = leggi('.github', 'workflows', 'deploy-pages.yml');
const sql = leggi('supabase', 'sql', '2026_10_21_documenti_presa_visione.sql');
const fn = leggi('supabase', 'functions', 'documenti-personale', 'index.ts');
const prova = leggi('tools', 'prova_documenti.sql');
const aiuto = leggi('aiuto.js');

/* ── il modulo: funzioni pure ── */
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx); vm.runInContext(js, ctx);
const D = ctx.documenti;
assert.ok(D && ['avvia', 'apri', 'statoDoc', 'quantiDaLeggere', 'codiceDa', 'conta', 'valutaPdf'].every((k) => typeof D[k] === 'function'), 'il modulo espone le sue funzioni');
assert.strictEqual(D.statoDoc({}), 'da-leggere');
assert.strictEqual(D.statoDoc({ aperto_il: '2026-10-21T10:00:00Z' }), 'aperto');
assert.strictEqual(D.statoDoc({ aperto_il: '2026-10-21T10:00:00Z', presa_il: '2026-10-21T10:05:00Z' }), 'letto');
assert.strictEqual(D.quantiDaLeggere([{}, { aperto_il: 'x' }, { aperto_il: 'x', presa_il: 'y' }]), 2, 'aperto ma senza presa visione conta ancora');
assert.strictEqual(D.codiceDa('La chat del team e i tuoi dati'), 'la-chat-del-team-e-i-tuoi-dati');
assert.strictEqual(D.codiceDa('Informativa: sistemi automatizzati e IA (v2)'), 'informativa-sistemi-automatizzati-e-ia-v2');
assert.strictEqual(D.codiceDa('Perché è così'), 'perche-e-cosi', 'accenti tolti');
assert.ok(D.codiceDa('x'.repeat(100)).length <= 60, 'al massimo 60 caratteri, come nel database');
assert.ok(!D.codiceValido('ab') && D.codiceValido('abc') && !D.codiceValido('a--b') && !D.codiceValido('-ab'), 'stessa forma del vincolo nel database');
const n = D.conta([{ destinatario: true, presa_il: 'x' }, { destinatario: true, aperto_il: 'x' }, { destinatario: true }, { destinatario: false, presa_il: 'x' }]);
assert.deepStrictEqual({ tot: n.tot, prese: n.prese, aperte: n.aperte }, { tot: 3, prese: 1, aperte: 1 }, 'nel conto solo chi lo riceve adesso');
assert.strictEqual(D.valutaPdf({ name: 'a.pdf', type: 'application/pdf', size: 1000 }).ok, true);
assert.strictEqual(D.valutaPdf({ name: 'a.docx', type: 'application/msword', size: 1000 }).ok, false, 'solo PDF');
assert.strictEqual(D.valutaPdf({ name: 'a.pdf', type: 'application/pdf', size: 10 * 1024 * 1024 + 1 }).ok, false, 'oltre 10 MB no');
assert.strictEqual(D.valutaPdf(null).ok, false);

// nella pagina: niente confirm(), la presa visione si attiva dopo l'apertura, una lettura fallita si dice
assert.ok(!/\bconfirm\(/.test(js), 'niente confirm(): conferma nella pagina');
assert.ok(/data-doc-azione="pubblica-si"/.test(js) && /data-doc-azione="ritira-si"/.test(js), 'pubblicare e ritirare chiedono conferma nella pagina');
assert.ok(/disabled title="Apri prima il documento"/.test(js), 'prima di aprire il pulsante della presa visione è spento');
assert.ok(/Non sono riuscito a leggere i documenti/.test(js), 'una lettura fallita si dice, non diventa «nessun documento»');
assert.ok(/b\.classList\.toggle\('inc-lampeggia', n > 0\)/.test(js), 'il numero dei documenti da leggere lampeggia');
assert.ok(/rpc\('doc_prendi_visione'/.test(js) && !/from\('doc_/.test(js), 'la pagina passa solo dalle funzioni, mai dalle tabelle');

/* ── pagina, menu, Oggi, pubblicazione ── */
assert.ok(/<button data-view="documenti" id="nav-documenti" style="display:none">📄 Documenti<span id="nav-documenti-badge"/.test(html), 'voce di menu nascosta finché il database non dice che ti riguarda');
assert.ok(/<section id="view-documenti" class="hidden"><\/section>/.test(html), 'la pagina');
assert.ok(/'chat','documenti'\]\.forEach/.test(html) && /if\(view==='documenti'&&window\.documenti\)window\.documenti\.apri\(\)/.test(html), 'navTo apre i documenti');
assert.ok(/<script src="documenti\.js\?v=\d+"><\/script>/.test(html), 'lo script è incluso');
assert.ok(/- 'documenti\.js'/.test(yml) && / documenti\.js /.test(yml), 'pubblicato (deploy-pages.yml, tutte e due le liste)');
const ctxV = { document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, body: { classList: { add() {}, remove() {}, contains: () => false }, dataset: {} } }, sessionStorage: { getItem: () => null }, localStorage: { getItem: () => null, removeItem() {} }, console };
ctxV.window = ctxV;
try { vm.createContext(ctxV); vm.runInContext(veste, ctxV); } catch (_e) { /* la veste vuole il DOM: basta RUOLI */ }
const R = ctxV.vesteV2 && ctxV.vesteV2.RUOLI;
assert.ok(R, 'la veste espone i ruoli');
for (const k of ['segreteria', 'tecnico', 'coordinatore']) assert.ok(R[k].menu.includes('documenti'), k + ' ha i Documenti nel menu');
for (const k of ['direttore', 'presidenza', 'consigliere', 'docente']) assert.ok(!R[k].menu.includes('documenti'), k + ' non ha i Documenti');
assert.ok(veste.includes("(v === 'documenti' && b.dataset.docVisibile !== '1')"), 'senza il via del database la voce resta nascosta');
assert.ok(/\['nav-chat', '💬', 'Chat del team'\],\s*\n(?:\s*\/\*[\s\S]*?\*\/\s*\n)?\s*\['nav-documenti', '📄', 'Documenti'\]\];/.test(veste), 'in Oggi il riquadro dei Documenti, dopo la Chat');
assert.ok(/id === 'nav-documenti' \? numeroChat\('nav-documenti-badge'\)/.test(veste), 'col numero dei documenti da leggere');
for (const k of ['v:documenti', 't:ho letto e preso visione', 't:pubblica…', 't:sì, pubblica', 't:ritira…', 't:sì, ritira']) assert.ok(aiuto.includes(`'${k}':`), 'nuvoletta ' + k);

/* ── il database: le regole ci sono, e i controlli sanno fallire ── */
function controlliDb(s) {
  const ko = [];
  const regola = (cond, msg) => { if (!cond) ko.push(msg); };
  regola(/when exists \(select 1 from app_ruoli r, e where lower\(r\.email\) = e\.m and r\.ruolo = 'viewer' and r\.stato = 'attivo'\) then '\{\}'::text\[\]/.test(s), 'Direttore, Presidenza e consiglieri non ricevono documenti');
  regola(/lower\(t\.email\) = e\.m and coalesce\(t\.attivo, false\) and coalesce\(t\.elimina, 0\) = 0\) then 'tecnici'/.test(s), 'fra i tecnici solo quelli in servizio');
  regola(/select \* into p from doc_prese_visione where documento_id = p_doc and email = io;\n\s+if not found then\n\s+raise exception 'Apri prima il documento/.test(s), 'presa visione solo dopo l\'apertura');
  regola(/if not public\.doc_destinatario_di\(p_doc, io\) then\n\s+raise exception 'Questo documento non è fra i tuoi/.test(s), 'presa visione solo da chi lo riceve, e sulla versione in vigore');
  regola(/where d\.id = p_doc and d\.ritirato_il is null\n\s+and d\.destinatari && public\.doc_gruppi_di\(p_email\)/.test(s), 'una versione ritirata non ha più destinatari');
  regola(/if old\.presa_il is not null and new\.presa_il is distinct from old\.presa_il then\n\s+raise exception 'La presa visione è già data e non si toglie';/.test(s), 'la presa visione non si toglie');
  regola(/new\.drive_file_id, new\.nome_file, new\.sha256/.test(s) && /raise exception 'Una versione pubblicata non si modifica/.test(s), 'file e impronta di una versione non cambiano');
  regola(/before delete on public\.doc_personale/.test(s) && /before delete on public\.doc_prese_visione/.test(s) && !/delete from doc_/.test(s), 'niente si cancella');
  regola(/revoke all on public\.doc_personale, public\.doc_prese_visione from anon, authenticated;/.test(s) && !/create policy/.test(s) && !/grant [^;]* on public\.doc_/.test(s), 'tabelle chiuse alle app');
  regola(/revoke all on function public\.doc_aperto\(bigint, text\) from public, anon, authenticated;/.test(s), 'l\'apertura la registra solo la funzione (chiave di servizio)');
  regola(/revoke all on function public\.doc_registra\([^)]*\) from public, anon, authenticated;/.test(s), 'si pubblica solo passando dalla funzione');
  regola(/if not \(io = any \(public\.push_destinatari_segreteria\(\)\)\) then\n\s+raise exception 'I documenti al personale li pubblica la segreteria';/.test(s), 'pubblica solo la segreteria');
  regola(/if not \(io = any \(public\.push_destinatari_segreteria\(\)\)\) then\n\s+raise exception 'I documenti al personale li ritira la segreteria';/.test(s), 'ritira solo la segreteria');
  regola(/raise exception 'Il quadro delle prese visione lo vedono la segreteria e il Coordinatore';/.test(s), 'il quadro solo a segreteria e Coordinatore');
  regola(/update doc_personale set ritirato_il = now\(\), ritirato_da = io where codice = p_codice and ritirato_il is null;/.test(s) && /create unique index if not exists ux_doc_personale_in_vigore on public\.doc_personale \(codice\) where ritirato_il is null;/.test(s), 'una versione nuova ritira la vecchia: una sola in vigore');
  regola(/if p_versione is distinct from public\.doc_prossima_versione\(p_codice\) then/.test(s), 'il numero di versione lo controlla il database');
  regola(/if e = io then continue; end if;\n\s+perform public\.push_accoda\(e, 'doc_da_leggere:' \|\| nuovo/.test(s), 'notifica a ciascun destinatario, non a chi pubblica, un evento per documento');
  regola(/sha256 ~ '\^\[0-9a-f\]\{64\}\$'/.test(s), 'l\'impronta è uno SHA-256 vero');
  return ko;
}
assert.deepStrictEqual(controlliDb(sql), [], 'le regole del database');
const rotti = [
  ['presa visione senza aver aperto', sql.replace("  if not found then\n    raise exception 'Apri prima il documento: la presa visione si dà dopo averlo letto';\n  end if;\n", '')],
  ['il Direttore fra i destinatari', sql.replace("r.ruolo = 'viewer' and r.stato = 'attivo') then '{}'::text[]", "r.ruolo = 'nessuno') then '{}'::text[]")],
  ['un tecnico fuori servizio fra i destinatari', sql.replace("lower(t.email) = e.m and coalesce(t.attivo, false) and coalesce(t.elimina, 0) = 0) then 'tecnici'", "lower(t.email) = e.m) then 'tecnici'")],
  ['la presa visione che si toglie', sql.replace("  if old.presa_il is not null and new.presa_il is distinct from old.presa_il then\n    raise exception 'La presa visione è già data e non si toglie';\n  end if;\n", '')],
  ['le tabelle lette dalle app', sql + '\ngrant select on public.doc_prese_visione to authenticated;'],
  ['l\'apertura scritta dal telefono', sql.replace('revoke all on function public.doc_aperto(bigint, text) from public, anon, authenticated;\n', '')],
  ['un tecnico che pubblica', sql.replace("  if not (io = any (public.push_destinatari_segreteria())) then\n    raise exception 'I documenti al personale li pubblica la segreteria';\n  end if;\n", '')],
  ['la versione vecchia che resta in vigore', sql.replace('  update doc_personale set ritirato_il = now(), ritirato_da = io where codice = p_codice and ritirato_il is null;\n', '')],
  ['la notifica anche a chi pubblica', sql.replace('    if e = io then continue; end if;\n', '')],
];
for (const [nome, s] of rotti) {
  assert.notStrictEqual(s, sql, 'la copia rotta «' + nome + '» è davvero diversa');
  assert.ok(controlliDb(s).length > 0, 'il controllo deve fallire su: ' + nome);
}

/* ── la funzione documenti-personale ── */
assert.ok(/if \(!\(await puoAprire\(b\.d, email\)\)\) return new Response\('Questo documento non è fra i tuoi\.'/.test(fn), 'ogni apertura ricontrolla chi la chiede');
assert.ok(/firma\(\{ d: id, u: u\.user\.id, x \}\)/.test(fn) && !/e: email/.test(fn), 'nel collegamento c\'è l\'account, non l\'indirizzo');
assert.ok(/servizio\.rpc\('doc_aperto'/.test(fn) && fn.indexOf("rpc('doc_aperto'") > fn.indexOf('alt=media'), 'l\'apertura si registra dopo aver letto il file da Drive');
assert.ok(/mj\.md5Checksum !== d\.md5_drive/.test(fn), 'se su Drive il file non è più quello pubblicato, non si apre');
assert.ok(/crypto\.subtle\.digest\('SHA-256', bytes\)/.test(fn), 'l\'impronta la calcola la funzione, non il browser');
assert.ok(/!== '%PDF-'\) return risposta\(\{ ok: false, error: 'Il file non è un PDF' \}/.test(fn), 'si pubblicano solo PDF');
assert.ok(/if \(!\(await eSegreteria\(email\)\)\) return risposta\(\{ ok: false, error: 'I documenti al personale li pubblica la segreteria' \}, 403\)/.test(fn), 'pubblica solo la segreteria (e il database ricontrolla)');
assert.ok(/_MOD_Formedil-Padova_\$\{codice\}_v\$\{due\(versione\)\}\.pdf/.test(fn), 'nome a convenzione con la versione');
assert.ok(!/permissions/.test(fn) && !/'anyone'/.test(fn), 'i file non si condividono con nessuno');
assert.ok(!/error: \(e instanceof Error && e\.message\)/.test(fn), 'il messaggio delle eccezioni non esce nella risposta (CodeQL)');

/* ── la prova dal vivo copre i casi rotti ── */
for (const k of ['FALLITA 2: un tecnico ha pubblicato', 'FALLITA 3b: il Direttore è destinatario', 'FALLITA 3c: un tecnico fuori servizio è destinatario', 'FALLITA 4b: presa visione senza aver aperto il file', 'FALLITA 5b', 'FALLITA 7a: presa visione tolta', 'FALLITA 9f: presa visione su una versione ritirata']) assert.ok(prova.includes(k), 'prova dal vivo: ' + k);

console.log('documenti: ok');
