// node test/un-giro.test.cjs
// (21/10/2026) UN GIRO ALLA VOLTA. Il 21/10 fra le 14:51 e le 14:53 Oggi, riaperto una decina di volte dalla
// segreteria, ha messo in coda il database: 40-85 letture per apertura, molte doppie a due secondi di distanza,
// e la Zona Coordinatore riempita per intero solo per scrivere tre numeri. Questi controlli tengono fermo che:
//   · lo stesso caricamento, chiesto due volte insieme, fa UNA lettura (un-giro.js);
//   · su Oggi i numeri della Zona si contano con tre conteggi e le regole dei riquadri, e un conteggio fallito
//     si dice, non diventa «niente in attesa» (cantieri-critici-coord.js, contaZonaCoord);
//   · i ruoli della direzione e il «posso vedere» dei critici si chiedono una volta anche da due riquadri insieme;
//   · i conteggi di «Qualità dati» della Scrivania si tengono 10 minuti, e una lettura fallita non si ricorda;
//   · gli agganci in index.html sono quelli giusti.
// Ogni controllo è provato anche su una copia rotta apposta: in fondo al file.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const leggi = (...p) => fs.readFileSync(path.join(dir, ...p), 'utf8').replace(/\r\n/g, '\n');
const SORGENTI = {
  giro: process.env.UN_GIRO_ROTTO || leggi('un-giro.js'),
  coord: leggi('cantieri-critici-coord.js'),
  direzione: leggi('direzione.js'),
  veste: leggi('veste-v2.js'),
  html: leggi('index.html'),
  oss: leggi('osservatorio.js'),
  yml: leggi('.github', 'workflows', 'deploy-pages.yml'),
};
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

function caricaGiro(src) { const ctx = { console, setTimeout }; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(src, ctx); return ctx.UnGiro; }

/* ── 1. il giro unico ── */
async function provaGiro(src) {
  const G = caricaGiro(src);
  let chiamate = 0;
  const lettura = async () => { chiamate++; await pausa(20); return 'dato ' + chiamate; };
  const [a, b] = await Promise.all([G.fai('incarichi', lettura), G.fai('incarichi', lettura)]);
  assert.strictEqual(chiamate, 1, 'due richieste insieme dello stesso giro fanno UNA lettura');
  assert.strictEqual(a, b, 'e ricevono lo stesso risultato');
  await G.fai('incarichi', lettura);
  assert.strictEqual(chiamate, 2, 'finito il giro, senza «fresco» si rilegge');
  await G.fai('oggi', lettura, { fresco: 5000 });
  const n = chiamate;
  await G.fai('oggi', lettura, { fresco: 5000 });
  assert.strictEqual(chiamate, n, 'entro «fresco» si riusa il risultato');
  G.scorda('oggi');
  await G.fai('oggi', lettura, { fresco: 5000 });
  assert.strictEqual(chiamate, n + 1, 'dopo scorda() si rilegge');
  let k = 0;
  const rotta = async () => { k++; throw new Error('timeout'); };
  await assert.rejects(G.fai('rotto', rotta, { fresco: 60000 }), /timeout/, 'un errore arriva a chi ha chiesto');
  await assert.rejects(G.fai('rotto', rotta, { fresco: 60000 }), /timeout/);
  assert.strictEqual(k, 2, 'un giro fallito non si ricorda: il successivo riparte');
  assert.strictEqual(G.inCorso('rotto'), false);
}

