// Lettura delle risposte di VIES e InfoCamere (dati di elevato valore).
//
// File in JavaScript puro, senza tipi: lo importa la edge function (Deno)
// e lo provano i test in Node (test/dati-ufficiali.test.cjs). Niente rete
// qui dentro, solo trasformazioni di testo.

// P.IVA o codice fiscale: senza spazi, punti, «IT» davanti, in maiuscolo
export function normalizzaCodice(s) {
  let x = String(s == null ? '' : s).toUpperCase().replace(/[\s.\-\/]/g, '')
  if (/^IT\d{11}$/.test(x)) x = x.slice(2)
  return x
}

export const isPiva = s => /^\d{11}$/.test(s)
export const isCfPersona = s => /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(s)
export const isCf = s => isPiva(s) || isCfPersona(s)

// «VIA PORTO INFERIORE N 15 INT 2 \n35020 BRUGINE PD\n» -> parti separate
export function parseVies(j) {
  if (!j || typeof j !== 'object') return null
  if (j.valid !== true) return { valida: false }
  const pulito = v => {
    const t = String(v == null ? '' : v).trim()
    return t === '---' ? '' : t
  }
  const righe = pulito(j.address).split(/\n+/).map(r => r.trim()).filter(Boolean)
  const out = {
    valida: true,
    ragione_sociale: pulito(j.name).replace(/\s+/g, ' '),
    indirizzo: '', cap: '', comune: '', prov: '',
  }
  if (righe.length) {
    const ultima = righe[righe.length - 1]
    const m = ultima.match(/^(\d{5})\s+(.+?)\s+([A-Z]{2})$/)
    if (m) {
      out.cap = m[1]; out.comune = m[2]; out.prov = m[3]
      out.indirizzo = righe.slice(0, -1).join(' ')
    } else {
      out.indirizzo = righe.join(' ')
    }
  }
  return out
}

const decodifica = s => String(s == null ? '' : s)
  .replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&')

function attributi(tag) {
  const a = {}
  const re = /([\w-]+)\s*=\s*"([^"]*)"/g
  let m
  while ((m = re.exec(tag))) a[m[1]] = decodifica(m[2])
  return a
}

// Scadenza scritta dentro la chiave InfoCamere (JWT, campo exp in secondi).
// La chiave dura 6 ore: saperlo prima evita una chiamata che sarebbe respinta.
export function scadenzaToken(token) {
  try {
    const parte = String(token || '').split('.')[1]
    if (!parte) return null
    const b64 = parte.replace(/-/g, '+').replace(/_/g, '/')
    const testo = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf8')
    const exp = JSON.parse(testo).exp
    return typeof exp === 'number' ? new Date(exp * 1000) : null
  } catch (_) { return null }
}

// La chiave nella mail di InfoCamere: «Authorization Token: eyJ…» (testo del
// 03/10/2026). Si accetta solo una stringa con la forma di un JWT.
export function chiaveDaMail(testo) {
  const m = String(testo || '').match(/Authorization\s+Token:\s*([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/i)
  return m ? m[1] : ''
}

// Fra più chiavi, quella che scade più tardi (le mail arrivano tutte uguali)
export function chiavePiuNuova(chiavi) {
  let migliore = '', exp = 0
  for (const c of chiavi || []) {
    const s = scadenzaToken(c)
    if (s && s.getTime() > exp) { exp = s.getTime(); migliore = c }
  }
  return migliore
}

// <imprese><data-erogazione .../><dati-impresa ...>...</dati-impresa></imprese>
// Nessuna impresa trovata = risposta 200 con la sola data-erogazione.
export function parseInfocamere(xml) {
  const testo = String(xml || '')
  const blocchi = testo.match(/<dati-impresa\b[\s\S]*?<\/dati-impresa>/g) || []
  const erog = (testo.match(/<data-erogazione\b[^>]*>/) || [''])[0]
  const erogazione = attributi(erog).data || ''
  return {
    erogazione,
    imprese: blocchi.map(b => {
      const testa = attributi((b.match(/<dati-impresa\b[^>]*>/) || [''])[0])
      const fgTag = b.match(/<forma-giuridica\b([^>]*)>([\s\S]*?)<\/forma-giuridica>/)
      const ind = attributi((b.match(/<indirizzo\b[^>]*>/) || [''])[0])
      const agg = attributi((b.match(/<data-aggiornamento\b[^>]*>/) || [''])[0])
      const via = [ind.toponimo, ind.via].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
      const forma = fgTag ? decodifica(fgTag[2]).trim() : ''
      return {
        ragione_sociale: (testa.denominazione || '').replace(/\s+/g, ' ').trim(),
        cf: testa['c-fiscale'] || '',
        // la documentazione scrive c-statoimpresa, la risposta vera (03/10/2026) c-stato-impresa
        stato: testa['c-stato-impresa'] || testa['c-statoimpresa'] || '',
        data_registrazione: testa['dt-registrazione'] || '',
        nace: testa['c-nace'] || '',
        forma_giuridica: forma,
        forma_codice: fgTag ? (attributi(fgTag[1]).codice || '') : '',
        forma_app: formaApp(forma),
        indirizzo: [via, ind['n-civico']].filter(Boolean).join(', '),
        cap: ind.cap || '',
        comune: ind.comune || '',
        prov: ind.provincia || '',
        aggiornato_al: agg.data || '',
      }
    }),
  }
}

// La descrizione camerale -> la voce della tendina «Forma giuridica» delle app.
// Se non c'è una voce corrispondente non si propone niente: meglio vuoto che
// una forma scelta a stima.
export function formaApp(descr) {
  const d = String(descr || '').toUpperCase().replace(/[’`]/g, "'")
  if (!d) return ''
  if (/CONSORTIL|CONSORZIO/.test(d)) return 'Consorzio'
  if (/COOPERATIV/.test(d)) return 'S.coop.'
  if (/RESPONSABILITA' LIMITATA SEMPLIFICATA/.test(d)) return 'S.r.l.s'
  if (/RESPONSABILITA' LIMITATA/.test(d) && /(UNICO SOCIO|UNIPERSONALE)/.test(d)) return 'S.r.l. Unipersonale'
  if (/RESPONSABILITA' LIMITATA/.test(d)) return 'S.r.l.'
  if (/NOME COLLETTIVO/.test(d)) return 'S.n.c.'
  if (/ACCOMANDITA SEMPLICE/.test(d)) return 'S.A.S.'
  if (/PER AZIONI/.test(d) && !/ACCOMANDITA/.test(d)) return 'S.p.A.'
  return ''
}
