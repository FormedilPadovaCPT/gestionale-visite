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
//    Garantito dal lunedì al venerdì, 8-18 (il sabato sera ha risposto lo stesso).
//  · VIES della Commissione europea: P.IVA valida sì/no, ragione sociale e
//    indirizzo. Sempre acceso, anche la sera e nel fine settimana, e copre
//    anche le ditte individuali.
//
// LA CHIAVE INFOCAMERE DURA SEI ORE (lo dice la mail, e il campo exp del JWT).
// Si rinnova da sola, come ha deciso l'utente il 03/10/2026:
//  · una richiesta GET a /accettazioneLicenza con l'indirizzo dell'ente
//    (s_config.infocamere_hvd_email) fa partire una mail con la chiave nuova:
//    la chiave NON torna nella risposta (jwtToken: null), solo per posta;
//  · la si legge dalla casella cptpd@ col service account dell'ente, scope
//    gmail.readonly (la stessa delega di mail-respinte e bacheca-giornata),
//    e si salva in s_config.infocamere_hvd_token;
//  · lo fa il giro pg_cron «infocamere-chiave-giro» nei giorni feriali
//    (header X-Infocamere-Rinnovo = s_config.infocamere_rinnovo_token), e lo
//    fa al momento la richiesta di un tecnico che trova la chiave scaduta.
// Ogni richiesta di chiave riaccetta le condizioni d'uso a nome dell'ente:
// è il canale previsto da InfoCamere per le API (canaleDiRicerca=API).
//
// Non scrive niente nella scheda: propone, e il tecnico sceglie. Ogni
// richiesta e ogni rinnovo lasciano una riga in imprese_dati_ufficiali_log,
// così la segreteria vede se un canale ha smesso di rispondere.
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { getToken, SOGGETTO_ENTE } from '../_shared/google.ts'
import {
  normalizzaCodice, isPiva, isCf, parseVies, parseInfocamere, scadenzaToken, chiaveDaMail, chiavePiuNuova,
} from './parse.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const VIES_URL = 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number'
const IC_URL = 'https://api-hvdataset.os.infocamere.it/ricercaImpresePuntuale'
const IC_LICENZA = 'https://ctrl-hvdataset.os.infocamere.it/accettazioneLicenza'
const IC_MITTENTE = 'noreply-hvdataset@infocamere.it'
const SCOPE_GMAIL_RO = 'https://www.googleapis.com/auth/gmail.readonly'
const ATTESA_MS = 9000

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function conAttesa(url: string, init: RequestInit = {}) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ATTESA_MS)
  try { return await fetch(url, { ...init, signal: ctl.signal }) } finally { clearTimeout(t) }
}

async function config(db: SupabaseClient, chiave: string): Promise<string> {
  const { data } = await db.from('s_config').select('valore').eq('chiave', chiave).maybeSingle()
  return String(data?.valore || '').trim()
}

type Esito = { esito: string; messaggio?: string; dati?: unknown; chiave?: string }

// ── rinnovo della chiave InfoCamere ──────────────────────────────────────────

type Parte = { mimeType?: string; body?: { data?: string }; parts?: Parte[] }
function testiDi(p: Parte | undefined, out: string[] = []): string[] {
  if (!p) return out
  if (p.body?.data && /^text\//.test(p.mimeType || '')) {
    const b64 = p.body.data.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64)
    out.push(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))))
  }
  for (const f of p.parts || []) testiDi(f, out)
  return out
}

