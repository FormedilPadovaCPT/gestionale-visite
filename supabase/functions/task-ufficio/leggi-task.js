/* ============================================================
   task-ufficio / leggi-task.js — dalle righe dei file del vault alle task
   della pagina «📋 Task» (16/11/2026, chiesto dall'utente).

   Funzioni pure, senza rete: le usa index.ts (la funzione server, che legge i
   file su Drive) e le prova test/task-ufficio.test.cjs. Le task sono le
   checkbox del plugin Tasks di Obsidian:
       - [ ] **titolo**: testo 📅 2026-11-30 ⏫ 🆔 dec175
       - [x] … ✅ 2026-11-13 — prova
   Si leggono _SISTEMA/scadenze_ufficio.md, _SISTEMA/pratiche_aperte.md e ogni
   tasks.md di 1_PROGETTI e 2_AREE (mai 4_ARCHIVIO, BK20260626, _PERSONALE).

   CHI VEDE CHE COSA (deciso con l'utente il 16/11/2026, sulla prova della
   pagina). La regola vera sta nella policy di s_task_vault (database); qui si
   calcola solo il campo vede_coordinatore, e vedeRuolo di task-ufficio.js la
   rifà per l'anteprima «Vedi come…» della segreteria:
     - segreteria: tutto;
     - Coordinatore: le task con vede_coordinatore (sezioni di SEZIONI_COORD,
       asseverazione, eventi, progetti tranne quelli di PROGETTI_SOLO_SEGRETERIA)
       e quelle legate a una questione del registro che può vedere;
     - Direttore: solo le task legate a una sua questione (🆔 decNN), non
       proposta e non ritirata come «non è materia per il Direttore» o doppione.
   #solo-segreteria nella task, o un documento _accesso-riservato citato, la
   tiene della sola segreteria.
   ============================================================ */

export const GIORNI_FATTE = 60
export const SEZIONI_COORD = ['Rapporti con enti', 'Formazione', 'Asseverazioni', 'Attestazione patente a crediti', 'Eventi', 'Sopralluoghi e servizi']
export const PROGETTI_SOLO_SEGRETERIA = ['Revisione-sito-web-Tagliani']
const PRIO = [['🔺', 'altissima'], ['⏫', 'alta'], ['🔼', 'media'], ['🔽', 'bassa']]
const RE_TASK = /^(\s*)- \[([ xX-])\] (.*)$/

