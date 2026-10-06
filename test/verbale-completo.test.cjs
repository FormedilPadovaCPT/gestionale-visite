// node test/verbale-completo.test.cjs
// (03/10/2026, deciso dall'utente) «Tutti i campi richiesti dall'Osservatorio come obbligatori
// devono essere obbligatori anche per noi», e il verbale si chiude solo se è completo.
// Quello che questi controlli tengono fermo:
//   · a decidere la chiusura è il database (chiudi_verbale): la pagina salva una BOZZA e poi chiede;
//   · nessun campo nasce già compilato (tipo di accesso, coordinamento, ora di inizio, tipo del committente);
//   · la scheda del cantiere nuovo nasce completa, e «Non disponibile» non basta;
//   · il committente del verbale non sovrascrive in silenzio quello della scheda del cantiere;
//   · l'ora di fine sta nell'ultimo passo, accanto alla chiusura;
//   · l'esportazione non manda più la mail del committente come mail del referente dell'impresa.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const radice = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(radice, 'index.html'), 'utf8');
const oss = fs.readFileSync(path.join(radice, 'osservatorio.js'), 'utf8');
const sql = fs.readFileSync(path.join(radice, 'supabase', 'sql', '2026_10_03_verbale_completo.sql'), 'utf8');

const prendi = (re, nome) => { const m = html.match(re); assert.ok(m, nome + ' non trovata in index.html'); return m[0]; };

