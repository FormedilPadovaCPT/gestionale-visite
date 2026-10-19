// Statistiche: IPC per iscrizione alla Cassa Edile, inadempienze più frequenti, andamento dell'IPC
// mese per mese (19/10/2026, chiesti dall'utente). Pagina Statistiche e Report visite contano con
// le stesse funzioni; qui si prova il conteggio e che entrambi le usino.
// Uso: node test/statistiche-ipc-cassa-voci.test.cjs
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
const J = (x) => JSON.parse(JSON.stringify(x))

const ctx = {}
vm.createContext(ctx)
vm.runInContext(estrai('const CEIV_STAT_ORD=', '/* Comune per le statistiche')
  + estrai('function ipcPerMese(F){', 'const _IPC_SERIE=')
  + estrai('function rptVociNc(chkAll,info,limite){', 'function _dashRenderCeiv(F){')
  + '\nthis.ORD=CEIV_STAT_ORD', ctx)
const [ATT, SOS, NON] = ctx.ORD

// 1. IPC per iscrizione: percentuale alto+medio per classe, classi nell'ordine della Cassa
const F = [
  ...Array(8).fill({ ceiv: ATT, ipc: 'BASSO' }), { ceiv: ATT, ipc: 'MEDIO' }, { ceiv: ATT, ipc: 'NR' },
  { ceiv: NON, ipc: 'ALTO' }, { ceiv: NON, ipc: 'MEDIO' }, { ceiv: NON, ipc: 'BASSO' }, { ceiv: NON, ipc: 'NR' },
  { ceiv: null, ipc: 'ALTO' },
]
const pc = J(ctx.ipcPerCeiv(F))
assert.deepStrictEqual(pc.map((x) => [x.classe, x.n, x.pctAM]), [[ATT, 10, 10], [NON, 5, 60]],
  'attiva 1 su 10; senza classe = non C.E.I.V. (regola di ceivStat); la sospesa assente non compare')
assert.equal(ctx.ceivStat({ stato_cassa: 'Sospesa' }), SOS)

// 2. andamento: mesi in ordine, percentuale alto+medio sul mese
const m = J(ctx.ipcPerMese([
  { data: '2026-04-03', ipc: 'ALTO' }, { data: '2026-04-20', ipc: 'NR' }, { data: '2025-10-07', ipc: 'BASSO' },
  { data: '2026-04-21', ipc: 'MEDIO' }, { data: null, ipc: 'ALTO' },
]))
assert.deepStrictEqual(m.map((x) => [x.mese, x.n, x.pctAM]), [['2025-10', 1, 0], ['2026-04', 3, 66.7]])

// 3. voci: NC+ e NC- contano, OSS e VER no; visite distinte; ordine come dash_voci_nc
const chk = [
  { visita_id: 1, codice: 'A', valore: 'NC-' }, { visita_id: 2, codice: 'A', valore: 'NC-' }, { visita_id: 2, codice: 'A', valore: 'NC+' },
  { visita_id: 3, codice: 'B', valore: 'NC+' }, { visita_id: 4, codice: 'B', valore: 'NC+' }, { visita_id: 5, codice: 'B', valore: 'NC-' },
  { visita_id: 1, codice: 'C', valore: 'OSS' }, { visita_id: 1, codice: 'C', valore: 'VER' }, { visita_id: 6, codice: 'D', valore: 'NC-' },
]
const v = J(ctx.rptVociNc(chk, { A: { descrizione: 'Aperture verso il vuoto', zona: 2 } }, 2))
assert.deepStrictEqual(v, [
  { codice: 'B', descrizione: 'B', zona: null, ncp: 2, ncm: 1, visite: 3 },
  { codice: 'A', descrizione: 'Aperture verso il vuoto', zona: 2, ncp: 1, ncm: 2, visite: 2 },
], 'a parità di totale vince chi ha più NC+; OSS e VER fuori; il limite taglia')
assert.deepStrictEqual(J(ctx.rptVociNc(chk, {}, 10)).map((x) => x.codice), ['B', 'A', 'D'],
  'la voce con sole OSS e VER non è un’inadempienza: non compare')

// 4. la pagina li disegna e il report li stampa nella pagina 6
const giro = estrai('  _dashRenderKpi(F)\n', '  _dashLoadVer(')
for (const f of ['_dashRenderIpcMesi(F)', '_dashRenderIpcCeiv(F)', '_dashRenderVoci(fE,fT,fTy,fI)']) assert.ok(giro.includes(f), 'la pagina chiama ' + f)
for (const id of ['ch-ipcmesi', 'ch-ipcceiv', 'tbl-voci']) assert.ok(html.includes('id="' + id + '"'), 'manca la scheda ' + id)
const rep = estrai('async function admGeneraReport(){', '// ── Salva ──')
assert.ok(rep.includes("select('codice,zona_osserv,descrizione')"), 'il report legge le descrizioni delle voci')
const p6 = rep.slice(rep.indexOf('// ════ PAGINA 6'))
for (const f of ['ipcPerMese(', 'ipcPerCeiv(', 'rptVociNc(chkAll', 'footer(6)']) assert.ok(p6.includes(f), 'pagina 6: ' + f)
assert.ok(estrai('async function _dashRenderVoci(', 'function rptVociNc(').includes('Non sono riuscito a leggere'),
  'una lettura fallita delle voci si dice, non diventa «nessuna»')

console.log('OK IPC per Cassa, inadempienze più frequenti, andamento IPC')