export function fileAmmesso(p) {
  if (p === '_SISTEMA/scadenze_ufficio.md' || p === '_SISTEMA/pratiche_aperte.md') return true
  if (!/\/tasks\.md$/.test(p)) return false
  if (!/^(1_PROGETTI|2_AREE)\//.test(p)) return false
  return !/(^|\/)(4_ARCHIVIO|BK20260626|_PERSONALE)(\/|$)/.test(p)
}

/* testo leggibile: via i segni del plugin Tasks e i wikilink, restano **grassetto** e `codice` */
export function pulisci(t) {
  return String(t || '')
    .replace(/\[\[([^\]|]+)\\?\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, (_m, a) => a.split('/').pop())
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1')
    .replace(/(📅|✅|⏳|🛫|➕)\s*\d{4}-\d{2}-\d{2}/gu, '')
    .replace(/(🆔|⛔)\s*dec\d+/gu, '')
    .replace(/🔁[^📅✅⏫🔺🔼🔽]*/gu, '')
    .replace(/[🔺⏫🔼🔽]/gu, '')
    .replace(/#proposta-direttore|#solo-segreteria/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function titoloDi(testo) {
  const m = /^\s*\*\*(.+?)\*\*/.exec(testo)
  if (m) return m[1].trim().replace(/:$/, '').trim()
  let t = String(testo).split(/ — | - \*/)[0].trim()
  if (t.length > 110) t = t.slice(0, 110).replace(/\s+\S*$/, '') + '…'
  return t
}

const nomeCartella = (c) => String(c).replace(/^\d{4}(_\d{2}){0,2}_/, '').replace(/[-_]/g, ' ').trim()
const maiuscola = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase())

/* gruppo, ambito e visibilità di base per il Coordinatore (null = la decide la sezione) */
export function contesto(p) {
  const q = p.split('/')
  if (p.startsWith('_SISTEMA/')) return { gruppo: 'ufficio', ambito: 'Ufficio', vede: null }
  if (p.startsWith('2_AREE/Asseverazione/imprese/') && q.length > 4) {
    const m = /^\d+_(.+?)_(\d{11}|PIVA-DA-RILEVARE)$/.exec(q[3])
    return { gruppo: 'asseverazione', ambito: 'Asseverazione · ' + maiuscola((m ? m[1] : q[3]).replace(/-/g, ' ')), vede: true }
  }
  if (p.startsWith('2_AREE/Eventi_Campagne/') && q.length > 3) return { gruppo: 'eventi', ambito: 'Eventi · ' + nomeCartella(q[2]), vede: true }
  if (p.startsWith('1_PROGETTI/')) {
    const cart = q[1] === 'Progetti_finanziati' && q.length > 3 ? q[2] : q[1]
    return { gruppo: 'progetto', ambito: 'Progetto · ' + nomeCartella(cart), vede: !PROGETTI_SOLO_SEGRETERIA.some((x) => cart.includes(x)) }
  }
  return { gruppo: 'altro', ambito: q.length > 1 ? nomeCartella(q[q.length - 2]) : p, vede: false }
}

function giorniFra(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000) }

/* le task di un file. oggi = 'aaaa-mm-gg' (le fatte più vecchie di GIORNI_FATTE non si portano) */
export function leggiFile(percorso, testo, oggi) {
  const { gruppo, ambito: ambitoBase, vede: vedeBase } = contesto(percorso)
  const righe = []
  let sezione = '', corrente = null
  String(testo || '').split(/\r?\n/).forEach((ln, i) => {
    const h = /^## (.+)/.exec(ln)
    if (h) { sezione = h[1].replace(/\s*\*\(.*?\)\*\s*$/, '').trim(); corrente = null; return }
    const m = RE_TASK.exec(ln)
    if (m) {
      corrente = null
      const segno = m[2], testoTask = m[3]
      if (segno === '-') return
      const stato = /[xX]/.test(segno) ? 'fatta' : 'aperta'
      const fatte = [...testoTask.matchAll(/✅\s*(\d{4}-\d{2}-\d{2})/gu)].map((x) => x[1])
      const fattaIl = fatte.length ? fatte[fatte.length - 1] : null
      if (stato === 'fatta' && (!fattaIl || giorniFra(fattaIl, oggi) > GIORNI_FATTE)) return
      const scad = /📅\s*(\d{4}-\d{2}-\d{2})/u.exec(testoTask)
      const dec = /🆔\s*dec(\d+)/u.exec(testoTask)
      const prio = (PRIO.find(([s]) => testoTask.includes(s)) || [])[1] || null
      let ambito = ambitoBase, vede = !!vedeBase
      if (gruppo === 'ufficio') { ambito = sezione ? 'Ufficio · ' + sezione : 'Ufficio'; vede = SEZIONI_COORD.some((s) => sezione.startsWith(s)) }
      if (/#solo-segreteria|_accesso-riservato/.test(testoTask)) vede = false
      const titolo = pulisci(titoloDi(testoTask)) || '(senza titolo)'
      const mg = /^\s*\*\*(.+?)\*\*\s*[:.]?\s*/.exec(testoTask)
      const resto = mg ? testoTask.slice(mg[0].length) : testoTask
      corrente = {
        file: percorso, riga: i + 1, gruppo, ambito, titolo: titolo.slice(0, 300), dettaglio: pulisci(resto).slice(0, 4000),
        stato, scadenza: scad ? scad[1] : null, fatta_il: fattaIl, priorita: prio, dec_id: dec ? Number(dec[1]) : null, vede_coordinatore: vede,
      }
      righe.push(corrente)
      return
    }
    // le righe rientrate subito sotto una task (note datate, seguiti scritti come elenco) sono il suo dettaglio
    if (corrente && /^\s+[-*] /.test(ln)) corrente.dettaglio = (corrente.dettaglio + ' ¶ ' + pulisci(ln.trim().slice(2))).slice(0, 4000)
    else if (ln.trim() && !/^\s/.test(ln)) corrente = null
  })
  return righe
}

/* la base della chiave (stabile finché file e titolo non cambiano) e il testo su cui si calcola l'impronta */
export function conChiavi(righe) {
  const viste = {}
  return righe.map((r) => {
    const k = r.file + '|' + r.titolo
    viste[k] = (viste[k] || 0) + 1
    const corpo = JSON.stringify(Object.keys(r).sort().reduce((o, x) => { o[x] = r[x]; return o }, {}))
    return { r, baseChiave: k + '|' + viste[k], corpo }
  })
}
