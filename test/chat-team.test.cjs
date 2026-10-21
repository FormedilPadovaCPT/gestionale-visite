// node test/chat-team.test.cjs
// (21/10/2026, scelte dell'utente del 20/10) LA CHAT DEL TEAM al posto del gruppo WhatsApp. Gruppo unico, chi c'è
// legge e scrive; Coordinatore e segreteria sempre dentro, i tecnici li ammette e li toglie il Coordinatore, il Direttore
// mai; chi viene tolto non vede più niente e i suoi messaggi restano; chi scrive cancella solo il proprio messaggio e
// resta «messaggio cancellato»; foto e video su Drive col nome a convenzione, mai condivisi, aperti passando da un
// controllo; video fino a 100 MB caricati a pezzi; notifiche a testo fisso senza nomi.
// I permessi li fa rispettare il DATABASE: qui si controlla che le regole ci siano, e che i controlli sappiano fallire
// su una copia rotta apposta. La prova dal vivo (stessi casi, con accessi finti e transazione annullata) è in
// tools/prova_chat_team.sql ed è riuscita il 21/10/2026.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const leggi = (...p) => fs.readFileSync(path.join(dir, ...p), 'utf8').replace(/\r\n/g, '\n');
const html = leggi('index.html');
const js = leggi('chat-team.js');
const veste = leggi('veste-v2.js');
const yml = leggi('.github', 'workflows', 'deploy-pages.yml');
const sql = leggi('supabase', 'sql', '2026_10_21_chat_team.sql');
const fn = leggi('supabase', 'functions', 'chat-team', 'index.ts');
const prova = leggi('tools', 'prova_chat_team.sql');
const aiuto = leggi('aiuto.js');

/* ── il modulo: funzioni pure ── */
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx); vm.runInContext(js, ctx);
const C = ctx.chatTeam;
assert.ok(C && ['avvia', 'apri', 'box', 'linkifica', 'valutaFile', 'pezzo', 'giaRicevuti', 'iniziali'].every((k) => typeof C[k] === 'function'), 'il modulo espone le sue funzioni');
assert.strictEqual(C.iniziali('Renato Squizzato'), 'RS');
assert.strictEqual(C.iniziali('Nicola De Marco'), 'ND', 'nome e prima parola del cognome, come nel disegno');
assert.strictEqual(C.iniziali(''), '?');
assert.strictEqual(C.classeRuolo('coordinatore'), 'coord', 'iniziali arancioni per il Coordinatore');
assert.strictEqual(C.classeRuolo('segreteria'), 'segr', 'verdi per la segreteria');

// i link si aprono con un tocco; il resto è testo, mai HTML
const l = C.linkifica('Guarda https://youtu.be/abc123, poi www.inail.it. <script>alert(1)</script>');
assert.ok(l.includes('<a href="https://youtu.be/abc123" target="_blank" rel="noopener noreferrer">https://youtu.be/abc123</a>,'), 'link cliccabile, la virgola resta fuori');
assert.ok(l.includes('<a href="https://www.inail.it"'), 'www. diventa https://');
assert.ok(!l.includes('<script>') && l.includes('&lt;script&gt;'), 'niente HTML dal testo');
assert.ok(!C.linkifica('javascript:alert(1)').includes('<a '), 'javascript: non diventa un link');
assert.ok(!C.linkifica('"><img src=x onerror=alert(1)>').includes('<img'), 'le virgolette non escono dall\'attributo');

// file: foto sì, video fino a 100 MB, oltre si condivide un link di Drive
const MB = 1024 * 1024;
assert.strictEqual(C.valutaFile({ type: 'image/jpeg', size: 9 * MB }).tipo, 'foto');
assert.strictEqual(C.valutaFile({ type: 'video/mp4', size: 99 * MB }).ok, true);
assert.strictEqual(C.valutaFile({ type: 'video/mp4', size: 100 * MB }).ok, true, '100 MB esatti passano');
const troppo = C.valutaFile({ type: 'video/mp4', size: 100 * MB + 1 });
assert.ok(!troppo.ok && /link/.test(troppo.msg) && /Drive/.test(troppo.msg), 'oltre i 100 MB non parte e dice di condividere un link di Drive');
assert.strictEqual(C.valutaFile({ type: 'application/pdf', size: 10 }).ok, false, 'i documenti no');

