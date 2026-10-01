// Importo, intervento, opera, durata e committente sono dati del CANTIERE (01/10/2026, deciso dall'utente
// dopo il confronto col modello nazionale): pagina Statistiche, Report visite e report Osservatorio leggono
// la scheda del cantiere, come il file che va all'Osservatorio. Resta la stampa col vecchio parametro
// (il dichiarato in ogni visita), che lo scrive su ogni pagina.
// Uso: node test/dati-del-cantiere.test.cjs
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const assert = require('assert')

const dir = path.join(__dirname, '..')
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
const dati = fs.readFileSync(path.join(dir, 'app-data.js'), 'utf8')
const oss = fs.readFileSync(path.join(dir, 'osservatorio.js'), 'utf8')

function estrai(testo, inizio, fine, dove) {
  const a = testo.indexOf(inizio)
  assert.ok(a >= 0, 'non trovo in ' + dove + ': ' + inizio)
  const b = testo.indexOf(fine, a)
  assert.ok(b > a, 'non trovo la fine di: ' + inizio)
  return testo.slice(a, b)
}

const ctx = {}
vm.createContext(ctx)
vm.runInContext(
  estrai(html, 'const NOTA_VECCHIO_PARAMETRO=', 'function _ceivDash(', 'index.html') +
  estrai(html, 'function osImportoClass(code){', '// ── formattazioni ──', 'index.html') +
  estrai(html, 'function oxCatOf(v,c,ruolo,vecchio){', '/* 01/10/2026 — Tre calcoli riallineati', 'index.html') +
  '\nthis.dc=datiCantiereStat;this.manca=datiCantiereMancanti;this.cat=oxCatOf;this.NOTA=NOTA_VECCHIO_PARAMETRO', ctx)
const { dc, manca, cat, NOTA } = ctx

// ── 1. vale la scheda del cantiere; il dichiarato nella visita solo col vecchio parametro ──
// (caso vero: Albignasego via Milano, scheda «fino a 250», dichiarato «da 251 a 500» in 8 visite su 11)
const v = { vis_tip_int: 2, vis_tip_ope: 1, vis_importo: 2, vis_durata: 3, comm_tipo: 1 }
const c = { cantiere_tip_int: 1, cantiere_tip_ope: 2, cantiere_importo: 1, cantiere_durata: 2, committenti: { committente_tipo: 2 } }
assert.deepStrictEqual({ ...dc(v, c) }, { tipint: 1, tipope: 2, importo: 1, durata: 2, commtipo: 2 }, 'deve valere la scheda del cantiere')
assert.deepStrictEqual({ ...dc(v, c, true) }, { tipint: 2, tipope: 1, importo: 2, durata: 3, commtipo: 1 }, 'vecchio parametro: il dichiarato nella visita')
// scheda del cantiere senza il dato: il dato manca, non si pesca dalla visita (al nazionale mancherà)
const cVuoto = { cantiere_tip_int: null, cantiere_tip_ope: null, cantiere_importo: null, cantiere_durata: null, committenti: null }
assert.deepStrictEqual({ ...dc(v, cVuoto) }, { tipint: null, tipope: null, importo: null, durata: null, commtipo: null })
// col vecchio parametro la scheda resta la riserva
assert.strictEqual(dc({ vis_importo: null, comm_tipo: null }, c, true).importo, 1)
assert.strictEqual(dc({ vis_importo: null, comm_tipo: null }, c, true).commtipo, 2)
// una visita senza cantiere non ha scheda: resta quello che dice la visita
assert.strictEqual(dc(v, null).importo, 2)
assert.strictEqual(dc(v, {}).tipint, 2)

// ── 2. quante visite stanno su schede incomplete ──
assert.strictEqual(manca([{ c }, { c }]), '', 'schede complete: nessun avviso')
assert.strictEqual(manca([{ c }, { c: cVuoto }, { c: Object.assign({}, c, { committenti: null }) }]),
  'committente 2, importo 1, tipo di intervento 1, tipo di opera 1, durata 1')