/* ── 2. i tre numeri della Zona su Oggi ── */
function finto(id) { return { id, style: { display: '' }, innerHTML: '', dataset: {}, onclick: null, click() {}, querySelectorAll: () => [], addEventListener() {} }; }
function ambienteCoord(src, { conti, errore, navNascosto, coordPage = true }) {
  const el = { 'nav-admin': finto('nav-admin'), 'dash-coord-avviso': finto('dash-coord-avviso'), 'dash-coord-vai': finto('dash-coord-vai') };
  if (navNascosto) el['nav-admin'].style.display = 'none';
  const letture = [], rpc = [];
  const q = (tabella) => {
    const filtri = [];
    const risposta = () => (errore === tabella ? { count: null, error: { message: 'canceling statement due to statement timeout' } } : { count: conti[tabella], error: null });
    const o = {
      select: (c, opz) => { filtri.push(['select', c, opz && opz.head]); return o; },
      in: (k, v) => { filtri.push(['in', k, v.join(',')]); return o; },
      not: (k, op, v) => { filtri.push(['not', k, op, v]); return o; },
      eq: (k, v) => { filtri.push(['eq', k, v]); return o; },
      then: (ok, ko) => { letture.push({ tabella, filtri }); return Promise.resolve(risposta()).then(ok, ko); },
    };
    return o;
  };
  const sb = { from: q, rpc: async (f) => { rpc.push(f); await pausa(5); return { data: f === 'is_segreteria', error: null }; } };
  const document = { getElementById: (id) => el[id] || null, createElement: () => finto('x'), head: { appendChild() {} } };
  const ctx = { console, setTimeout, document, sb, S: { user: { email: 'cptpd@did.formedilpadova.it' } }, isCoordPageUser: () => coordPage, toast() {} };
  ctx.window = ctx;
  vm.createContext(ctx); vm.runInContext(src, ctx);
  return { conta: ctx.contaZonaCoord, el, letture, rpc };
}
async function provaZona(src) {
  const a = ambienteCoord(src, { conti: { s_fatture_tecnici: 55, s_cantieri_critici: 3, s_decisioni: 2 } });
  assert.strictEqual(typeof a.conta, 'function', 'cantieri-critici-coord.js espone contaZonaCoord');
  const [n] = await Promise.all([a.conta(), a.conta()]);
  assert.deepStrictEqual({ ...n }, { fatture: 40, critici: 3, decise: 2 }, 'fatture e critici al massimo 40, come i riquadri; decise tutte');
  assert.deepStrictEqual(a.rpc.slice().sort(), ['is_coordinatore', 'is_segreteria'], 'il «posso vedere» si chiede UNA volta anche da due conteggi insieme');
  const per = (t) => a.letture.filter((x) => x.tabella === t);
  assert.strictEqual(a.letture.length, 6, 'tre conteggi per giro, niente altro (due giri qui)');
  assert.ok(per('s_fatture_tecnici').every((x) => x.filtri.some((f) => f[0] === 'in' && f[1] === 'stato' && f[2] === 'ricevuta,verificata,standby') && x.filtri.some((f) => f[0] === 'select' && f[2] === true)), 'fatture: le stesse di loadFattureCoord, solo contate');
  assert.ok(per('s_cantieri_critici').every((x) => x.filtri.some((f) => f[0] === 'not' && f[1] === 'stato' && f[3] === '(chiuso,annullato)')), 'critici: non chiusi né annullati, come carica()');
  assert.ok(per('s_decisioni').every((x) => x.filtri.some((f) => f[0] === 'eq' && f[1] === 'stato' && f[2] === 'decisa')), 'decisioni: quelle decise, da prendere in carico');
  assert.ok(/Zona Coordinatore<\/strong> ti aspettano: <strong>40<\/strong> fatture da approvare/.test(a.el['dash-coord-avviso'].innerHTML), 'il riquadro su Oggi dice i numeri');
  assert.ok(/>45</.test(a.el['nav-admin'].innerHTML), 'e il pulsante del menu porta il totale');

  const k = ambienteCoord(src, { conti: { s_fatture_tecnici: 0, s_cantieri_critici: 0, s_decisioni: 0 }, errore: 's_decisioni' });
  const nk = await k.conta();
  assert.ok(nk && nk.errore && /timeout/.test(nk.errore), 'un conteggio fallito è un errore, non uno zero');
  assert.ok(/Non sono riuscito a contare/.test(k.el['dash-coord-avviso'].innerHTML) && k.el['dash-coord-avviso'].style.display !== 'none', 'e su Oggi si dice, invece di nascondere il riquadro');

  for (const caso of [{ navNascosto: true, che: 'un tecnico (pulsante nascosto)' }, { coordPage: false, che: 'chi non ha la Zona' }]) {
    const t = ambienteCoord(src, { conti: {}, ...caso });
    assert.strictEqual(await t.conta(), null, caso.che + ': niente da contare');
    assert.strictEqual(t.letture.length + t.rpc.length, 0, caso.che + ': nessuna lettura');
  }
}