// il caricamento a pezzi: pezzi da 8 MB (multipli di 256 KB, come vuole Google), si riprende da dove Google dice
assert.deepStrictEqual(Array.from(C.pezzo(0, 20 * MB)), [0, 8 * MB - 1]);
assert.deepStrictEqual(Array.from(C.pezzo(16 * MB, 20 * MB)), [16 * MB, 20 * MB - 1], 'l\'ultimo pezzo è più corto');
assert.strictEqual(C.pezzo(20 * MB, 20 * MB), null, 'finito');
assert.strictEqual((8 * MB) % (256 * 1024), 0);
assert.strictEqual(C.giaRicevuti('bytes=0-8388607'), 8 * MB);
assert.strictEqual(C.giaRicevuti(null), 0);
assert.ok(/x\.setRequestHeader\('Content-Range', `bytes \*\/\$\{totale\}`\)/.test(js), 'dopo un errore si chiede a Google dove era arrivato');
assert.ok(/navigator\.onLine === false/.test(js) && /'online'/.test(js), 'senza rete si aspetta che torni');
assert.ok(/Non chiudere l'app finché non arriva al 100%/.test(js) && /Sto caricando il video: \$\{c\.perc\}%/.test(js), 'barra e avviso mentre il video parte');
assert.ok(/addEventListener\('beforeunload'/.test(js) && !/onbeforeunload\s*=/.test(js), 'chiudere a metà chiede conferma, senza togliere l\'avviso del verbale non salvato');

// niente confirm() (scelta dell'utente): le conferme sono nella pagina
assert.ok(!/\bconfirm\(/.test(js), 'niente confirm(): conferma nella pagina');
assert.ok(/Cancellare per tutti\?/.test(js) && /data-azione="cancella-si"/.test(js), 'conferma della cancellazione dentro la nuvoletta');
assert.ok(/ct-conferma-box/.test(js) && /ct-conf-si/.test(js), 'conferma di ammissione e rimozione nel riquadro');
assert.ok(/🚫 messaggio cancellato/.test(js), 'al posto del messaggio cancellato resta la riga');
assert.ok(/Non sono riuscito a leggere i messaggi/.test(js) && /Non sono riuscito a leggere chi è nella chat/.test(js), 'una lettura fallita si dice, non diventa «nessuno»');
assert.ok(/aggiornamento ogni 30 secondi/.test(js), 'se il tempo reale cade, si vede e si va avanti a giri');
assert.ok(/postgres_changes/.test(js) && /table: 'chat_messaggi'/.test(js), 'tempo reale sulla sola busta');
assert.ok(/data-chat-membro/.test(js) && /if \(!coord\)|!coord \?/.test(js), 'Ammetti/Togli disegnati solo per il Coordinatore');

/* ── pagina, menu, Zona Coordinatore, pubblicazione ── */
assert.ok(/<button data-view="chat" id="nav-chat" style="display:none">💬 Chat<span id="nav-chat-badge"/.test(html), 'voce di menu nascosta finché il database non dice che la vedi');
assert.ok(/<section id="view-chat" class="hidden"><\/section>/.test(html), 'la pagina');
assert.ok(/'committenti','chat'\]\.forEach/.test(html) && /if\(view==='chat'&&window\.chatTeam\)window\.chatTeam\.apri\(\)/.test(html), 'navTo apre la chat');
assert.ok(/id="adm-chat-membri"/.test(html), 'riquadro «Chi è nella chat» nella Zona Coordinatore');
assert.ok(/<script src="chat-team\.js\?v=\d+"><\/script>/.test(html), 'lo script è incluso');
assert.ok(html.indexOf('src="cantieri-critici-coord.js') < html.indexOf('src="chat-team.js'), 'e dopo cantieri-critici-coord.js, che crea aggiornaZonaCoord');
assert.ok(/- 'chat-team\.js'/.test(yml) && / chat-team\.js /.test(yml), 'pubblicato (deploy-pages.yml, tutte e due le liste)');
const ctxV = { document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, body: { classList: { add() {}, remove() {}, contains: () => false }, dataset: {} } }, sessionStorage: { getItem: () => null }, localStorage: { getItem: () => null, removeItem() {} }, console };
ctxV.window = ctxV;
try { vm.createContext(ctxV); vm.runInContext(veste, ctxV); } catch (_e) { /* la veste vuole il DOM: basta RUOLI */ }
const R = ctxV.vesteV2 && ctxV.vesteV2.RUOLI;
assert.ok(R, 'la veste espone i ruoli');
for (const k of ['segreteria', 'tecnico', 'coordinatore']) assert.ok(R[k].menu.includes('chat'), k + ' ha la Chat nel menu');
for (const k of ['direttore', 'presidenza', 'consigliere', 'docente']) assert.ok(!R[k].menu.includes('chat'), k + ' non ha la Chat (il Direttore non partecipa)');
assert.ok(veste.includes("if (!o || (v === 'chat' && b.dataset.chatVisibile !== '1')) { b.style.display = 'none'; return; }"), 'senza il via del database la voce resta nascosta');
for (const k of ['v:chat', 'ct-invia', 'ct-allega', 'ct-scatta', 't:cancella', 't:ammetti', 't:togli', 'ct-conf-si', 'ct-conf-no']) assert.ok(aiuto.includes(`'${k}':`), 'nuvoletta ' + k);

/* ── il database: le regole ci sono, e i controlli sanno fallire ── */
function controlliDb(s) {
  const ko = [];
  const regola = (cond, msg) => { if (!cond) ko.push(msg); };
  regola(/when exists \(select 1 from app_ruoli r, e where lower\(r\.email\) = e\.m and r\.ruolo = 'viewer' and r\.stato = 'attivo'\) then null\n\s+when exists \(select 1 from s_config c, e where c\.chiave = 'coordinatore_email'/.test(s), 'Direttore, Presidenza e consiglieri fuori, prima di ogni altra regola');
  regola(/'segreteria'\n\s+when exists \(select 1 from chat_membri cm, e where cm\.email = e\.m and cm\.rimosso_il is null\)\n\s+and exists \(select 1 from tecnici t, e where lower\(t\.email\) = e\.m and coalesce\(t\.attivo, false\)/.test(s), 'un tecnico è dentro solo se ammesso, non tolto, e attivo');
  regola(/create policy chat_messaggi_sel on public\.chat_messaggi for select to authenticated\n\s+using \(public\.chat_partecipa\(\)\);/.test(s), 'la busta dei messaggi si legge solo se si è nella chat (anche Realtime)');
  regola(/revoke all on public\.chat_membri, public\.chat_messaggi, public\.chat_contenuti from anon, authenticated;/.test(s) && !/grant [^;]*chat_contenuti[^;]* to authenticated/.test(s) && !/create policy [^\n]* on public\.chat_contenuti/.test(s), 'il contenuto non si legge né si scrive direttamente');
  regola(!/create policy [^\n]* for (insert|update|delete|all)/.test(s), 'nessuna scrittura diretta: solo le funzioni');
  regola(/if public\.chat_ruolo_di\(io\) is null then\n\s+raise exception 'Non sei nella chat del team';/.test(s), 'chat_elenco: chi è fuori non legge');
  regola(/if r is null then raise exception 'Non sei nella chat del team: il messaggio non è partito'; end if;/.test(s), 'chat_scrivi: chi è fuori non scrive');
  regola(/if m\.autore_email <> io then raise exception 'Si può cancellare solo un messaggio proprio'; end if;/.test(s), 'chat_cancella: solo il proprio');
  regola(/update chat_messaggi set cancellato_il = now\(\), cancellato_da = io where id = p_id;/.test(s) && !/delete from chat_/.test(s), 'cancellare = segnare, mai cancellare la riga');
  regola(/case when m\.cancellato_il is null then c\.testo end/.test(s), 'il testo di un messaggio cancellato non esce');
  regola((s.match(/if not coalesce\(public\.is_coordinatore\(\), false\) then\n\s+raise exception 'Chi è nella chat del team lo decide il Coordinatore';/g) || []).length === 2, 'ammette e toglie solo il Coordinatore');
  regola(/update chat_membri set rimosso_da = io, rimosso_il = now\(\)/.test(s), 'togliere chiude la riga (da/il), non la cancella');
  regola(/before delete on public\.chat_membri/.test(s) && /before delete on public\.chat_messaggi/.test(s) && /before delete on public\.chat_contenuti/.test(s), 'niente si cancella fisicamente');
  regola(/revoke all on function public\.chat_file_nuovo\(text, text, text, text, bigint, integer, integer, numeric\) from public, anon, authenticated;/.test(s), 'un messaggio con file lo crea solo la funzione chat-team');
  regola(/revoke all on function public\.chat_ruolo_di\(text\) from public, anon, authenticated;/.test(s), 'il ruolo di un indirizzo qualsiasi non si chiede dall\'app');
  regola(/'Chat del team', 'C''è un messaggio nuovo nella chat del team\.'/.test(s) && !/push_accoda\([^)]*autore_nome/.test(s), 'notifica a testo fisso, senza nomi');
  regola(/if e = new\.autore_email or not public\.chat_visibile_di\(e\) then continue;/.test(s), 'notifica solo a chi la chat la vede, mai a chi scrive');
  regola(/alter publication supabase_realtime add table public\.chat_messaggi;/.test(s) && !/add table public\.chat_contenuti/.test(s), 'Realtime trasmette la busta, mai il contenuto');
  regola(/dimensione_byte <= 104857600/.test(s), '100 MB anche nel database');
  regola(/\('chat_team_accesa', 'no'\)/.test(s), 'nasce spenta: si accende su decisione dell\'utente');
  return ko;
}
assert.deepStrictEqual(controlliDb(sql), [], 'le regole del database');
// casi rotti apposta: ciascuno deve far fallire il controllo
const rotti = [
  ['un tecnico che cancella i messaggi altrui', sql.replace("if m.autore_email <> io then raise exception 'Si può cancellare solo un messaggio proprio'; end if;", '')],
  ['la busta visibile a tutti', sql.replace('using (public.chat_partecipa());', 'using (true);')],
  ['un tecnico tolto che legge ancora', sql.replace(/if public\.chat_ruolo_di\(io\) is null then\n\s+raise exception 'Non sei nella chat del team';/, 'if false then null;')],
  ['un tecnico tolto che scrive ancora', sql.replace("if r is null then raise exception 'Non sei nella chat del team: il messaggio non è partito'; end if;", '')],
  ['la rimozione che non si guarda', sql.replace('and cm.rimosso_il is null)\n     and exists', ')\n     and exists')],
  ['il Direttore ammesso per errore', sql.replace("r.ruolo = 'viewer' and r.stato = 'attivo') then null\n", "r.ruolo = 'nessuno') then null\n")],
  ['un tecnico che si ammette da solo', sql.replace("if not coalesce(public.is_coordinatore(), false) then\n    raise exception 'Chi è nella chat del team lo decide il Coordinatore';", 'if false then')],
  ['il contenuto in Realtime', sql + '\nalter publication supabase_realtime add table public.chat_contenuti;'],
  ['il nome nella notifica', sql.replace("'C''è un messaggio nuovo nella chat del team.'", "'Messaggio di ' || new.autore_nome")],
];
for (const [nome, s] of rotti) {
  assert.notStrictEqual(s, sql, 'la copia rotta «' + nome + '» è davvero diversa');
  assert.ok(controlliDb(s).length > 0, 'il controllo deve fallire su: ' + nome);
}

/* ── la funzione dei file ── */
assert.ok(/if \(!\(await ruoloDi\(chi\.user\.email\.toLowerCase\(\)\)\)\) return new Response\('Non sei più nella chat del team\.'/.test(fn), 'ogni apertura di file ricontrolla che si sia ancora nella chat');
assert.ok(/if \(!m \|\| m\.cancellato_il \|\| m\.stato_file !== 'pronto'\)/.test(fn), 'il file di un messaggio cancellato non si apre più');
assert.ok(/firma\(\{ i: m\.id, k: 'f', u: u\.user\.id, x \}\)/.test(fn) && !/e: email/.test(fn), 'nel collegamento c\'è l\'account, non l\'indirizzo');
assert.ok(!/permissions/.test(fn) && !/'anyone'/.test(fn), 'i file non si condividono con nessuno');
assert.ok(/const MAX_VIDEO = 100 \* 1024 \* 1024/.test(fn) && /uploadType=resumable/.test(fn), 'video fino a 100 MB, caricamento a pezzi');
assert.ok(/const PEZZO_VIDEO = 8 \* 1024 \* 1024/.test(fn), 'un video si serve a pezzi, non tutto in una volta');
assert.ok(/appProperties has \{ key='chat_messaggio' and value='\$\{id\}' \}/.test(fn), 'la fine del video la conferma Drive, non il telefono');
assert.ok(/\$\{o\.a\}_\$\{o\.m\}_\$\{o\.g\}_IMG_Chat-team_\$\{cognome\}_/.test(fn) && /\$\{o\.a\}_\$\{o\.m\}_\$\{o\.g\}_VID_Chat-team_\$\{cognome\}_/.test(fn), 'nomi a convenzione IMG/VID');
assert.ok(/if \(m\.autore_email !== email\) return risposta\(\{ ok: false, error: 'non è un tuo messaggio' \}, 403\)/.test(fn), 'fine, anteprima e abbandono solo sui propri messaggi');
assert.ok(!/error: \(e instanceof Error && e\.message\)/.test(fn), 'il messaggio delle eccezioni non esce nella risposta (CodeQL)');

/* ── la prova dal vivo copre i casi rotti chiesti ── */
for (const k of ['FALLITA 3: il tecnico ha cancellato un messaggio non suo', 'FALLITA 7a: il tecnico tolto legge ancora la chat', 'FALLITA 7b: il tecnico tolto scrive ancora', 'FALLITA 7c', 'FALLITA 8a: il Direttore legge la chat', 'FALLITA 9: delete riuscito']) assert.ok(prova.includes(k), 'prova dal vivo: ' + k);

console.log('chat-team: ok');
