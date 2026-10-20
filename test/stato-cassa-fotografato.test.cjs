// Stato in Cassa fotografato nel verbale (20/10/2026).
// Chiesto dall'utente preparando le statistiche per la Commissione: «nei verbali questo dato dovrebbe essere
// fotografato e cristallizzato al momento della visita». Prima le statistiche leggevano imprese.stato_cassa,
// che cambia a ogni lista della Cassa: una visita a un'impresa attiva quel giorno e cessata dopo contava «non C.E.I.V.».
// Il database scrive visite_cassa_foto quando il verbale diventa definitivo; la pagina Statistiche e il
// Report visite la leggono, e solo dove manca usano lo stato di oggi, dicendolo.
// Uso: node test/stato-cassa-fotografato.test.cjs
// (INDEX_HTML e CASSA_FOTO_SQL permettono di farlo girare su una copia rotta apposta, per vedere che fallisce.)
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const assert = require('assert')

const html = fs.readFileSync(process.env.INDEX_HTML || path.join(__dirname, '..', 'index.html'), 'utf8')
const sql = fs.readFileSync(process.env.CASSA_FOTO_SQL || path.join(__dirname, '..', 'supabase', 'sql', '2026_10_20_visite_cassa_foto.sql'), 'utf8')
// sera del 20/10/2026: per il 2025-26 senza liste conservate, lo stato attuale dichiarato come tale
const sql2 = fs.readFileSync(process.env.CASSA_FOTO_SQL2 || path.join(__dirname, '..', 'supabase', 'sql', '2026_10_20b_visite_cassa_foto_stato_attuale.sql'), 'utf8')

function estrai(inizio, fine) {
  const a = html.indexOf(inizio)
  assert.ok(a >= 0, 'non trovo in index.html: ' + inizio)
  const b = html.indexOf(fine, a)
  assert.ok(b > a, 'non trovo la fine di: ' + inizio)
  return html.slice(a, b)
}

// ── 1. La regola, nelle funzioni pure ──
const ctx = {}
vm.createContext(ctx)
vm.runInContext(estrai('const CEIV_STAT_ORD=', 'function _ceivDash(')
  + '\nthis.ceivStat=ceivStat;this.ceivFoto=ceivFoto;this.ceivStatVisita=ceivStatVisita;this.notaCeivFoto=notaCeivFoto;'
  + 'this.notaCeivFotoBreve=notaCeivFotoBreve;this.ceivFotoRif=ceivFotoRif;this.ORD=CEIV_STAT_ORD', ctx)
const { ceivFoto, ceivStatVisita, ceivFotoRif, notaCeivFoto, notaCeivFotoBreve, ORD } = ctx
const [ATT, SOS, NON] = ORD
const foto = (impresa_id, stato, iscritta_ceiv, fonte) => ({ impresa_id, stato, iscritta_ceiv, fonte: fonte || 'lista' })

// la foto vince sullo stato di oggi, nei due sensi (il caso vero: Attiva oggi, Cessata alla data della visita)
assert.strictEqual(ceivStatVisita([foto('A', 'Cessata', false)], 'A', { stato_cassa: 'Attiva' }), NON,
  'attiva oggi ma cessata alla data della visita: deve contare non C.E.I.V.')
assert.strictEqual(ceivStatVisita([foto('A', 'Attiva', true)], 'A', { stato_cassa: 'Cessata' }), ATT,
  'attiva alla data della visita e cessata oggi: deve contare attiva')
assert.strictEqual(ceivStatVisita([foto('A', 'Sospesa', true)], 'A', { stato_cassa: 'Attiva' }), SOS, 'sospesa = iscritta, classe sospesa')
// chi non è in lista non è C.E.I.V., anche se oggi l'anagrafica lo dà attivo
assert.strictEqual(ceivStatVisita([foto('A', 'Non in lista', false, 'anagrafica')], 'A', { stato_cassa: 'Attiva' }), NON)
assert.strictEqual(ceivStatVisita([foto('A', 'Non iscritta', false)], 'A', { stato_cassa: 'Attiva' }), NON)
// a decidere è iscritta_ceiv, scritta dal database: uno stato «Attiva» senza iscrizione non conta
assert.strictEqual(ceivFoto([foto('A', 'Attiva', false)], 'A'), NON)
// senza foto, o con una foto non ricostruibile, vale lo stato di oggi
assert.strictEqual(ceivStatVisita([], 'A', { stato_cassa: 'Attiva' }), ATT, 'senza foto: stato di oggi')
assert.strictEqual(ceivStatVisita(null, 'A', { stato_cassa: 'Sospesa' }), SOS)
assert.strictEqual(ceivStatVisita([foto('A', null, null, 'nessuna')], 'A', { stato_cassa: 'Attiva' }), ATT)
assert.strictEqual(ceivFoto([foto('A', 'Attiva', true)], null), null, 'senza impresa principale niente foto')
// la foto di un'altra impresa della stessa visita non conta per la principale
assert.strictEqual(ceivStatVisita([foto('B', 'Attiva', true)], 'A', { stato_cassa: 'Cessata' }), NON)
// due righe per la stessa impresa (unione di schede): vale la migliore, in qualunque ordine
assert.strictEqual(ceivFoto([foto('A', 'Cessata', false), foto('A', 'Attiva', true)], 'A'), ATT)
assert.strictEqual(ceivFoto([foto('A', 'Sospesa', true), foto('A', 'Cessata', false)], 'A'), SOS)

