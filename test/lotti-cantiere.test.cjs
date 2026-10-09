// node test/lotti-cantiere.test.cjs
// (07/10/2026, deciso dall'utente) Il tecnico parte dal cantiere CNCE della lista della Cassa e scopre sul posto che
// ci sono più lotti: con «🧩 Ha più lotti» la scheda diventa uno dei lotti e, se oggi è in un altro, ne nasce una copia
// identica su cui va il verbale. Nome proposto (1, 2, 3…) e modificabile; importo e durata uguali; lo fa il tecnico.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'lotti-cantiere.js'), 'utf8');
const yml = fs.readFileSync(path.join(dir, '.github', 'workflows', 'deploy-pages.yml'), 'utf8');
const sql = fs.readFileSync(path.join(dir, 'supabase', 'sql', '2026_10_07_lotti_cantiere.sql'), 'utf8');

/* ── il nome proposto ── */
const ctx = { document: { getElementById: () => null } };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(js, ctx);
const L = ctx.LottiCantiere;
assert.ok(L && typeof L.apri === 'function');
assert.strictEqual(L.prossimo([]), '2', 'il primo lotto nuovo è il 2 (la scheda di partenza è l’1)');
assert.strictEqual(L.prossimo([{ lotto: '1' }, { lotto: '2' }, { lotto: '5' }]), '6', 'numeri: il successivo');
assert.strictEqual(L.prossimo([{ lotto: 'A' }, { lotto: 'B' }]), '3', 'lettere o nomi: il conteggio, da correggere a mano');

/* ── la finestra ── */
assert.ok(/sb\.rpc\('lotti_del_cantiere', \{ p_cantiere_id: cid \}\)/.test(js) && /Non sono riuscito a leggere i lotti/.test(js), 'legge i lotti e dice se non ci riesce');
assert.ok(/id="lotti-qui" value="1"/.test(js), 'la scheda di partenza: nome proposto 1');
assert.ok(/name="lotti-dove" value="qui" checked/.test(js) && /name="lotti-dove" value="nuovo"/.test(js), 'una domanda sola: in quale lotto sei oggi');
assert.ok(/chiama\('crea_lotto_cantiere', \{ p_cantiere_id: cid, p_lotto_qui: qui, p_lotto_nuovo: nuovo \}\)/.test(js), 'la copia la fa il database');
assert.ok(/window\._verbaleUsaCantiere\(cid\)/.test(js), 'il verbale passa sul lotto scelto');
assert.ok(/l\.copia && !l\.visite && !qui/.test(js) && /togli_lotto_cantiere/.test(js), 'una copia senza visite si toglie');
assert.ok(!/\$\{(?![^}]*esc\()[^}]*\b(?:l|io)\.(?:etichetta|lotto|ultima_impresa|indirizzo)/.test(js), 'i dati dal database si scrivono in sicurezza');

