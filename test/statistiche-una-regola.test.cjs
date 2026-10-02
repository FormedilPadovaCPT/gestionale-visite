// Statistiche: una regola sola per pagina «Statistiche», Report visite e report Osservatorio (01/10/2026).
// Il 01/10/2026 i tre punti davano numeri diversi sulla stessa base dati: la pagina e l'Osservatorio
// leggevano intervento, opera e importo dal cantiere, il Report visite dalla visita; la Cassa Edile si
// contava dal campo cassa_edile, che vale «C.E.I.V.» anche per chi la lista dà come non iscritto.
// Uso: node test/statistiche-una-regola.test.cjs
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const assert = require('assert')

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')

function estrai(inizio, fine) {
  const a = html.indexOf(inizio)
  assert.ok(a >= 0, 'non trovo in index.html: ' + inizio)
  const b = html.indexOf(fine, a)
  assert.ok(b > a, 'non trovo la fine di: ' + inizio)
  return html.slice(a, b)
}

// ── 1. Chi è C.E.I.V. lo dice la lista della Cassa: attiva o sospesa = iscritta, il resto no ──
const ctx = {}
vm.createContext(ctx)
vm.runInContext(estrai('const CEIV_STAT_ORD=', 'function _ceivDash(') + '\nthis.ceivStat=ceivStat;this.comuneStat=comuneStat;this.ORD=CEIV_STAT_ORD', ctx)
const { ceivStat, comuneStat, ORD } = ctx
assert.strictEqual(ORD.length, 3)
assert.strictEqual(ceivStat({ stato_cassa: 'Attiva' }), ORD[0])
assert.strictEqual(ceivStat({ stato_cassa: 'Sospesa' }), ORD[1])
for (const st of ['Cessata', 'Non iscritta', '', null, undefined]) {
  assert.strictEqual(ceivStat({ stato_cassa: st }), ORD[2], 'stato «' + st + '» deve essere Non C.E.I.V.')
}
assert.strictEqual(ceivStat(null), ORD[2], 'impresa non in anagrafica = non C.E.I.V.')
// la cassa indicata dal tecnico (cassa_edile) non conta
assert.strictEqual(ceivStat({ cassa_edile: 'C.E.I.V.', stato_cassa: 'Non iscritta' }), ORD[2])
assert.ok(ORD[0].startsWith('C.E.I.V.') && ORD[1].startsWith('C.E.I.V.') && ORD[2].startsWith('Non'))

// ── 2. Comuni: maiuscole unificate, quartiere di Padova tolto ──
assert.strictEqual(comuneStat('Padova'), 'PADOVA')
assert.strictEqual(comuneStat('PADOVA - Q1 (Centro storico)'), 'PADOVA')
assert.strictEqual(comuneStat('PADOVA - Q5 SUD OVEST (Armistizio – Savonarola)'), 'PADOVA')
assert.strictEqual(comuneStat(' Rubano '), 'RUBANO')
assert.strictEqual(comuneStat(null), '')

