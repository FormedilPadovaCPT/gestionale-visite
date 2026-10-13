// Testo del promemoria «verbali da inviare» (13/10/2026). Modulo puro, senza
// rete: lo usa la funzione promemoria-invii e lo provano i test del repo
// (test/promemoria-invii.test.cjs). Tutto si legge dalle righe del database:
// nessun testo scritto da una persona entra nella mail (eccezione 9).

export const PREFISSO = 'FORMEDIL Padova -AREA SICUREZZA E SALUTE-'
export const LINK = 'https://formedilpadovacpt.github.io/gestionale-visite/?vista=lista&dainviare=1'

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const dataIt = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : '–' }

/* le righe di promemoria_invii_elenco, raggruppate per tecnico */
export function raggruppa(righe) {
  const m = new Map()
  for (const r of righe || []) {
    const k = String(r.tecnico_email || '').toLowerCase()
    if (!k) continue
    if (!m.has(k)) m.set(k, { email: k, nome: r.tecnico_nome || '', definitivi: [], bozze: [] })
    m.get(k)[r.stato === 'bozza' ? 'bozze' : 'definitivi'].push(r)
  }
  return [...m.values()]
}

const conta = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`

export function oggetto(g) {
  const p = []
  if (g.definitivi.length) p.push(conta(g.definitivi.length, 'verbale da inviare', 'verbali da inviare'))
  if (g.bozze.length) p.push(conta(g.bozze.length, 'verbale ancora in bozza', 'verbali ancora in bozza'))
  return `${PREFISSO} Promemoria: ${p.join(' e ')}`
}

function tabella(righe) {
  const th = 'style="text-align:left;padding:5px 8px;border-bottom:2px solid #e7500f;font-size:12px;color:#565c66"'
  const td = 'style="padding:5px 8px;border-bottom:1px solid #eee;font-size:13px;vertical-align:top"'
  return `<table style="border-collapse:collapse;width:100%;max-width:720px"><tr><th ${th}>Verbale</th><th ${th}>Data visita</th><th ${th}>Cantiere</th><th ${th}>Impresa</th><th ${th}>Fermo da</th></tr>`
    + righe.map((r) => `<tr><td ${td}>${esc(r.nr_verbale || '(senza numero)')}</td><td ${td}>${dataIt(r.data_visita)}</td><td ${td}>${esc(r.cantiere || '')}${r.comune ? ' – ' + esc(r.comune) : ''}</td><td ${td}>${esc(r.impresa || '–')}</td><td ${td}>${esc(conta(r.giorni || 0, 'giorno', 'giorni'))}</td></tr>`).join('')
    + '</table>'
}

export function html(g) {
  const nome = String(g.nome || '').trim().split(/\s+/)[0] || ''
  let h = `<div style="font-family:Arial,Helvetica,sans-serif;color:#222;font-size:14px;line-height:1.5">`
  h += `<p>Buongiorno${nome ? ' ' + esc(nome) : ''},</p>`
  h += `<p>nel gestionale visite ci sono tue visite ferme da almeno un giorno lavorativo.</p>`
  if (g.definitivi.length) {
    h += `<p style="margin:16px 0 6px"><b>Verbali chiusi e non ancora inviati all'impresa (${g.definitivi.length})</b></p>` + tabella(g.definitivi)
    h += `<p style="font-size:13px;color:#555">Se all'impresa manca l'indirizzo mail, va cercato (visura, sito, telefono al cantiere) e scritto nella sua scheda: il verbale si manda sempre per mail.</p>`
  }
  if (g.bozze.length) {
    h += `<p style="margin:16px 0 6px"><b>Verbali ancora in bozza (${g.bozze.length})</b></p>` + tabella(g.bozze)
    h += `<p style="font-size:13px;color:#555">Vanno completati e chiusi, poi inviati all'impresa.</p>`
  }
  h += `<p style="margin-top:18px"><a href="${LINK}" style="background:#e7500f;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;font-weight:bold">Apri le visite da inviare</a></p>`
  h += `<p style="font-size:12px;color:#888;margin-top:22px">Questo promemoria parte da solo ogni mattina feriale finché ci sono visite ferme, e lo ricevi solo tu. Non serve rispondere.<br>Gestionale Visite – Formedil Padova, Area Sicurezza e Salute</p>`
  return h + '</div>'
}