/* ── 3. i ruoli della direzione si chiedono una volta ── */
async function provaRuoli(src) {
  const m = src.match(/async function ruoli\(\) \{[\s\S]*?\n  \}\n  let _ruoliInCorso = null;/);
  assert.ok(m, 'manca ruoli() con la lettura condivisa in direzione.js');
  const chiamate = [];
  const window = { S: { user: { email: 'cptpd@did.formedilpadova.it' } }, sb: { rpc: async (f) => { chiamate.push(f); await pausa(5); return { data: f === 'is_segreteria', error: null }; } } };
  const ruoli = new Function('window', 'let _ruoli = null;\n' + m[0] + '\nreturn ruoli;')(window);
  const [a, b] = await Promise.all([ruoli(), ruoli()]);
  assert.strictEqual(chiamate.length, 5, 'due riquadri insieme: cinque is_*, non dieci');
  assert.ok(a.segr && b.segr && !a.direttore);
  await ruoli();
  assert.strictEqual(chiamate.length, 5, 'poi si usa la memoria');
  window.S.user.email = 'altro@example.it';
  await ruoli();
  assert.strictEqual(chiamate.length, 10, 'un altro accesso rilegge');
}

/* ── 4. la Scrivania: conteggi di «Qualità dati» per 10 minuti ── */
async function provaScrivania(src) {
  const m = src.match(/  const RICORDA_MS = [\s\S]*?const contateAlle = [^\n]*\n/);
  assert.ok(m, 'mancano i conteggi ricordati in veste-v2.js');
  const archivio = new Map();
  const sessionStorage = { getItem: (k) => (archivio.has(k) ? archivio.get(k) : null), setItem: (k, v) => archivio.set(k, String(v)) };
  let adesso = 1_000_000;
  const DateFinta = class extends Date { static now() { return adesso; } };
  const f = new Function('sessionStorage', 'email', 'Date', m[0] + '\nreturn { ricordato, ricordaConteggio, RICORDA_MS };')(sessionStorage, () => 'cptpd@did.formedilpadova.it', DateFinta);
  let n = 0;
  const conta = async () => { n++; return { n: 7 }; };
  assert.strictEqual((await f.ricordato('senza-cf', conta)).n, 7);
  assert.strictEqual((await f.ricordato('senza-cf', conta)).n, 7);
  assert.strictEqual(n, 1, 'entro 10 minuti il conteggio non riparte');
  adesso += f.RICORDA_MS + 1;
  await f.ricordato('senza-cf', conta);
  assert.strictEqual(n, 2, 'dopo 10 minuti si riconta');
  let e = 0;
  const fallisce = async () => { e++; return { errore: 'statement timeout' }; };
  assert.ok((await f.ricordato('mail-altri', fallisce)).errore, 'un errore resta un errore');
  await f.ricordato('mail-altri', fallisce);
  assert.strictEqual(e, 2, 'e non si ricorda: alla prossima apertura si riprova');
  f.ricordaConteggio('mail-altri', 3);
  assert.strictEqual((await f.ricordato('mail-altri', fallisce)).n, 3, 'caricando l’elenco in «Qualità dati» il numero si rinnova');
}