// la foto con lo stato attuale (2025-26 senza liste) conta come foto, ma si riconosce
const att = (impresa_id, stato, iscritta_ceiv) => Object.assign(foto(impresa_id, stato, iscritta_ceiv), { riferimento: 'stato_attuale' })
assert.strictEqual(ceivStatVisita([att('A', 'Sospesa', true)], 'A', { stato_cassa: 'Attiva' }), SOS, 'la foto con lo stato attuale resta ferma')
assert.strictEqual(ceivFotoRif([att('A', 'Attiva', true)], 'A'), 'stato_attuale')
assert.strictEqual(ceivFotoRif([foto('A', 'Attiva', true)], 'A'), 'data_visita', 'senza riferimento = alla data della visita (foto del primo giro)')
assert.strictEqual(ceivFotoRif([att('A', 'Cessata', false), Object.assign(foto('A', 'Attiva', true), { riferimento: 'data_visita' })], 'A'), 'data_visita')
assert.strictEqual(ceivFotoRif([], 'A'), null)
assert.strictEqual(ceivFotoRif([att('B', 'Attiva', true)], 'A'), null)

// la pagina dice da dove viene il dato: tre provenienze, contate a parte
assert.strictEqual(notaCeivFoto(10, 0, 10), 'lista della Cassa Edile alla data della visita')
assert.strictEqual(notaCeivFoto(65, 853, 918), 'lista della Cassa Edile, su 918 visite: 65 alla data della visita; 853 con lo stato fotografato dopo, non alla data della visita')
assert.strictEqual(notaCeivFoto(0, 0, 10), 'lista della Cassa Edile, su 10 visite: 10 con lo stato di oggi')
assert.ok(/3 alla data della visita; 2 con lo stato fotografato dopo[^;]*; 5 con lo stato di oggi/.test(notaCeivFoto(3, 2, 10)))
assert.strictEqual(notaCeivFotoBreve(3, 7, 10), 'stato in Cassa alla data della visita per 3 su 10, fotografato dopo per le altre')
assert.strictEqual(notaCeivFotoBreve(0, 5, 5), 'stato in Cassa fotografato dopo la visita')
assert.strictEqual(notaCeivFotoBreve(0, 0, 5), 'stato in Cassa di oggi')