// ── 3. I tre punti leggono intervento, opera e importo con la stessa funzione ──
// (dal pomeriggio del 01/10/2026 la regola sola e' la scheda del cantiere, come nel modello nazionale:
//  il dettaglio e' in test/dati-del-cantiere.test.cjs; i dati dichiarati nella visita si scaricano ancora
//  perche' servono alla stampa col vecchio parametro)
const dash = estrai('// fetch visite con cantiere + impresa principale', '// Dataset leggero su TUTTO lo storico')
assert.ok(/vis_tip_int,vis_tip_ope,vis_importo/.test(dash), 'pagina Statistiche: mancano i dati dichiarati nella visita')
assert.ok(/const dc=datiCantiereStat\(r,r\.cantieri\)/.test(dash), 'pagina Statistiche: non passa da datiCantiereStat')
assert.ok(/comune:comuneStat\(/.test(dash), 'pagina Statistiche: comuni non unificati')
assert.ok(/ceiv:ceivStat\(/.test(dash), 'pagina Statistiche: Cassa Edile non letta dalla lista')

const rpt = estrai('async function admGeneraReport(){', 'async function admGeneraReportOsservatorio(){')
assert.ok(/'imprese\(stato_cassa\)'/.test(rpt), 'Report visite: non legge lo stato in lista')
assert.ok(!/imprese\(cassa_edile\)/.test(rpt), 'Report visite: conta ancora dal campo cassa_edile')
assert.ok(/ceivStat\(v\.imprese\)/.test(rpt), 'Report visite: Cassa Edile non per visita')
assert.ok(/comuneStat\(v\.cantieri\?\.comune_nome\)/.test(rpt), 'Report visite: comuni non unificati')
assert.ok(/\[0,0,'nessuna'\],\[1,1,'1'\]/.test(rpt), 'Report visite: manca la classe «nessuna impresa»')
// le letture a lotti guardano error: un lotto non letto non deve dare un totale più basso in silenzio
assert.ok(/error:eChk/.test(rpt) && /if\(eChk\)throw/.test(rpt), 'Report visite: la lettura delle check-list non guarda error')
assert.ok(/error:eVoci/.test(rpt) && /if\(eVoci\)throw/.test(rpt), 'Report visite: la lettura delle voci non guarda error')

assert.ok(/datiCantiereStat\(v,v\.cantieri,vecchio\)/.test(rpt), 'Report visite: non passa da datiCantiereStat')
const oss = estrai('function oxCatOf(v,c,ruolo,vecchio){', '// ══════════ GRAFICI CANVAS')
assert.ok(/const dc=datiCantiereStat\(v,v\.cantieri,vecchio\)/.test(oss), 'Osservatorio: non passa da datiCantiereStat')
assert.ok(/osImportoClass\(dc\.importo\)/.test(oss), 'Osservatorio: importo non dalla funzione comune')
const ossSel = estrai('async function admGeneraReportOsservatorio(){', "].join(',')).gte('data_visita',dal)")
assert.ok(/'vis_tip_int','vis_tip_ope','vis_importo'/.test(ossSel), 'Osservatorio: non scarica i dati dichiarati nella visita')

// ── 4. Maschera: risalvare un definitivo non riscrive ciò che nessuno ha toccato ──
const save = estrai('async function saveVisita(stato){', 'function buildSnap(')
assert.ok(/if\(eById\)throw eById/.test(save), 'salvataggio: la lettura della visita non guarda error')
assert.ok(/byId\.stato==='definitivo'/.test(save) && /stato='definitivo';vistaRow\.stato='definitivo'/.test(save), 'salvataggio: un definitivo può tornare bozza')
assert.ok(/delete vistaRow\.nr_imp/.test(save) && /delete vistaRow\.nr_lavoratori/.test(save), 'salvataggio: i totali dichiarati vengono riscritti')
const acc = estrai('async function autoAccCant(cantId){', '// ── MODAL NUOVO COMMITTENTE')
assert.ok(/gia\.stato==='definitivo'&&gia\.acc_cant/.test(acc), 'numero di accesso: un definitivo viene ricalcolato')
assert.ok(/\.lte\('data_visita',dataV\)/.test(acc), 'numero di accesso: conta anche le visite successive')

// ── 5. L'esercizio corrente sta nel menu anche quando è ancora vuoto (02/10/2026) ──
// Il 1° ottobre l'esercizio nuovo non aveva visite: la pagina si apriva su «Tutto lo storico»
// con il solo esercizio corrente caricato, e mostrava 0 sopralluoghi accanto a 145.997 verifiche.
const mEs = html.match(/function eserciziPerMenu\(righe,cur\)\{[\s\S]*?\r?\n\}/)
assert.ok(mEs, 'eserciziPerMenu non trovata')
const eserciziPerMenu = Function(mEs[0] + '; return eserciziPerMenu')()
assert.deepStrictEqual(eserciziPerMenu([{ eserc: '2024/2025' }, { eserc: '2025/2026' }, { eserc: null }], '2026/2027'),
  ['2024/2025', '2025/2026', '2026/2027'], 'l’esercizio corrente vuoto deve stare nel menu')
assert.deepStrictEqual(eserciziPerMenu([{ eserc: '2025/2026' }], '2025/2026'), ['2025/2026'], 'niente doppioni')
assert.deepStrictEqual(eserciziPerMenu(null, '2026/2027'), ['2026/2027'])
const fill = estrai('function _dashFillSelectors(){', 'function applyDashFilters(){')
assert.ok(/const es=eserciziPerMenu\(_dashLite\|\|_dashRaw,cur\)/.test(fill), 'il menu degli esercizi deve passare da eserciziPerMenu')
const filtri = estrai('function applyDashFilters(){', 'function _grp(')
assert.ok(/if\(!fE&&!_dashScopeAll\)\{[\s\S]{0,300}loadStat\(\)[\s\S]{0,200}return/.test(filtri),
  '«Tutto lo storico» senza lo storico caricato non si disegna: prima si carica')

console.log('ok — statistiche: una regola sola (C.E.I.V. dalla lista, dati del cantiere dalla funzione comune, comuni unificati) e maschera protetta')
