/* ============================================================
   Registro delle tendine che scrivono dati (04/10/2026)

   Perché esiste: il 04/10/2026 «Modifica impresa» del gestionale aveva
   tendine a codice (CCNL 1-6) per una colonna che la segreteria scrive a
   parole, e salvando senza toccare cancellava i dati. Nessun controllo lo
   vedeva: guardavano colonne e sintassi, mai CHE COSA scrivono due app
   nella stessa colonna. Questo strumento lo guarda.

   tendine-registro.json dice, per ogni tendina, che cosa scrive
   (tabella.colonna) o perché non scrive dati (filtro, elenco costruito
   al momento, ...). Le voci NON si scrivono a mano: le legge dal codice.

   node tools/tendine.cjs            controlla (lo usa il test prima del push):
                                     - una tendina nuova non registrata → errore
                                     - voci cambiate nel codice e non nel registro → errore
                                     - due tendine sulla stessa colonna con voci diverse → errore
   node tools/tendine.cjs --scrivi   rilegge le voci dal codice, aggiorna il registro
                                     e scrive tools/tendine-registro.sql, da applicare
                                     al database (s_tendine_registro): è l'elenco con cui
                                     il giro settimanale s_controllo_tendine() confronta
                                     i valori veri.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..');
const SEGR = path.join(RADICE, '..', 'segreteria-app');
const REG = path.join(__dirname, 'tendine-registro.json');
const SQL = path.join(__dirname, 'tendine-registro.sql');

const leggi = (f) => fs.readFileSync(f, 'utf8');
const fileApp = (app, f) => path.join(app === 'segreteria' ? SEGR : RADICE, f);

/* le voci di un <select id="..."> scritto nell'HTML (o in un modello JS) */
function vociHtml(testo, id) {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = testo.match(new RegExp('<select[^>]*id="' + esc + '"[^>]*>([\\s\\S]*?)</select>'));
  if (!m) return null;
  const voci = [];
  for (const o of m[1].matchAll(/<option(?:\s+value="([^"]*)")?[^>]*>([^<]*)<\/option>/g)) {
    const v = o[1] !== undefined ? o[1] : o[2].trim();
    if (v !== '') voci.push(v);
  }
  return voci;
}

/* il letterale di `const NOME = ...` (array o oggetto), valutato con le
   costanti MAIUSCOLE dello stesso file che usa (es. CCNL_OPZIONI) */
function letterale(testo, nome) {
  const m = testo.match(new RegExp('(?:export\\s+)?const\\s+' + nome + '\\s*=\\s*'));
  if (!m) return null;
  let i = m.index + m[0].length;
  const apre = testo[i];
  if (apre !== '[' && apre !== '{') return null;
  const chiude = apre === '[' ? ']' : '}';
  let liv = 0, str = null;
  for (let j = i; j < testo.length; j++) {
    const c = testo[j];
    if (str) { if (c === '\\') { j++; continue; } if (c === str) str = null; continue; }
    if (c === '\'' || c === '"' || c === '`') { str = c; continue; }
    if (c === '/' && testo[j + 1] === '*') { j = testo.indexOf('*/', j + 2) + 1; continue; }
    if (c === '/' && testo[j + 1] === '/') { j = testo.indexOf('\n', j); continue; }
    if (c === '[' || c === '{') liv++;
    else if (c === ']' || c === '}') { liv--; if (liv === 0 && c === chiude) return testo.slice(i, j + 1); }
  }
  return null;
}
function valuta(testo, nome, visti = new Set()) {
  const lit = letterale(testo, nome);
  if (lit === null) return undefined;
  const usati = [...new Set((lit.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) || []))].filter((n) => n !== nome && !visti.has(n));
  const nomi = [], valori = [];
  for (const u of usati) {
    visti.add(u);
    const v = valuta(testo, u, visti);
    if (v !== undefined) { nomi.push(u); valori.push(v); }
  }
  return new Function(...nomi, 'return (' + lit + ');')(...valori);
}
function vociJs(testo, nome, chiave) {
  let v = valuta(testo, nome);
  if (v === undefined) return null;
  if (chiave) v = v[chiave];
  if (v === undefined) return null;
  if (Array.isArray(v)) return v.map((x) => String(Array.isArray(x) ? x[0] : x));
  return Object.keys(v);
}

function vociDi(t) {
  const f = t.fonte;
  const testo = leggi(fileApp(t.app, f.file));
  return f.tipo === 'html' ? vociHtml(testo, f.id) : vociJs(testo, f.nome, f.chiave);
}