/* ── nel verbale ── */
assert.ok(/id="btn-lotti" data-cant="\$\{esc\(c\.cantiere_id\)\}" onclick="window\.LottiCantiere&&LottiCantiere\.apri\(this\.dataset\.cant\)">🧩 \$\{c\.lotto\?'Lotti del cantiere':'Ha più lotti'\}/.test(html), 'il pulsante nella scheda del cantiere');
assert.ok(/\$\{row\('Lotto',c\.lotto\?esc\(c\.lotto\):null\)\}/.test(html) && !/row\('Cod\. univoco',c\.nodo_id\)/.test(html), 'la scheda mostra il lotto, non più il codice univoco');
assert.ok(/window\._verbaleUsaCantiere=async cid=>\{[\s\S]{0,300}await _useCantiereEsistente\(c\)/.test(html), 'aggancio del verbale al lotto');
/* (08/10/2026, segnalato dall'utente) la visita su un lotto non riprendeva il committente della scheda */
const _uce = html.slice(html.indexOf('async function _useCantiereEsistente(c){'), html.indexOf('/* (07/10/2026) lotti-cantiere.js: creato o scelto un lotto'));
assert.ok(/await proponiCommittenteCantiere\(c\.cantiere_id\)/.test(_uce), 'scegliendo un lotto (o un cantiere dall’incarico) il committente della scheda va proposto');
const _nvd = html.slice(html.indexOf('async function nuovaVisitaDaVerbale(vid, mode){'), html.indexOf("// mode === 'full'"));
assert.ok(/await proponiCommittenteCantiere\(cid\)/.test(_nvd), 'anche «Nuova visita» con i soli dati del cantiere riprende il committente');
const _pcc = html.slice(html.indexOf('async function proponiCommittenteCantiere(cantId){'), html.indexOf('async function proponiCommittenteCantiere(cantId){') + 2500);
assert.ok(/if\(!_attuale\)\{\s*_useCommittenteEsistente\(co\)/.test(_pcc), 'con il committente della visita vuoto, quello del cantiere entra senza domanda');
assert.ok(/else if\(confirm\(`Nella visita il committente è/.test(_pcc), 'se nella visita ce n’è già un altro, si chiede prima di sostituirlo');
/* (08/10/2026, chiesto dall'utente) «↩️ Riapri» sul cantiere chiuso anche al coordinatore, non solo alla segreteria */
assert.ok(/if\(c\.cantiere_chiuso&&\(window\.__isCoord\|\|window\.__isCoordinatoreVero\)\)\{[\s\S]{0,900}riapriCantiere\(cantId,label\)/.test(html), 'il coordinatore deve vedere «Riapri» sui cantieri chiusi');
assert.ok(/if\(!window\.__isSegreteria&&window\.__isCoordinatoreVero==null\)\{/.test(html), 'il ruolo di coordinatore si chiede anche per le schede senza visite');
/* (08/10/2026, chiesto dall'utente) la scheda di un complesso a lotti si allarga; le altre schede ripartono strette */
assert.ok(/const complesso=!!\(lotti&&lotti\.length>1\)\n\s+qdLargo\(complesso\)/.test(html), 'la scheda del complesso deve allargarsi');
assert.ok(/async function showVisitaDetail\(vid\)\{\n\s+qdLargo\(false\)/.test(html) && /async function showCantiereDetail\(cantId\)\{\n\s+qdLargo\(false\)/.test(html), 'ogni scheda riparte stretta');
assert.ok(/b\.style\.maxWidth=largo\?'min\(1100px,96vw\)':'580px'/.test(html), 'larga ma mai oltre lo schermo; stretta come nel markup');
assert.ok(/if\(window\.__isCoord\)\{\n\s+const _be=[^\n]*\n\s+\}\n/.test(html), 'la modifica della scheda resta alla segreteria');
/* (08/10/2026, chiesto dall'utente) anche la chiusura del cantiere al coordinatore: nella scheda e col lucchetto delle Scadenze */
assert.ok(/\}else if\(window\.__isCoord\|\|window\.__isCoordinatoreVero\)\{\n\s+const _bc=[^\n]*chiudiCantiere\(cantId,label\)/.test(html), 'il coordinatore deve vedere «Chiudi cantiere» nella scheda');
assert.ok(/\$\{\(window\.__isSegreteria\|\|window\.__isCoordinatoreVero\)\?'<button class="btn-warn btn-sm" data-act="chiudi-cant"/.test(html), 'il coordinatore deve avere il lucchetto nelle Scadenze');
assert.ok(/window\.__isCoordinatoreVero=null\n\s+if\(!isSegreteria\)\{try\{const r=await sb\.rpc\('is_coordinatore'\)/.test(html), 'il ruolo di coordinatore si chiede al database all’accesso');
const _pc = fs.readFileSync(path.join(__dirname, '..', 'proposte-chiusura.js'), 'utf8');
assert.ok(_pc.includes('const ufficio = () => !!(window.__isCoord || window.__isSegreteria || window.__isCoordinatoreVero);') && html.includes('proposte-chiusura.js?v=2'), 'il coordinatore non propone alla segreteria: chiude o respinge');
/* (09/10/2026, chiesto dall'utente) i PDF dei verbali vanno nell'archivio dei verbali, un file per verbale:
   l'impronta dei dati (senza la data di stampa) evita di riscriverlo se non e' cambiato */
assert.ok(/JSON\.stringify\(\{pd:\{\.\.\.pd,dataOggi:null\},img\}\)/.test(html), 'l’impronta esclude la data di stampa');
assert.ok(/visita_id:vid,impronta:_impronta\}/.test(html) && /impronta: window\._pdfImpronta\|\|null/.test(html), 'tutte e due le strade passano l’impronta');
const _up = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'upload-pdf', 'index.ts'), 'utf8');
assert.ok(_up.includes("'2_AREE/Sopralluoghi/verbali'") && /return `Verbale_\$\{num\}_\$\{imp\}_\$\{com\}_\$\{tec\}_\$\{dat\}\.pdf`/.test(_up), 'archivio e nome a convenzione');
assert.ok(/esist\.appProperties\?\.impronta === String\(impronta\)/.test(_up) && /method: 'PATCH', headers: \{ Authorization: `Bearer \$\{token\}`, 'Content-Type': tipo \}/.test(_up), 'stessi dati: niente; dati cambiati: si sostituisce lo stesso file');
assert.ok(/role: 'reader', type: 'anyone'/.test(_up), 'il link pubblico resta (deciso dall’utente)');
assert.ok(/const dove = cartella \|\| FOLDER_ID/.test(_up), 'se l’archivio non si trova, si salva dove si salvava prima');
/* (09/10/2026) nel nome del file l'impresa va corta: niente forma giuridica né soci, massimo 35 caratteri */
{
  const m = /const FORMA_GIURIDICA = (\/.*\/iu)\r?\n[\s\S]*?export function impresaBreve\(s: unknown, max = 35\): string \{([\s\S]*?)\r?\n\}/.exec(_up);
  assert.ok(m && /const imp = impresaBreve\(x\.impresa\)/.test(_up), 'il nome usa l’impresa accorciata');
  const pulisci = (s) => String(s ?? '').replace(/[\\/:*?"<>|\r\n\t_]/g, ' ').replace(/\s+/g, ' ').trim();
  const impresaBreve = new Function('pulisci', 'FORMA_GIURIDICA', 's', 'max', m[2].replace(/: unknown/g, ''))
    .bind(null, pulisci, new RegExp(m[1].slice(1, -3), 'iu'));
  const breve = (s) => impresaBreve(s, 35);
  assert.equal(breve('ROR COSTRUZIONI S.A.S. DI ROSU IONEL & C'), 'ROR COSTRUZIONI');
  assert.equal(breve('GALIAZZO F.LLI COSTRUZIONI SRL'), 'GALIAZZO F.LLI COSTRUZIONI');
  assert.equal(breve('GN Edile Srls'), 'GN Edile');
  assert.equal(breve('S.A.F. S.A.S. DI SARTORATO ANTONIO & C'), 'S.A.F.');
  assert.equal(breve('F.lli Martini di Martini Giuseppe & C. snc'), 'F.lli Martini di Martini Giuseppe');
  assert.equal(breve('C.S. Costruzioni'), 'C.S. Costruzioni');
  assert.ok(breve('Costruzioni Edili M F di Botton Mauro e Desolei Fabrizio').length <= 35);
}
assert.ok(/cantiere_chiuso,lotto'\)\.eq\('elimina',0\)/.test(html) && /🧩 lotto \$\{esc\(c\.lotto\)\}/.test(html) && /ultima visita \$\{esc\(fmtDate\(_uv\.data_visita\)\)\}/.test(html), 'nella ricerca il lotto, con l’ultima visita');
assert.ok(/<script src="lotti-cantiere\.js\?v=3"><\/script>/.test(html));
assert.ok(/- 'lotti-cantiere\.js'/.test(yml) && / lotti-cantiere\.js /.test(yml), 'pubblicato (tutte e due le liste del deploy)');

/* ── il database ── */
assert.ok(/'cantiere_id', nuovo_id, 'lotto', nuovo,/.test(sql) && /jsonb_populate_record\(null::public\.cantieri, j\)/.test(sql), 'copia identica della riga');
assert.ok(/'nodo_id', null/.test(sql), 'senza codice univoco');
assert.ok(/insert into public\.cantieri_correzioni[\s\S]*'lotto creato dal verbale come copia di '/.test(sql), 'resta scritto chi ha diviso cosa');
assert.ok(/coalesce\(public\.is_personale\(\), false\) and not coalesce\(public\.is_viewer\(\), false\)/.test(sql), 'lo fa chi fa le visite, non chi ha la sola lettura');
assert.ok(/raise exception 'Il lotto «%» c''è già in questo complesso/.test(sql), 'lo stesso nome non si ripete');

/* ── (07/10/2026) su tutti i cantieri, non solo CNCE: la copia ricorda la scheda di partenza ── */
const sql2 = fs.readFileSync(path.join(dir, 'supabase', 'sql', '2026_10_07_lotti_senza_cnce.sql'), 'utf8');
assert.ok(/add column if not exists lotto_di text references public\.cantieri\(cantiere_id\) on delete set null/.test(sql2), 'lotto_di punta alla scheda di partenza');
assert.ok(/'lotto_di', coalesce\(c\.lotto_di, c\.cantiere_id\)/.test(sql2), 'la copia di una copia punta alla prima');
assert.ok(/or coalesce\(k\.lotto_di, k\.cantiere_id\) = c\.radice/.test(sql2), 'i lotti si riconoscono dal complesso, anche senza CNCE e con l’indirizzo corretto');
assert.ok(!/cantiere_cnce/.test((html.match(/id=\"btn-lotti\"[^\n]*/) || [''])[0]), 'il pulsante non dipende dal CNCE');

console.log('ok — lotti del cantiere guidati dal verbale');
