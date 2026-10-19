// Report visite: il grafico «IPC per n° accesso al cantiere» della pagina Statistiche anche nel PDF
// (19/10/2026, chiesto dall'utente). Il conteggio deve dare gli stessi numeri del grafico della pagina
// (_dashRenderAccesso), e la query del report deve leggere il numero di accesso.
// Uso: node test/report-ipc-accesso.test.cjs
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const assert = require('assert')

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
function estrai(inizio, fine) {
  const a = html.indexOf(inizio)
  assert.ok(a >= 0, 'non trovo: ' + inizio)
  const b = html.indexOf(fine, a)
  assert.ok(b > a, 'non trovo la fine di: ' + inizio)
  return html.slice(a, b)
}

const ctx = { grafici: [] }
vm.createContext(ctx)
vm.runInContext(estrai('function rptIpcPerAccesso(visite){', 'function rptIpcLivello(d){')
  + estrai('function _dashRenderAccesso(F){', '\n}\n') + '\n}\n'
  + 'const _DASH_C={nr:1,basso:2,medio:3,alto:4};const stackTotalPlugin={};'
  + 'function _mkChart(id,cfg){grafici.push(cfg)}', ctx)

const visite = [
  { acc_cant: 1, ipc: 'ALTO' }, { acc_cant: 1, ipc: 'NR' }, { acc_cant: 1, ipc: 'BASSO' },
  { acc_cant: 2, ipc: 'MEDIO' }, { acc_cant: 2, ipc: 'NR' },
  { acc_cant: 3, ipc: 'BASSO' }, { acc_cant: 6, ipc: 'ALTO' }, { acc_cant: 5, ipc: 'NR' },
  { acc_cant: null, ipc: 'MEDIO' }, { acc_cant: 0, ipc: 'BASSO' },
]
const r = ctx.rptIpcPerAccesso(visite)
assert.deepStrictEqual(JSON.parse(JSON.stringify(r)), [
  { label: '1°', segs: [1, 1, 0, 1] },
  { label: '2°', segs: [1, 0, 1, 0] },
  { label: '3°', segs: [0, 1, 0, 0] },
  { label: '5°+', segs: [1, 0, 0, 1] },
  { label: 'Non ind.', segs: [0, 1, 1, 0] },
], 'classi e conteggi: [Nessun Rilievo, Basso, Medio, Alto]; 4° assente non compare')

// stessi numeri del grafico della pagina Statistiche (che riceve acc e ipc già normalizzati)
ctx._dashRenderAccesso(visite.map((v) => ({ acc: +v.acc_cant || 0, ipc: v.ipc })))
const pagina = JSON.parse(JSON.stringify(ctx.grafici[0].data))
const rr = JSON.parse(JSON.stringify(r))
assert.deepStrictEqual(pagina.labels, rr.map((x) => x.label), 'stesse colonne della pagina')
pagina.datasets.forEach((ds, i) => assert.deepStrictEqual(ds.data, rr.map((x) => x.segs[i]), 'stessa serie ' + ds.label))

// la query del report legge il numero di accesso, e la pagina 3 disegna il grafico
const query = estrai('async function admGeneraReport(){', '.gte(')
assert.ok(query.includes("'acc_cant'"), 'la query del report deve leggere acc_cant')
assert.ok(estrai('// ════ PAGINA 3', '// ════ PAGINA 4').includes("rptStackedCols({cols:accIpc,title:'IPC per n° accesso al cantiere'"),
  'il grafico sta nella pagina 3 del report')

console.log('OK IPC per n° accesso al cantiere nel report')