// ── 2. I due punti delle statistiche leggono la foto ──
const dash = estrai('// fetch visite con cantiere + impresa principale', '// Dataset leggero su TUTTO lo storico')
assert.ok(/visite_cassa_foto\(impresa_id,stato,fonte,iscritta_ceiv,riferimento\)/.test(dash), 'pagina Statistiche: non scarica la foto col riferimento')
assert.ok(/ceiv:ceivStatVisita\(r\.visite_cassa_foto,p&&p\.impresa_id,p&&p\.imprese\)/.test(dash), 'pagina Statistiche: non usa la foto')
assert.ok(/ceivRif:\(p&&ceivFotoRif\(r\.visite_cassa_foto,p\.impresa_id\)\)/.test(dash), 'pagina Statistiche: non sa da dove viene la foto')
assert.ok(!/ceivStat\(p&&p\.imprese\)/.test(dash), 'pagina Statistiche: legge ancora solo lo stato di oggi')
const render = estrai('function _dashRenderCeiv(F){', '\n}')
assert.ok(/notaCeivFoto\(/.test(render) && /\.ceiv-foto-nota/.test(render), 'pagina Statistiche: la nota sulla provenienza non si aggiorna')
assert.ok(/x\.ceivRif==='data_visita'/.test(render) && /x\.ceivRif==='stato_attuale'/.test(render), 'pagina Statistiche: le provenienze vanno contate a parte')
assert.strictEqual((html.match(/class="ceiv-foto-nota"/g) || []).length, 2, 'le due schede sulla Cassa devono dire da dove viene il dato')

const rpt = estrai('async function admGeneraReport(){', 'async function admGeneraReportOsservatorio(){')
assert.ok(/'impresa_id','imprese\(stato_cassa\)','visite_cassa_foto\(impresa_id,stato,fonte,iscritta_ceiv,riferimento\)'/.test(rpt), 'Report visite: non scarica la foto col riferimento')
assert.ok(/ceivFotoRif\(v\.visite_cassa_foto,v\.impresa_id\)==='data_visita'/.test(rpt) && /ceivFotoRif\(v\.visite_cassa_foto,v\.impresa_id\)==='stato_attuale'/.test(rpt), 'Report visite: le provenienze vanno contate a parte')
assert.strictEqual((rpt.match(/ceivStatVisita\(v\.visite_cassa_foto,v\.impresa_id,v\.imprese\)/g) || []).length, 2, 'Report visite: i due grafici sulla Cassa devono usare la foto')
assert.ok(!/ceivStat\(v\.imprese\)/.test(rpt), 'Report visite: legge ancora solo lo stato di oggi')
assert.strictEqual((rpt.match(/\('\+ceivNotaRpt\+'\)'/g) || []).length, 2, 'Report visite: i titoli devono dire da dove viene il dato')

// ── 3. Il database: la foto la scrive lui, una volta sola ──
assert.ok(/before update or delete on public\.visite_cassa_foto/.test(sql), 'manca il blocco contro riscrittura e cancellazione')
assert.ok(/after update of stato on public\.visite[\s\S]{0,120}new\.stato = 'definitivo' and old\.stato is distinct from 'definitivo'/.test(sql),
  'la foto deve scattare quando il verbale diventa definitivo')
assert.ok(/after insert on public\.visite_imprese_presenti/.test(sql), 'manca la foto per l\'impresa aggiunta a un definitivo')
assert.ok(/where c\.fonte <> 'nessuna'/.test(sql), 'prima della prima lista non si deve scrivere niente')
assert.ok(/check \(fonte in \('lista', 'manuale', 'anagrafica'\)\)/.test(sql), 'fonte: vocabolario chiuso')
assert.ok(/array\['Attiva', 'Sospesa', 'Cessata', 'Non iscritta'\]/.test(sql), 'fra più posizioni deve valere la migliore')
assert.ok(/\(r\.stato in \('Attiva', 'Sospesa'\)\)/.test(sql), 'attiva o sospesa = iscritta')
assert.ok(/'Non in lista'::text, [^\n]*false,/.test(sql), 'chi non è in lista non è C.E.I.V.')
assert.ok(!/references public\.imprese/.test(sql), 'niente chiave esterna verso imprese: confonderebbe gli embed visite↔imprese')
assert.ok(!/function public\.chiudi_verbale|function public\.verbale_mancanze/.test(sql), 'le regole di chiusura non si toccano')
for (const f of ['cassa_stato_al\\(text, date\\)', 'cassa_foto_verbale\\(text, text\\)', 'cassa_foto_recupera\\(date\\)']) {
  assert.ok(new RegExp('revoke all on function public\\.' + f + ' from public, anon, authenticated').test(sql), 'funzione aperta a tutti: ' + f)
}

// sera del 20/10/2026: lo stato attuale solo per il 2025-26, dichiarato, e anche lui non si riscrive
assert.ok(/check \(riferimento in \('data_visita', 'stato_attuale'\)\)/.test(sql2), 'riferimento: vocabolario chiuso')
assert.ok(/p_data < date '2025-10-01'/.test(sql2), 'lo stato attuale vale solo dal 2025-26')
assert.ok(/if c\.fonte <> 'nessuna' then[\s\S]{0,200}'data_visita'::text, p_data/.test(sql2), 'dove la lista alla data esiste, vale quella')
assert.ok(/'STATO ATTUALE, NON ALLA DATA DELLA VISITA/.test(sql2), 'la nota deve dire che non è alla data della visita')
assert.ok(/new\.riferimento, new\.stato_al\)[\s\S]{0,300}old\.riferimento, old\.stato_al\)/.test(sql2), 'riferimento e stato_al non si riscrivono')
assert.ok(/cross join lateral public\.cassa_stato_foto\(p\.impresa_id, v\.data_visita\)/.test(sql2), 'la foto deve passare da cassa_stato_foto')
assert.ok(/revoke all on function public\.cassa_stato_foto\(text, date\) from public, anon, authenticated/.test(sql2), 'cassa_stato_foto aperta a tutti')

console.log('ok — stato in Cassa fotografato alla data della visita: la foto vince, senza foto lo stato di oggi detto in pagina, il database la scrive una volta sola')