// Le chiavi arrivate nelle ultime 24 ore, dalla casella dell'ente
async function chiaviDallaPosta(gTok: string): Promise<string[]> {
  const q = `from:${IC_MITTENTE} newer_than:1d`
  const l = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Bearer ${gTok}` } })
  if (!l.ok) throw new Error(`Gmail elenco ${l.status}`)
  const lj = await l.json()
  const chiavi: string[] = []
  for (const m of lj.messages || []) {
    const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
      { headers: { Authorization: `Bearer ${gTok}` } })
    if (!r.ok) continue
    const c = chiaveDaMail(testiDi((await r.json()).payload).join('\n'))
    if (c) chiavi.push(c)
  }
  return chiavi
}

const restaMs = (chiave: string) => {
  const s = scadenzaToken(chiave)
  return s ? s.getTime() - Date.now() : -1
}

// Rinnova se la chiave in uso scade entro `margineMs`. Restituisce la chiave valida.
async function rinnovaChiave(db: SupabaseClient, margineMs: number): Promise<{ chiave: string; nota: string }> {
  const attuale = await config(db, 'infocamere_hvd_token')
  if (attuale && restaMs(attuale) > margineMs) return { chiave: attuale, nota: 'chiave ancora valida' }

  const sa = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') || '{}')
  const gTok = await getToken(sa, SCOPE_GMAIL_RO, SOGGETTO_ENTE)
  const salva = async (chiave: string, nota: string) => {
    const { error } = await db.from('s_config').update({
      valore: chiave, updated_at: new Date().toISOString(), updated_by: 'rinnovo automatico (dati-impresa-ufficiali)',
    }).eq('chiave', 'infocamere_hvd_token')
    if (error) throw new Error('salvataggio chiave: ' + error.message)
    return { chiave, nota }
  }

  // una chiave più nuova può essere già in posta (richiesta da un altro giro)
  let migliore = chiavePiuNuova(await chiaviDallaPosta(gTok))
  if (migliore && restaMs(migliore) > margineMs) return await salva(migliore, 'presa dalla posta')

  const email = (await config(db, 'infocamere_hvd_email')) || SOGGETTO_ENTE
  const r = await conAttesa(`${IC_LICENZA}?email=${encodeURIComponent(email)}&canaleDiRicerca=API`)
  const rj = await r.json().catch(() => null)
  if (!r.ok || rj?.esito?.codice !== 'OK') {
    throw new Error(`richiesta chiave respinta (${r.status} ${rj?.esito?.descrizione || ''})`)
  }
  // la mail arriva in pochi secondi: si guarda fino a ~25 s
  for (let i = 0; i < 10; i++) {
    await pausa(i === 0 ? 1500 : 2500)
    migliore = chiavePiuNuova(await chiaviDallaPosta(gTok))
    if (migliore && restaMs(migliore) > 5 * 3600_000) return await salva(migliore, 'nuova chiave richiesta')
  }
  throw new Error('la mail con la chiave nuova non è arrivata entro 25 secondi')
}

// ── interrogazioni ──────────────────────────────────────────────────────────

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

async function infocamere(db: SupabaseClient, cf: string): Promise<Esito> {
  if (!cf) return { esito: 'non_interrogato', messaggio: 'serve un codice fiscale o una partita IVA' }
  let token = ''
  try {
    token = (await rinnovaChiave(db, 60_000)).chiave
  } catch (e) {
    console.warn('rinnovo chiave InfoCamere:', (e as Error).message)
    return { esito: 'token_scaduto', messaggio: 'chiave InfoCamere scaduta e rinnovo automatico non riuscito: avvisa la segreteria', chiave: cf }
  }
  try {
    const r = await conAttesa(`${IC_URL}?cf=${encodeURIComponent(cf)}`, {
      headers: { 'Id-Token': token, Accept: 'application/xml' },
    })
    const testo = await r.text()
    if (r.status === 401) return { esito: 'token_scaduto', messaggio: 'chiave InfoCamere respinta: avvisa la segreteria', chiave: cf }
    if (r.status === 429) return { esito: 'errore', messaggio: 'InfoCamere è sovraccarico, riprova fra poco', chiave: cf }
    if (r.status === 400) return { esito: 'errore', messaggio: 'InfoCamere non accetta questo codice fiscale', chiave: cf }
    if (!r.ok) return { esito: 'errore', messaggio: `InfoCamere non disponibile (garantito lun-ven 8-18)`, chiave: cf }
    const p = parseInfocamere(testo)
    if (!p.imprese.length) return { esito: 'non_trovata', messaggio: 'non è nell\'elenco InfoCamere (le ditte individuali non ci sono)', chiave: cf }
    return { esito: 'ok', dati: { ...p.imprese[0], erogazione: p.erogazione }, chiave: cf }
  } catch (e) {
    return { esito: 'errore', messaggio: (e as Error).name === 'AbortError' ? 'InfoCamere non ha risposto in tempo (garantito lun-ven 8-18)' : 'InfoCamere non raggiungibile (garantito lun-ven 8-18)', chiave: cf }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'metodo non ammesso' }, 405)
  const db = createClient(SUPABASE_URL, SERVICE_KEY)

  // giro programmato: rinnova la chiave se scade entro due ore
  const segreto = req.headers.get('x-infocamere-rinnovo') || ''
  if (segreto) {
    const atteso = await config(db, 'infocamere_rinnovo_token')
    if (!atteso || segreto !== atteso) return json({ error: 'accesso non autorizzato' }, 401)
    try {
      const { chiave, nota } = await rinnovaChiave(db, 2 * 3600_000)
      const scade = scadenzaToken(chiave)?.toISOString() || null
      await db.from('imprese_dati_ufficiali_log').insert({
        utente_email: 'rinnovo automatico', esito_infocamere: 'rinnovo_ok', messaggio: `${nota}; scade ${scade}`,
      })
      return json({ esito: 'ok', nota, scade })
    } catch (e) {
      const msg = (e as Error).message
      await db.from('imprese_dati_ufficiali_log').insert({
        utente_email: 'rinnovo automatico', esito_infocamere: 'rinnovo_errore', messaggio: msg,
      })
      return json({ esito: 'errore', messaggio: msg }, 502)
    }
  }

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
  const cfIc = isCf(cf) ? cf : (isCf(piva) ? piva : '')

  const [rv, ri] = await Promise.all([vies(pivaVies), infocamere(db, cfIc)])

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
