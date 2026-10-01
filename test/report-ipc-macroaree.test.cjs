// Report visite, pagina 5: IPC per macro area (01/10/2026), come i grafici «Macroaree di valutazione»
// del foglio Google. Per ogni visita e area: NC+ >= 1 o NC- > 3 = alto; NC- da 1 a 3 o OSS > 6 = medio;
// OSS da 1 a 6 = basso; solo voci conformi = nessun rilievo; area non valutata = fuori dal grafico.
// Uso: node test/report-ipc-macroaree.test.cjs
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

const ctx = {}
vm.createContext(ctx)
vm.runInContext(estrai('function rptIpcLivello(d){', '// jsPDF page header') + '\nthis.liv=rptIpcLivello;this.macro=rptIpcMacro', ctx)
const { liv, macro } = ctx
const d = (ncp, ncm, oss, ver) => ({ ncp, ncm, oss, ver })

// ── 1. la scala, soglia per soglia ──
assert.strictEqual(liv(d(1, 0, 0, 0)), 'ALTO', 'una NC+ = alto')
assert.strictEqual(liv(d(0, 4, 0, 9)), 'ALTO', 'piu’ di 3 NC- = alto')
assert.strictEqual(liv(d(0, 3, 0, 9)), 'MEDIO', '3 NC- = medio, non alto')
assert.strictEqual(liv(d(0, 1, 0, 0)), 'MEDIO', 'una NC- = medio')
assert.strictEqual(liv(d(0, 0, 7, 0)), 'MEDIO', 'piu’ di 6 osservazioni = medio')
assert.strictEqual(liv(d(0, 0, 6, 0)), 'BASSO', '6 osservazioni = basso, non medio')
assert.strictEqual(liv(d(0, 0, 1, 20)), 'BASSO', 'una osservazione = basso')
assert.strictEqual(liv(d(0, 0, 0, 5)), 'NR', 'solo voci conformi = nessun rilievo')
assert.strictEqual(liv(d(0, 0, 0, 0)), null, 'area non valutata: fuori dal grafico')

// ── 2. il conteggio e’ per VISITA e per AREA, non per voce ──
const zone = { IMP: 1, OPE: 6, DPI: 7 }
const righe = [
  // visita A: area 1 con 2 osservazioni (basso), area 6 con una NC+ (alto)
  { visita_id: 'A', codice: 'IMP_LOG_001', valore: 'OSS' },
  { visita_id: 'A', codice: 'IMP_LOG_002', valore: 'OSS' },
  { visita_id: 'A', codice: 'IMP_LOG_003', valore: 'VER' },
  { visita_id: 'A', codice: 'OPE_POF_022', valore: 'NC+' },
  // visita B: area 1 tutta conforme, area 6 con una NC- (medio)
  { visita_id: 'B', codice: 'IMP_LOG_001', valore: 'VER' },
  { visita_id: 'B', codice: 'OPE_POF_001', valore: 'NC-' },
  // visita C: nell’area 7 solo una nota di testo: non e’ una valutazione
  { visita_id: 'C', codice: 'DPI_NOT_001', valore: 'caschi da sostituire' },
  // codice di un’area sconosciuta e riga senza visita: ignorati
  { visita_id: 'C', codice: 'XYZ_001', valore: 'NC+' },
  { visita_id: null, codice: 'IMP_LOG_001', valore: 'NC+' }
]
const r = macro(righe, zone)
assert.deepStrictEqual(Object.keys(r).length, 10, 'tutte e dieci le aree, anche a zero')
assert.deepStrictEqual({ ...r[1] }, { ALTO: 0, MEDIO: 0, BASSO: 1, NR: 1 }, 'area 1: una visita bassa e una senza rilievi')
assert.deepStrictEqual({ ...r[6] }, { ALTO: 1, MEDIO: 1, BASSO: 0, NR: 0 }, 'area 6: una visita alta e una media')
assert.deepStrictEqual({ ...r[7] }, { ALTO: 0, MEDIO: 0, BASSO: 0, NR: 0 }, 'area 7: la sola nota non conta')
// due osservazioni nella stessa area e visita sono UNA visita, non due
assert.strictEqual(r[1].BASSO, 1)

// ── 3. il report legge la visita insieme alla voce e disegna la pagina ──
const rpt = estrai('async function admGeneraReport(){', 'window.admGeneraReport')
assert.ok(/\.select\('visita_id,codice,valore'\)/.test(rpt), 'la lettura delle check-list non porta la visita: le torte sarebbero vuote')
assert.ok(/const ipcMacro=rptIpcMacro\(chkAll,prefToZone\)/.test(rpt), 'manca il conteggio per macro area')
assert.ok(/for\(let z=1;z<=10;z\+\+\)\{\s*const d=ipcMacro\[z\]/.test(rpt), 'manca la torta di ogni area')
assert.ok(/footer\(5\)/.test(rpt), 'manca il pie’ della pagina 5')

console.log('ok — report visite: IPC per macro area (scala, conteggio per visita e area, pagina 5)')