/* ── scheda del cantiere ── */
const cantiereMancanze = Function(prendi(/function cantiereMancanze\(d\)\{[\s\S]*?\r?\n\}/, 'cantiereMancanze') + '; return cantiereMancanze')();
const completo = { comune: 'PADOVA', tipInt: '2', tipOpe: '2', tipOpeAltro: '', durata: '3', importo: '1' };
assert.deepStrictEqual(cantiereMancanze(completo), []);
// casi rotti apposta: ognuno deve essere visto
assert.deepStrictEqual(cantiereMancanze({}).map((x) => x.campo), ['mc-com', 'mc-tip-int', 'mc-tip-ope', 'mc-durata', 'mc-importo']);
assert.deepStrictEqual(cantiereMancanze({ ...completo, comune: '  ' }).map((x) => x.campo), ['mc-com']);
assert.deepStrictEqual(cantiereMancanze({ ...completo, tipInt: '5' }).map((x) => x.campo), ['mc-tip-int'], 'il 5 («Altro») non è nella tabella nazionale');
assert.deepStrictEqual(cantiereMancanze({ ...completo, tipOpe: '16' }).map((x) => x.campo), ['mc-tip-ope-altro'], '«Altro» vuole la descrizione');
assert.deepStrictEqual(cantiereMancanze({ ...completo, tipOpe: '16', tipOpeAltro: 'Cabina elettrica' }), []);
assert.deepStrictEqual(cantiereMancanze({ ...completo, tipOpe: '17' }).map((x) => x.campo), ['mc-tip-ope']);
assert.deepStrictEqual(cantiereMancanze({ ...completo, durata: '7' }).map((x) => x.campo), ['mc-durata'], '«Non disponibile» non basta per la durata');
assert.ok(/stimala/.test(cantiereMancanze({ ...completo, durata: '7' })[0].testo));
assert.deepStrictEqual(cantiereMancanze({ ...completo, importo: '11' }).map((x) => x.campo), ['mc-importo'], '«Non disponibile» non basta per l’importo');
assert.strictEqual(cantiereMancanze(null).length, 5);
// la maschera la usa, e blocca il cantiere nuovo e quello aperto dal verbale
const salvaCant = prendi(/\$\('btn-mc-save'\)\.onclick=async\(\)=>\{[\s\S]*?const fields=\{/, 'salvataggio della scheda cantiere');
assert.ok(/cantiereMancanze\(\{comune:vGet\('mc-com'\)/.test(salvaCant), 'la scheda del cantiere deve passare da cantiereMancanze');
assert.ok(/if\(!window\._editCantId\|\|window\._mcGeoFrom==='visita'\)\{[\s\S]{0,400}return/.test(salvaCant), 'cantiere nuovo o aperto dal verbale: incompleto non si salva');
for (const et of ['Tipo intervento \\*', 'Tipo opera \\*', 'Durata cantiere \\*', 'Importo lavori \\(€\\) \\*', 'Comune \\*']) {
  assert.ok(new RegExp('<label>' + et + '</label>').test(html), 'manca l’asterisco su ' + et);
}

/* ── committente del verbale e della scheda ── */
const committenteDiverso = Function(prendi(/function committenteDiverso\(scheda,verbale\)\{[\s\S]*?\r?\n\}/, 'committenteDiverso') + '; return committenteDiverso')();
assert.strictEqual(committenteDiverso('PRVNCI87B16G224Q', 'MCCMKM82D63Z127G'), true);
assert.strictEqual(committenteDiverso('PRVNCI87B16G224Q', ' prvnci87b16g224q '), false, 'maiuscole e spazi non contano');
assert.strictEqual(committenteDiverso('', 'MCCMKM82D63Z127G'), false, 'scheda senza committente: si collega, non è «diverso»');
assert.strictEqual(committenteDiverso('PRVNCI87B16G224Q', ''), false);
assert.strictEqual(committenteDiverso(null, undefined), false);

/* ── il salvataggio ── */
const save = prendi(/async function saveVisita\(stato\)\{[\s\S]*?\r?\n\}\r?\n\r?\nfunction buildSnap/, 'saveVisita');
assert.ok(/const _chiudi=stato==='definitivo'/.test(save), 'la richiesta di chiusura va riconosciuta');
assert.ok(/stato:_chiudi\?'bozza':stato/.test(save), 'chi chiede «Definitivo» salva una BOZZA: lo stato lo cambia il database');
assert.ok(!/\n\s+stato\r?\n\s+\}/.test(save), 'la riga della visita non deve più portare lo stato richiesto così com’è');
const iChiudi = save.indexOf("sb.rpc('chiudi_verbale',{p_visita_id:vid})");
assert.ok(iChiudi > 0, 'la chiusura passa da chiudi_verbale');
for (const tab of ['visite_checklist', 'visite_lavorazioni', 'visite_imprese_presenti']) {
  const iIns = save.lastIndexOf("sb.from('" + tab + "').insert(");
  assert.ok(iIns > 0 && iIns < iChiudi, tab + ' va scritta PRIMA di chiedere la chiusura');
}
assert.ok(save.indexOf("update({impresa_email_ref:_ev})") < iChiudi, 'l’indirizzo scritto nel verbale entra in anagrafica prima della chiusura, che lo cerca lì');
assert.ok(/if\(_chiudi&&!_eraDefinitivo\)\{/.test(save), 'un verbale già definitivo non ripassa dalla chiusura');
assert.ok(/if\(_eCv\)throw new Error\('il verbale è salvato come BOZZA/.test(save), 'se la chiusura non risponde lo si dice: resta bozza');
assert.ok(/else\{stato='bozza';_mancanze=\(_cv&&_cv\.mancanze\)\|\|\[\]\}/.test(save), 'incompleto: resta bozza e si tiene l’elenco');
assert.ok(/if\(_mancanze\)mostraMancanze\(_mancanze,\{salvato:true\}\)/.test(save), 'l’elenco di ciò che manca va mostrato');
assert.ok(/_eraDefinitivo=true;stato='definitivo';vistaRow\.stato='definitivo'/.test(save), 'un definitivo resta definitivo');
// il committente non si sovrascrive in silenzio: la domanda viene prima di ogni scrittura
const iGuardia = save.indexOf('committenteDiverso(_att,_ci)');
assert.ok(iGuardia > 0 && iGuardia < save.indexOf("sb.from('visite').insert({...vistaRow") && iGuardia < save.indexOf('cantiere_importo:impSel'), 'la domanda sul committente sta prima delle scritture');
// 04/10/2026: risalvare una riga esistente non riscrive «elimina» e «stage_sn» fissi, e non resuscita un eliminato
assert.ok(/if\(byId&&\+byId\.elimina===1\)throw new Error/.test(save), 'un verbale eliminato mentre era aperto non si risalva');
assert.ok(/if\(byId\)\{\s*delete vistaRow\.elimina;delete vistaRow\.stage_sn/.test(save), 'sulla riga esistente elimina e stage_sn restano quelli del database');
assert.ok(/insert\(\{\.\.\.vistaRow,elimina:0,stage_sn:false\}\)/.test(save), 'un verbale nuovo nasce non eliminato');
assert.ok(/if\(snap\.qual_ppre\)selComEScritto\(\$\('f-qual-ppre'\),snap\.qual_ppre\)/.test(html), 'una qualifica fuori elenco resta «com\'è scritto»');
assert.ok(/if\(!confirm\('COMMITTENTE DIVERSO DA QUELLO DEL CANTIERE[\s\S]{0,900}return/.test(save), 'con Annulla non si salva niente');
// dalla pagina si ferma solo l'impresa doppia; il resto lo decide il database
assert.ok(/const _doppie=_manca\.filter\(x=>x\.cosa==='impresa-doppia'\)/.test(save));
assert.ok(!/toast\(_m0\.testo/.test(save), 'non si mostra più un errore alla volta');

/* ── l'elenco intero ── */
const mostra = prendi(/function mostraMancanze\(lista,opt\)\{[\s\S]*?\r?\n\}/, 'mostraMancanze');
assert.ok(/lista\.map\(/.test(mostra) && /esc\(m\.testo/.test(mostra), 'tutte le righe, col testo protetto');
const vai = prendi(/function vaiAlCampoMancante\(m\)\{[\s\S]*?\r?\n\}/, 'vaiAlCampoMancante');
assert.ok(/m\.campo==='scheda-cantiere'\)\{activateTab\(1\);editCantiereForm\(\)/.test(vai), 'le mancanze della scheda aprono la scheda del cantiere');
assert.ok(/closest\('\.tab-content'\)/.test(vai), 'il passo si ricava da dove sta il campo, non da un numero scritto altrove');

/* ── niente valori già pronti ── */
const selTipo = prendi(/<select id="f-tipo"[\s\S]*?<\/select>/, 'f-tipo');
assert.ok(/^<select id="f-tipo"[^>]*>\s*<option value="">/.test(selTipo), 'la tipologia di accesso parte vuota');
assert.ok(!/selected/.test(selTipo));
const selCoord = prendi(/<select id="f-coord">[\s\S]*?<\/select>/, 'f-coord');
assert.ok(/^<select id="f-coord"><option value="">/.test(selCoord), 'il coordinamento parte senza scelta');
assert.ok(!/type="checkbox" id="f-coord"/.test(html));
const coordVal = Function('vGet', prendi(/function coordVal\(\)\{[^\n]*\}/, 'coordVal') + '; return coordVal');
assert.strictEqual(coordVal(() => '1')(), true);
assert.strictEqual(coordVal(() => '0')(), false);
assert.strictEqual(coordVal(() => '')(), null, 'non scelto è null, non «no»');
assert.ok(!/cGet\('f-coord'\)|cSet\('f-coord'/.test(html));
const init = prendi(/async function initForm\(snap=null\)\{[\s\S]*?\r?\n\}/, 'initForm');
// (04/10/2026, deciso dall'utente) l'ora di inizio torna compilata all'apertura del verbale nuovo; tipo e coordinamento restano da scegliere
assert.ok(/oraAdesso\('f-da'\)/.test(init) && /vSet\('f-tipo',''\)/.test(init) && /vSet\('f-coord',''\)/.test(init), 'una visita nuova ha l’ora di inizio d’apertura, ma tipo e coordinamento non già scritti');
assert.ok(html.includes("if(snap.ora_visita||snap.visita_id)vSet('f-da',snap.ora_visita||'')"), 'una bozza riaperta tiene la sua ora (o resta vuota), mai l’ora della riapertura');
assert.ok(!/toTimeString\(\)/.test(init), 'l’ora di inizio non è più l’ora di apertura della maschera');
assert.ok(!/<input type="radio" name="mc-tipo"[^>]*checked/.test(html) && !/<input type="radio" name="comm-tipo"[^>]*checked/.test(html), 'pubblico/privato non nasce già scelto');
assert.ok(!/(mc|comm)-tipo-nd/.test(html), '«N/D» non è più una scelta per il tipo del committente');
assert.ok(/if\(tipoVal!=='1'&&tipoVal!=='2'\)\{toast\('Indica se il committente è pubblico o privato/.test(html), 'committente nuovo: pubblico o privato è obbligatorio');

/* ── l'ora di fine nell'ultimo passo ── */
const tab0 = html.indexOf('data-tab="0"'), tab1 = html.indexOf('data-tab="1"'), tab15 = html.indexOf('data-tab="15"');
const iFine = html.indexOf('id="f-a"'), iInizio = html.indexOf('id="f-da"'), iFinal = html.indexOf('id="btn-final"');
assert.ok(tab0 > 0 && tab1 > tab0 && tab15 > tab1);
assert.strictEqual(html.split('id="f-a"').length, 2, 'un solo campo ora di fine');
assert.ok(iFine > tab15 && iFine < iFinal, 'l’ora di fine sta nell’ultimo passo, sopra il pulsante che chiude');
assert.ok(iInizio > tab0 && iInizio < tab1, 'l’ora di inizio resta nel primo passo');
assert.ok(/window\.oraAdesso=oraAdesso/.test(html) && /onclick="oraAdesso\('f-a'\)"/.test(html) && /onclick="oraAdesso\('f-da'\)"/.test(html));

/* ── esportazione ── */
assert.ok(!/_xel\('visitaImpresaEmailRefVis'/.test(oss), 'la mail del committente non va esportata come mail del referente dell’impresa');
assert.ok(!/v\.comm_email\)xv\+=/.test(oss));

/* ── lo script del database ── */
for (const cosa of ['ora-inizio', 'ora-fine', 'orari', 'tipo-accesso', 'persona-presente', 'cantiere-comune', 'cantiere-intervento',
  'cantiere-opera', 'cantiere-durata', 'importo', 'committente', 'committente-tipo', 'coordinamento', 'lavorazioni', 'imprese',
  'ruolo', 'email-impresa', 'checklist', 'nc-senza-nota', 'doppione', 'data-futura']) {
  assert.ok(sql.includes("'cosa','" + cosa + "'"), 'verbale_mancanze non controlla: ' + cosa);
}
assert.ok(/revoke execute on function public\.verbale_mancanze\(text\) from public, anon;/.test(sql));
assert.ok(/revoke execute on function public\.chiudi_verbale\(text\) from public, anon;/.test(sql));
assert.ok(/before insert or update of stato on public\.visite/.test(sql), 'il trigger guarda il passaggio di stato');
assert.ok(/auth\.uid\(\) is not null/.test(sql), 'le scritture senza utente (importazioni) non sono toccate');
assert.ok(/old\.stato is distinct from 'definitivo'/.test(sql), 'chi risalva un definitivo non è toccato');

/* (06/10/2026, deciso dall'utente) il comune deve avere anche il codice ISTAT, che chiede l'Osservatorio: il 03/10
   bastava il nome perché l'elenco era solo provinciale; ora l'elenco ISTAT è completo e c'è «➕ Altro comune» */
const sqlIstat = fs.readFileSync(path.join(radice, 'supabase', 'sql', '2026_10_06_verbale_mancanze_codice_istat.sql'), 'utf8');
assert.ok(/if trim\(coalesce\(c\.comune_nome,''\)\) = '' then\s+esito := esito \|\| jsonb_build_object\('cosa','cantiere-comune'/.test(sqlIstat), 'senza il nome del comune il verbale non si chiude');
assert.ok(/elsif coalesce\(c\.cantiere_comune_cod,''\) !~ '\^\[0-9\]\{6\}\$' then\s+esito := esito \|\| jsonb_build_object\('cosa','cantiere-comune'/.test(sqlIstat), 'senza il codice ISTAT del comune il verbale non si chiude');
assert.ok(/Altro comune/.test(sqlIstat), 'il messaggio dice come rimediare a un comune fuori provincia');

console.log('ok — verbale completo: chiusura dal database, niente precompilati, scheda cantiere, committente, ora di fine');