/* tutte le tendine scritte nel codice, con l'id fisso (senza ${...} tranne im-tipo) */
function tendineNelCodice() {
  const out = [];
  const scan = (app, dir, filtro) => {
    for (const f of fs.readdirSync(dir).filter(filtro)) {
      const testo = leggi(path.join(dir, f));
      for (const m of testo.matchAll(/<select[^>]*\bid="([^"]+)"/g)) {
        const id = m[1];
        if (id.includes('${') && id !== 'im-tipo-${idx}') continue;
        out.push({ app, file: path.relative(app === 'segreteria' ? SEGR : RADICE, path.join(dir, f)).replace(/\\/g, '/'), id });
      }
    }
  };
  scan('gestionale', RADICE, (f) => f === 'index.html' || f.endsWith('.js'));
  if (fs.existsSync(SEGR)) {
    scan('segreteria', path.join(SEGR, 'js'), (f) => f.endsWith('.js'));
    scan('segreteria', SEGR, (f) => f === 'index.html');
  }
  return out;
}

function controlla() {
  const reg = JSON.parse(leggi(REG));
  const errori = [];
  /* `select` = l'id della tendina quando le voci vengono da una costante JS */
  const registrate = new Set(reg.tendine.map((t) => t.app + ':' + (t.select || t.fonte.id || t.fonte.nome + (t.fonte.chiave ? '.' + t.fonte.chiave : ''))));
  const giaNote = new Set((reg.segreteria_gia_presenti || []).map((id) => 'segreteria:' + id));
  for (const s of tendineNelCodice()) {
    if (s.app === 'segreteria' && !fs.existsSync(SEGR)) continue;
    const k = s.app + ':' + s.id;
    if (!registrate.has(k) && !giaNote.has(k)) {
      errori.push(`tendina nuova non registrata: ${s.app} ${s.file} id="${s.id}" — aggiungila a tools/tendine-registro.json (che colonna scrive? o è un filtro?)`);
    }
  }
  const perColonna = {};
  for (const t of reg.tendine.filter((x) => x.classe === 'dato')) {
    if (t.app === 'segreteria' && !fs.existsSync(SEGR)) continue;
    let voci;
    try { voci = vociDi(t); } catch (e) { errori.push(`${t.id}: non riesco a leggere le voci (${e.message})`); continue; }
    if (!voci) { errori.push(`${t.id}: la tendina non si trova più nel codice (${t.fonte.file})`); continue; }
    if (JSON.stringify(voci) !== JSON.stringify(t.voci)) {
      errori.push(`${t.id}: le voci nel codice sono cambiate — node tools/tendine.cjs --scrivi, poi applica tools/tendine-registro.sql`);
    }
    const col = t.tabella + '.' + t.colonna;
    (perColonna[col] = perColonna[col] || []).push({ t, voci });
  }
  for (const [col, lista] of Object.entries(perColonna)) {
    const rif = [...lista[0].voci].sort().join('|');
    for (const { t, voci } of lista.slice(1)) {
      if ([...voci].sort().join('|') !== rif) {
        errori.push(`${col}: «${lista[0].t.id}» e «${t.id}» hanno voci diverse per la stessa colonna — è il difetto del CCNL del 04/10/2026: allineale`);
      }
    }
  }
  return errori;
}

function scrivi() {
  const reg = JSON.parse(leggi(REG));
  for (const t of reg.tendine.filter((x) => x.classe === 'dato')) {
    const v = vociDi(t);
    if (!v) throw new Error(t.id + ': tendina non trovata');
    t.voci = v;
  }
  fs.writeFileSync(REG, JSON.stringify(reg, null, 2) + '\n');
  const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
  const righe = reg.tendine.filter((t) => t.classe === 'dato').map((t) =>
    `  (${q(t.id)}, ${q(t.app)}, ${q(t.fonte.file + ' ' + (t.fonte.id || t.fonte.nome + (t.fonte.chiave ? '.' + t.fonte.chiave : '')))}, ${q(t.tabella)}, ${q(t.colonna)}, array[${t.voci.map(q).join(', ')}]::text[])`);
  fs.writeFileSync(SQL, `-- Generato da tools/tendine.cjs --scrivi: NON modificare a mano.
-- Le voci delle tendine che scrivono dati, lette dal codice delle app.
-- Si applica al database dopo ogni --scrivi (lo usa s_controllo_tendine()).
begin;
delete from public.s_tendine_registro;
insert into public.s_tendine_registro (id, app, dove, tabella, colonna, voci) values
${righe.join(',\n')};
commit;
`);
  console.log('registro aggiornato:', righe.length, 'tendine che scrivono dati; SQL in tools/tendine-registro.sql');
}

module.exports = { controlla, scrivi, vociHtml, vociJs, tendineNelCodice };

if (require.main === module) {
  if (process.argv.includes('--scrivi')) scrivi();
  const errori = controlla();
  if (errori.length) { console.error(errori.join('\n')); process.exit(1); }
  console.log('tendine: tutto registrato e allineato');
}