assert.strictEqual(manca([{ c: null }]), 'committente 1, importo 1, tipo di intervento 1, tipo di opera 1, durata 1')

// ── 3. report Osservatorio: categorie dalla scheda del cantiere ──
const vv = Object.assign({ cantieri: c, tipo_accesso_naz: 5 }, v)
assert.strictEqual(cat(vv, c, 2).importo, 1, 'classe di importo dal cantiere (1 = fino a 250)')
assert.strictEqual(cat(vv, c, 2, true).importo, 2, 'vecchio parametro: classe dichiarata nella visita')
assert.strictEqual(cat(vv, c, 2).tipint, 1)
assert.strictEqual(cat(vv, c, 2).tipope, 1, 'opera 2 Civile = categoria 1 del report')
assert.strictEqual(cat(vv, c, 2).commtipo, 2)
assert.strictEqual(cat(vv, c, 2, true).commtipo, 1)
// tipo di visita e ruolo restano della visita
assert.strictEqual(cat(vv, c, 2).tipvisita, 2)
assert.strictEqual(cat(vv, c, 2).ruolo, 2)

// ── 4. i tre punti passano dalla stessa funzione ──
const dash = estrai(html, '// fetch visite con cantiere + impresa principale', '// Dataset leggero su TUTTO lo storico', 'index.html')
assert.ok(/const dc=datiCantiereStat\(r,r\.cantieri\)/.test(dash) && /tipint:dc\.tipint, tipope:dc\.tipope, importo:dc\.importo/.test(dash), 'pagina Statistiche: non legge la scheda del cantiere')
assert.ok(!/r\.vis_importo\?\?/.test(dash), 'pagina Statistiche: legge ancora il dichiarato nella visita')
const rpt = estrai(html, 'async function admGeneraReport(){', 'window.admGeneraReport = admGeneraReport', 'index.html')
assert.ok(/const dcDi=v=>datiCantiereStat\(v,v\.cantieri,vecchio\)/.test(rpt), 'Report visite: non passa da datiCantiereStat')
assert.ok(!/v\.vis_(tip_int|tip_ope|importo|durata)\?\?/.test(rpt) && !/v\.comm_tipo\|\|/.test(rpt), 'Report visite: legge ancora il dichiarato nella visita')
assert.ok(/committenti\(committente_tipo\)/.test(rpt) && /cantiere_durata/.test(rpt))
assert.ok(/\$\{vecchio\?'_vecchio-parametro':''\}\.pdf/.test(rpt), 'Report visite: il nome del file non dice che e’ col vecchio parametro')
assert.strictEqual((rpt.match(/rptPageHeader\(doc,'[^']*',dalFmt,alFmt,notaVecchio\)/g) || []).length, 5, 'Report visite: la nota deve stare su tutte e cinque le pagine')
const ros = estrai(html, 'async function admGeneraReportOsservatorio(){', 'window.admGeneraReportOsservatorio', 'index.html')
assert.ok(/oxCatOf\(v,c,ruoloByVis\[v\.visita_id\],vecchio\)/.test(ros))
assert.ok(/_oxNotaVecchio=vecchio\?NOTA_VECCHIO_PARAMETRO:''/.test(ros) && /finally\{_oxNotaVecchio=''\}/.test(ros), 'Osservatorio: la nota del vecchio parametro non viene tolta a fine stampa')
assert.ok(/STAMPA COL VECCHIO PARAMETRO/.test(ros), 'Osservatorio: la copertina non lo dice')
assert.ok(/\(vecchio\?'_vecchio-parametro':''\)\+'\.pdf'/.test(ros))
assert.ok(/if\(_oxNotaVecchio\)/.test(estrai(html, 'function oxFooter(doc,pg){', 'function oxSec(', 'index.html')), 'Osservatorio: la nota non e’ in fondo a ogni pagina')
assert.ok(/importo, intervento, opera, durata e committente/.test(NOTA))
assert.ok(/id="sgr-vecchio"/.test(html), 'manca la casella «vecchio parametro»')

// ── 5. verbale: l'importo scelto va nella scheda del cantiere, prima di salvare la visita ──
const save = estrai(html, 'async function saveVisita(stato){', 'function buildSnap(', 'index.html')
// nei cantieri con codice CNCE la scheda porta il dato della Cassa Edile: si sovrascrive solo con la conferma del tecnico
const azCtx = {}
vm.createContext(azCtx)
vm.runInContext(estrai(html, 'function importoVerbaleAzione(scelto,cant){', '// Propone la fascia', 'index.html') + '\nthis.az=importoVerbaleAzione', azCtx)
const az = azCtx.az
assert.strictEqual(az(2, { cantiere_importo: 1, cantiere_cnce: 'CNCE-PD-123' }), 'chiedi', 'cantiere della Cassa Edile: prima di cambiare l’importo si chiede')
assert.strictEqual(az(1, { cantiere_importo: 1, cantiere_cnce: 'CNCE-PD-123' }), 'niente')
assert.strictEqual(az(2, { cantiere_importo: null, cantiere_cnce: 'CNCE-PD-123' }), 'scrivi', 'scheda senza importo: si scrive')
assert.strictEqual(az(2, { cantiere_importo: 11, cantiere_cnce: 'CNCE-PD-123' }), 'scrivi', '«non disponibile» non e’ un dato della Cassa da difendere')
assert.strictEqual(az(11, { cantiere_importo: 3, cantiere_cnce: 'CNCE-PD-123' }), 'chiedi')
assert.strictEqual(az(2, { cantiere_importo: 1, cantiere_cnce: null }), 'scrivi', 'cantiere non della Cassa Edile: vale l’ultimo dichiarato')
assert.strictEqual(az(2, { cantiere_importo: 1, cantiere_cnce: '  ' }), 'scrivi')
assert.strictEqual(az(null, { cantiere_importo: 1, cantiere_cnce: 'X' }), 'niente')
assert.strictEqual(az(2, null), 'niente')
const iImp = save.indexOf("update({cantiere_importo:impSel})")
assert.ok(/importoVerbaleAzione\(impSel,cImp\)/.test(save) && /if\(azione==='chiedi'\)/.test(save) && /confirm\(/.test(save), 'salvataggio: non chiede conferma sui cantieri della Cassa Edile')
assert.ok(/if\(azione==='tieni'\)vSet\('f-importo',String\(cImp\.cantiere_importo\)\)/.test(save), 'salvataggio: se il tecnico non conferma la tendina deve tornare al valore della scheda')
const iVis = save.indexOf("// 1) Esiste già una riga con questo visita_id?")
assert.ok(iImp > 0 && iVis > iImp, 'l’importo scelto nel verbale non aggiorna la scheda del cantiere prima del salvataggio')
assert.ok(/if\(eUpImp\)toast\(/.test(save) && /if\(eCantUp\)toast\(/.test(save), 'salvataggio: gli aggiornamenti del cantiere non guardano error')

// ── 6. tabelle: una sola per codice, e i valori che il nazionale ammette ──
const tab = {}
vm.createContext(tab)
vm.runInContext(estrai(dati, 'const _CCNL_LBL=', '// --- Batch 3', 'app-data.js') + '\nthis.F=_CCIA_FULL;this.L=_CCIA_LBL;this.N=_CCNL_FULL', tab)
assert.strictEqual(tab.F, tab.L, 'iscrizione camerale: la scheda e la tendina devono usare la stessa tabella')
assert.strictEqual(tab.N[3], 'Metalmeccanico Industria', 'contratto: la scheda diceva «Lapidei industria» per il codice 3 della tendina')
// tendina del contratto e tabella della scheda: stesse voci
const selCcnl = estrai(html, '<select id="mi-ccnl">', '</select>', 'index.html')
for (const m of selCcnl.matchAll(/<option value="(\d+)">([^<]+)<\/option>/g)) assert.strictEqual(tab.N[m[1]], m[2], 'contratto ' + m[1])
assert.ok(/\?\+co\.committente_tipo:3/.test(oss), 'XML: un committente senza tipo deve andare come 3 «Non disponibile», non 1 «Pubblico»')
assert.ok(/if\(ccia&&ccia<=3\)/.test(oss), 'XML: l’iscrizione camerale ammette solo 1, 2, 3')

// ── 7. le tendine dei dati del cantiere e della visita sono le tabelle del manuale dell'Osservatorio ──
const NAZ = {
  'mc-tip-int': { 1: 'Costruzione', 2: 'Ristrutturazione', 3: 'Demolizione', 4: 'Ampliamento' },
  'mc-tip-ope': { 1: 'Industriale', 2: 'Civile', 3: 'Commerciale', 4: 'Ospedaliera', 5: 'Stradale', 6: 'Rurale', 7: 'Funeraria', 8: 'Scolastica', 9: 'Ferroviaria', 10: 'Marittima', 11: 'Fluviale', 12: 'Sportiva', 13: 'Carceraria', 14: 'Campi eolici', 15: 'Fotovoltaica', 16: 'Altro' },
  'mc-durata': { 1: 'Fino a 3 mesi', 2: 'Da 3 a 12 mesi', 3: 'Da 12 a 24 mesi', 4: 'Da 24 a 36 mesi', 5: 'Da 36 a 48 mesi', 6: 'Oltre 48 mesi', 7: 'Non disponibile' },
  'ec-tipo': { 1: 'Pubblico', 2: 'Privato', 3: 'N/D' }
}
for (const [id, attese] of Object.entries(NAZ)) {
  const sel = estrai(html, '<select id="' + id + '">', '</select>', 'index.html')
  const trovate = {}
  for (const m of sel.matchAll(/<option value="(\d+)">([^<]+)<\/option>/g)) trovate[m[1]] = m[2]
  assert.deepStrictEqual(trovate, Object.fromEntries(Object.entries(attese).map(([k, x]) => [String(k), x])), 'tendina ' + id + ' diversa dalla tabella nazionale')
}
// importo: undici classi, nel verbale e nella scheda del cantiere, con gli stessi estremi
for (const id of ['f-importo', 'mc-importo']) {
  const sel = estrai(html, '<select id="' + id + '">', '</select>', 'index.html')
  const cod = [...sel.matchAll(/<option value="(\d+)">([^<]+)<\/option>/g)]
  assert.deepStrictEqual(cod.map(m => +m[1]), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], id + ': classi di importo')
  assert.ok(/250\.000/.test(cod[0][2]) && /15\.000\.000/.test(cod[9][2]) && /non disponibile/i.test(cod[10][2]), id + ': estremi delle classi')
}
// tipo di visita: le prime sette voci sono la tabella 8 del manuale
const selTipo = estrai(html, '<select id="f-tipo"', '</select>', 'index.html')
const tipi = {}
for (const m of selTipo.matchAll(/<option value="(\d+)">([^<]+)<\/option>/g)) tipi[m[1]] = m[2]
assert.deepStrictEqual([1, 2, 3, 4, 5, 6, 7].map(k => tipi[k]),
  ['Su segnalazione', 'Su richiesta', 'Per protocolli di intesa', 'Indicata da RLS/RLST', 'Programmata', 'Cantiere qualità', 'Indicata dal CPT'])

console.log('ok — dati del cantiere: una funzione sola per Statistiche, Report visite e Osservatorio; vecchio parametro dichiarato; tendine nazionali')
