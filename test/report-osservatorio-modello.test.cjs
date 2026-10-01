// Report Osservatorio allineato al modello nazionale (01/10/2026), dal confronto col «Report attività»
// di Formedil Venezia 2024-25: ruolo dell'impresa dal testo, visite secondo l'esito, frequenza sulla
// storia, sottoaree del modello, verifiche potenziali nazionali, due voci che non venivano esportate.
// Uso: node test/report-osservatorio-modello.test.cjs
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
  estrai(html, 'const OX_RUOLO_NAZ=', '// ══════════ GRAFICI CANVAS', 'index.html') +
  '\nthis.ruolo=oxRuoloNaz;this.esiti=oxEsitiVisite;this.storia=oxOrdineStoria', ctx)
const { ruolo, esiti, storia } = ctx

// ── 1. ruolo: vince il testo; subappaltatrice, autonomo e fornitrice sono «esecutrice» ──
assert.strictEqual(ruolo({ ruolo: 'affidataria ed esecutrice', tipo_imp: 1 }), 2, 'il codice sbagliato delle importazioni non deve vincere sul testo')
assert.strictEqual(ruolo({ ruolo: 'Affidataria', tipo_imp: 2 }), 1)
assert.strictEqual(ruolo({ ruolo: ' esecutrice ', tipo_imp: 1 }), 3)
assert.strictEqual(ruolo({ ruolo: 'subappaltatrice', tipo_imp: 2 }), 3)
assert.strictEqual(ruolo({ ruolo: 'lavoratore autonomo', tipo_imp: null }), 3)
assert.strictEqual(ruolo({ ruolo: 'fornitrice' }), 3)
// senza testo: il codice dell'app (4-6 confluiscono in esecutrice)
assert.strictEqual(ruolo({ ruolo: null, tipo_imp: 4 }), 3)
assert.strictEqual(ruolo({ ruolo: '', tipo_imp: 2 }), 2)
assert.strictEqual(ruolo({ ruolo: null, tipo_imp: null }), 0, 'senza ruolo e senza codice = nd')
assert.strictEqual(ruolo(undefined), 0)

// ── 2. visite secondo l'esito: NC- e NC+ non si escludono ──
const V = [
  { ncp: 0, ncm: 0, oss: 0 },           // nessuna
  { ncp: 0, ncm: 0, oss: 3 },           // solo OSS
  { ncp: 0, ncm: 2, oss: 1 },           // NC-
  { ncp: 1, ncm: 0, oss: 0 },           // NC+
  { ncp: 1, ncm: 4, oss: 2 }            // NC+ e NC-: conta in tutte e due
]
assert.deepStrictEqual([...esiti(V)], [1, 1, 2, 2], 'una visita con NC+ e NC- deve stare in entrambe le colonne')
assert.strictEqual(esiti(V).reduce((s, x) => s + x, 0), 6, 'la somma supera le 5 visite, come nel modello')

// ── 3. frequenza: l'ordine si conta su tutta la storia del cantiere con quell'impresa ──
const righe = [
  { visita_id: 'a1', data_visita: '2024-03-01', cantiere_id: 'C1', impresa_id: 'I1' },
  { visita_id: 'a2', data_visita: '2025-11-05', cantiere_id: 'C1', impresa_id: 'I1' },
  { visita_id: 'a3', data_visita: '2026-02-10', cantiere_id: 'C1', impresa_id: 'I1' },
  { visita_id: 'b1', data_visita: '2025-12-01', cantiere_id: 'C1', impresa_id: 'I2' },  // stesso cantiere, altra impresa
  { visita_id: 'c1', data_visita: '2025-12-01', cantiere_id: null, impresa_id: 'I1' },  // senza cantiere: fa gruppo a sé
  { visita_id: 'd2', data_visita: '2026-01-01', cantiere_id: 'C2', impresa_id: 'I1' },
  { visita_id: 'd1', data_visita: '2026-01-01', cantiere_id: 'C2', impresa_id: 'I1' }   // stesso giorno: decide l'id
]
const o = storia(righe)
assert.strictEqual(o.a2, 1, 'la prima visita del 2025-26 e’ la SECONDA del cantiere: nel 2024 c’era gia’ stata una visita')
assert.strictEqual(o.a3, 2)
assert.strictEqual(o.a1, 0)
assert.strictEqual(o.b1, 0, 'altra impresa nello stesso cantiere: prima visita')
assert.strictEqual(o.c1, 0)
assert.deepStrictEqual([o.d1, o.d2], [0, 1])

// ── 4. sottoaree e verifiche potenziali del modello ──
const tab = {}
vm.createContext(tab)
vm.runInContext(
  estrai(dati, 'const OS_ZP=', 'const OS_MESI=', 'app-data.js') +
  estrai(dati, 'const OS_SUB={', 'const _CHK_PREF={', 'app-data.js') +
  estrai(dati, 'const _CHK_PREF={', '\n}', 'app-data.js') + '\n}\n' +
  'this.OS_SUB=OS_SUB;this.OS_ZP=OS_ZP;this.ALIAS=OS_SUB_ALIAS;this.POT=OS_POT_NAZ;this.PREF=_CHK_PREF', tab)