/* ── 5. gli agganci ── */
function provaAgganci({ html, veste, oss, yml }) {
  const nav = html.match(/function navTo\(view\)\{[\s\S]*?\n\}\nwindow\.navTo=navTo/)[0];
  const oggi = nav.match(/if\(view==='dashboard'\)unGiro\('pagina-oggi',[\s\S]*?\]\),10000\)/);
  assert.ok(oggi, 'Oggi carica in un giro solo (unGiro «pagina-oggi», 10 secondi)');
  assert.ok(!/aggiornaZonaCoord/.test(oggi[0]) && /window\.contaZonaCoord\(\)/.test(oggi[0]), 'su Oggi si contano i tre numeri, non si riempie la Zona');
  assert.ok(!/if\(view==='dashboard'\)[^\n]*aggiornaZonaCoord/.test(nav), 'nessun altro giro della Zona parte da Oggi');
  assert.ok(/if\(view==='admin'\)\{unGiro\('zona-coordinatore',\(\)=>\(window\.aggiornaZonaCoord\|\|loadFattureCoord\)\(\),0\)/.test(nav), 'la Zona si riempie quando la si apre, un giro alla volta');
  assert.ok(/unGiro\('incarichi',loadIncarichi,15000\)\.then\(/.test(nav) && /async function loadDash\(\)\{[\s\S]{0,400}unGiro\('incarichi',loadIncarichi,15000\)/.test(html), 'gli incarichi di Oggi: lo stesso giro per loadDash e per la veste');
  assert.ok(/function unGiro\(nome,fn,fresco\)\{return window\.UnGiro\?window\.UnGiro\.fai\(nome,fn,\{fresco:fresco\|\|0\}\):Promise\.resolve\(\)\.then\(fn\)\}/.test(html), 'senza un-giro.js tutto va come prima');
  const iGiro = html.indexOf('<script src="un-giro.js?v='), iMod = html.indexOf('<script type="module">');
  assert.ok(iGiro > 0 && iGiro < iMod, 'un-giro.js si carica prima del modulo principale');
  assert.ok(/ un-giro\.js /.test(yml) && /- 'un-giro\.js'/.test(yml), 'un-giro.js sta fra i file pubblicati e fra quelli che fanno partire la pubblicazione');
  assert.ok(/const c=await ossControlloBreve\(es\.dal,es\.al\)/.test(oss) && /window\.UnGiro\.fai\('osservatorio_controllo:'\+dal\+':'\+al,leggi,\{fresco:60000\}\)/.test(oss), 'la tessera Osservatorio usa la lettura condivisa');
  assert.ok(/window\.ossControlloBreve\(es\.dal, es\.al\)/.test(veste) && /scrivaniaUnaVolta\(\)\.catch/.test(veste) && !/[^a-zA-Z]scrivania\(\)\.catch/.test(veste), 'la Scrivania usa la stessa lettura e un giro alla volta');
  assert.ok(/vesteV2\.ricordaConteggio\('senza-cf',_impSenzaCf\.length\)/.test(html) && /vesteV2\.ricordaConteggio\('mail-altri',_impMail\.filter\(r=>!r\.stessa_della_cassa\)\.length\)/.test(html), 'gli elenchi di «Qualità dati» rinnovano il numero della Scrivania');
}

/* ── 6. i controlli sanno fallire: copie rotte apposta ── */
async function deveFallire(che, prova) {
  let fallito = false;
  try { await prova(); } catch (_e) { fallito = true; }
  assert.ok(fallito, 'il controllo doveva fallire sulla copia rotta: ' + che);
}

(async () => {
  await provaGiro(SORGENTI.giro);
  await provaZona(SORGENTI.coord);
  await provaRuoli(SORGENTI.direzione);
  await provaScrivania(SORGENTI.veste);
  provaAgganci(SORGENTI);

  await deveFallire('un-giro senza il controllo «in corso»', () => provaGiro(SORGENTI.giro.replace('if (g && g.corso) return g.corso;', '')));
  await deveFallire('un-giro che ricorda anche gli errori', () => provaGiro(SORGENTI.giro.replace("giri.set(nome, { corso: null, finito: 0, ok: false }); throw e;", "giri.set(nome, { corso: null, finito: Date.now(), ok: true, esito: undefined }); throw e;")));
  await deveFallire('conteggio fallito trattato come zero', () => provaZona(SORGENTI.coord.replace("const numeri = ko ? { errore:", "const numeri = false ? { errore:").replace("{ fatture: r[0].value, critici: r[1].value, decise: r[2].value }", "{ fatture: r[0].value || 0, critici: r[1].value || 0, decise: r[2].value || 0 }")));
  await deveFallire('«posso vedere» chiesto due volte', () => provaZona(SORGENTI.coord.replace('if (!_chiedo) {', 'if (true) {')));
  await deveFallire('ruoli senza lettura condivisa', () => provaRuoli(SORGENTI.direzione.replace('if (_ruoliInCorso && _ruoliInCorso.email === email) return _ruoliInCorso.p;', '')));
  await deveFallire('conteggio fallito ricordato', () => provaScrivania(SORGENTI.veste.replace('    if (c.errore) return c;\n', '')));
  await deveFallire('Oggi che riempie ancora la Zona', () => provaAgganci({ ...SORGENTI, html: SORGENTI.html.replace("(window.contaZonaCoord?window.contaZonaCoord():Promise.resolve())", "(window.aggiornaZonaCoord||loadFattureCoord)()") }));
  await deveFallire('incarichi chiesti due volte da Oggi', () => provaAgganci({ ...SORGENTI, html: SORGENTI.html.replace("loadIncarichi&&unGiro('incarichi',loadIncarichi,15000)", 'loadIncarichi&&loadIncarichi()') }));
  console.log('un-giro: ok');
})().catch((e) => { console.error(e); process.exit(1); });
