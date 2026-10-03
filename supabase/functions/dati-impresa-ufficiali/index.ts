// Supabase Edge Function – dati-impresa-ufficiali (03/10/2026, chiesta dall'utente)
//
// Data una P.IVA o un codice fiscale, restituisce i dati dell'impresa da due
// fonti pubbliche e gratuite, perché il tecnico li riporti nella scheda
// invece di scrivere a mano ragioni sociali e indirizzi:
//
//  · InfoCamere, portale dei «dati di elevato valore» (Reg. UE 2023/138,
//    licenza CC BY 4.0): ragione sociale, forma giuridica, CF, stato
//    attività, sede legale, codice NACE. Copre SOLO le società (di capitali,
//    di persone, cooperative e consortili): le ditte individuali non ci sono.
//    Risponde dal lunedì al venerdì, 8-18. Il token sta in
//    s_config.infocamere_hvd_token. La chiave dura SEI ORE (campo exp del
//    JWT, verificato il 03/10/2026): scaduta, non la si manda nemmeno.
//  · VIES della Commissione europea: P.IVA valida sì/no, ragione sociale e
//    indirizzo. Sempre acceso, anche la sera e nel fine settimana, e copre
//    anche le ditte individuali.
//
// Non scrive niente nella scheda: propone, e il tecnico sceglie. Ogni
// richiesta lascia una riga in imprese_dati_ufficiali_log, così la segreteria
// vede se un canale ha smesso di rispondere (token scaduto, servizio giù).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { normalizzaCodice, isPiva, isCf, parseVies, parseInfocamere, scadenzaToken } from './parse.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const VIES_URL = 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number'
const IC_URL = 'https://api-hvdataset.os.infocamere.it/ricercaImpresePuntuale'
const ATTESA_MS = 9000

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

async function conAttesa(url: string, init: RequestInit) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ATTESA_MS)
  try { return await fetch(url, { ...init, signal: ctl.signal }) } finally { clearTimeout(t) }
}

type Esito = { esito: string; messaggio?: string; dati?: unknown; chiave?: string }

async function vies(piva: string): Promise<Esito> {
  if (!piva) return { esito: 'non_interrogato', messaggio: 'serve una partita IVA di 11 cifre' }
  try {
    const r = await conAttesa(VIES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ countryCode: 'IT', vatNumber: piva }),
    })
    const j = await r.json().catch(() => null)
    if (!r.ok || !j) return { esito: 'errore', messaggio: `VIES ha risposto ${r.status}`, chiave: piva }
    if (j.actionSucceed === false || j.errorWrappers) {
      return { esito: 'errore', messaggio: 'VIES momentaneamente non disponibile', chiave: piva }
    }
    const d = parseVies(j)
    if (!d || !d.valida) return { esito: 'non_valida', messaggio: 'partita IVA non attiva o inesistente per l\'Agenzia delle Entrate', chiave: piva }
    return { esito: 'ok', dati: d, chiave: piva }
  } catch (e) {
    return { esito: 'errore', messaggio: (e as Error).name === 'AbortError' ? 'VIES non ha risposto in tempo' : 'VIES non raggiungibile', chiave: piva }
  }
}

async function infocamere(cf: string, token: string): Promise<Esito> {
  if (!cf) return { esito: 'non_interrogato', messaggio: 'serve un codice fiscale o una partita IVA' }
  if (!token) return { esito: 'non_configurato', messaggio: 'chiave InfoCamere non ancora impostata dalla segreteria', chiave: cf }
  const scade = scadenzaToken(token)
  if (scade && scade.getTime() < Date.now() + 60_000) {
    return { esito: 'token_scaduto', messaggio: 'chiave InfoCamere scaduta: avvisa la segreteria', chiave: cf }
  }
  try {
    const r = await conAttesa(`${IC_URL}?cf=${encodeURIComponent(cf)}`, {
      headers: { 'Id-Token': token, Accept: 'application/xml' },
    })
    const testo = await r.text()
    if (r.status === 401) return { esito: 'token_scaduto', messaggio: 'chiave InfoCamere scaduta o non valida: avvisa la segreteria', chiave: cf }
    if (r.status === 429) return { esito: 'errore', messaggio: 'InfoCamere è sovraccarico, riprova fra poco', chiave: cf }
    if (r.status === 400) return { esito: 'errore', messaggio: 'InfoCamere non accetta questo codice fiscale', chiave: cf }
    if (!r.ok) return { esito: 'errore', messaggio: `InfoCamere non disponibile (risponde lun-ven 8-18)`, chiave: cf }
    const p = parseInfocamere(testo)
    if (!p.imprese.length) return { esito: 'non_trovata', messaggio: 'non è nell\'elenco InfoCamere (le ditte individuali non ci sono)', chiave: cf }
    return { esito: 'ok', dati: { ...p.imprese[0], erogazione: p.erogazione }, chiave: cf }
  } catch (e) {
    return { esito: 'errore', messaggio: (e as Error).name === 'AbortError' ? 'InfoCamere non ha risposto in tempo (risponde lun-ven 8-18)' : 'InfoCamere non raggiungibile (risponde lun-ven 8-18)', chiave: cf }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'metodo non ammesso' }, 405)

  // solo chi ha fatto l'accesso: la chiave anon da sola non basta
  const auth = req.headers.get('Authorization') || ''
  const utente = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } })
  const { data: u } = await utente.auth.getUser()
  if (!u?.user) return json({ error: 'accesso richiesto' }, 401)

  const body = await req.json().catch(() => ({}))
  const piva = normalizzaCodice(body.piva)
  const cf = normalizzaCodice(body.cf)
  if (!isCf(piva) && !isCf(cf)) {
    return json({ error: 'Scrivi una partita IVA di 11 cifre o un codice fiscale di 16 caratteri.' }, 400)
  }

  // VIES vuole una P.IVA; InfoCamere un codice fiscale (per le società spesso
  // coincide con la P.IVA, per questo in mancanza del CF si prova con quella)
  const pivaVies = isPiva(piva) ? piva : (isPiva(cf) ? cf : '')
  const cfIc = isCf(cf) ? cf : (isPiva(piva) ? piva : '')

  const db = createClient(SUPABASE_URL, SERVICE_KEY)
  const { data: t } = await db.from('s_config').select('valore').eq('chiave', 'infocamere_hvd_token').maybeSingle()
  const token = String(t?.valore || '').trim()

  const [rv, ri] = await Promise.all([vies(pivaVies), infocamere(cfIc, token)])

  await db.from('imprese_dati_ufficiali_log').insert({
    utente_email: u.user.email ?? null,
    piva: piva || null,
    cf: cf || null,
    esito_vies: rv.esito,
    esito_infocamere: ri.esito,
    messaggio: [rv.esito !== 'ok' ? rv.messaggio : '', ri.esito !== 'ok' ? ri.messaggio : ''].filter(Boolean).join(' · ') || null,
  }).then(({ error }) => { if (error) console.warn('log dati ufficiali:', error.message) })

  return json({ vies: rv, infocamere: ri, interrogato_il: new Date().toISOString() })
})