const chiavi = Object.keys(tab.OS_SUB)
assert.strictEqual(tab.OS_SUB.IMP_CON, 'Condizioni di contorno')
assert.strictEqual(tab.OS_SUB.PLL_PER, 'Altre aree di pericolo')
assert.strictEqual(tab.OS_SUB.PLL_OCA, 'Opere in c.a.')
assert.strictEqual(tab.OS_SUB.DOC_GEN_SOL, 'Apparecchi di sollevamento')
// l'ordine delle righe e' quello del modello
assert.ok(chiavi.indexOf('IMP_CON') === chiavi.indexOf('IMP_SEG') + 1, '«Condizioni di contorno» va dopo «Segnaletica»')
assert.deepStrictEqual(chiavi.filter(k => k.startsWith('PLL')), ['PLL_SCA', 'PLL_DEM', 'PLL_PER', 'PLL_OCA'])
assert.ok(chiavi.indexOf('DOC_GEN_SOL') === chiavi.indexOf('DOC_GEN') + 1, '«Apparecchi di sollevamento» va dopo «Generale»')
assert.strictEqual(tab.ALIAS.SOL_ASO, 'SOL_GRU', 'gli accessori di sollevamento nel modello sono voci della Gru')
assert.strictEqual(Object.values(tab.POT).reduce((s, x) => s + x, 0), 323, 'la checklist nazionale ha 323 voci')
assert.deepStrictEqual(Object.keys(tab.POT).map(Number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
assert.strictEqual(tab.PREF.PLL_OCA, 'Opere in c.a.', 'le etichette di PLL_OCA e PLL_PER erano scambiate')
assert.strictEqual(tab.PREF.PLL_PER, 'Altre aree pericolo')

// ── 5. le due voci che non arrivavano all'Osservatorio ──
const conv = JSON.parse(estrai(oss, 'const CHK2OSS=', '\n', 'osservatorio.js').replace('const CHK2OSS=', ''))
assert.strictEqual(conv.MAC_MMT_008, 116, 'Bulldozer senza conversione')
assert.strictEqual(conv.OPE_POF_009, 137, 'Elementi strutturali dei ponteggi fissi senza conversione')
for (const id of [116, 137]) assert.strictEqual(Object.values(conv).filter(x => x === id).length, 1, 'codice ' + id + ' usato da piu’ voci')
assert.ok(/'fornitrice':3/.test(estrai(oss, 'const RUOLO_MAP=', '\n', 'osservatorio.js')), 'XML: «fornitrice» deve confluire in esecutrice')

// ── 6. il report usa questi calcoli ──
const rpt = estrai(html, 'async function admGeneraReportOsservatorio(){', 'window.admGeneraReportOsservatorio', 'index.html')
assert.ok(/select\('visita_id,tipo_imp,ruolo,is_principale'\)/.test(rpt), 'il report non legge il ruolo scritto')
assert.ok(/ruoloByVis\[r\.visita_id\]=oxRuoloNaz\(r\)/.test(rpt))
assert.ok(/select\('codice,zona_osserv,is_nota,prefisso'\)/.test(rpt) && /if\(eVoci\)throw eVoci/.test(rpt), 'voci della checklist: manca il prefisso o il controllo dell’errore')
assert.ok(/const subKey=cod2sub\[codice\]\|\|/.test(rpt), 'la sottoarea si ricava ancora spezzando il codice')
assert.ok(/zonaPot=Object\.assign\(\{\},OS_POT_NAZ\)/.test(rpt), 'verifiche potenziali non nazionali')
assert.ok(/\.lte\('data_visita',al\)\.eq\('elimina',0\)/.test(rpt) && /if\(e4\)throw e4/.test(rpt), 'manca la lettura della storia')
assert.ok(/freq\[Math\.min\(ordStoria\[v\.id\]\|\|0,3\)\]\+\+/.test(rpt), 'la frequenza si conta ancora nel solo periodo')
assert.ok(/const esitiVis=oxEsitiVisite\(V\)/.test(rpt))
assert.ok(/for\(const c of \(d\.s3cats\|\|d\.cats\)\)/.test(rpt), 'schede 3: blocchi non limitati a quelli del modello')
assert.ok(/NEL PERIODO\. CONFRONTO TRA PRIMA E ULTIMA VISITA/.test(rpt))
// pagina Statistiche: stesso principio
const dash = estrai(html, '// fetch visite con cantiere + impresa principale', '// Dataset leggero su TUTTO lo storico', 'index.html')
assert.ok(/ruolo:\(p&&tipoImpDaRiga\(p\)\)\|\|null/.test(dash), 'pagina Statistiche: il ruolo si legge ancora dal solo codice')

console.log('ok — report Osservatorio: ruolo dal testo, esiti, frequenza sulla storia, sottoaree e 323 voci del modello')
