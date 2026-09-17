// Supabase Edge Function – push-visite (progetto GESTIONALE, utdantrfugnmqsuujxbe)
//
// NOTIFICHE SUL TELEFONO DEI TECNICI (17/09/2026, chiesto dall'utente).
//
// Il gestionale visite e' un'app installabile: chi vuole attiva le notifiche sul
// proprio telefono e riceve «hai un nuovo incarico», «c'e' un avviso in bacheca»,
// «l'ufficio ha risposto alla tua segnalazione»... Stesso motore dell'app servizi
// (webpush.js: copia IDENTICA di push-notizie, provata col vettore dell'RFC 8291),
// con una differenza che conta: li' l'avviso va a tutti, QUI VA A UNA PERSONA.
//
// Porte:
//   GET                            pubblica: la chiave VAPID pubblica (si genera al primo uso)
//   POST {azione:'iscrivi'}        con l'accesso del tecnico (Authorization: Bearer <jwt>):
//                                  salva il telefono legandolo alla SUA email
//   POST {azione:'cancella'}       con l'accesso: toglie quel telefono (solo se e' suo)
//   POST {azione:'prova'}          con l'accesso: una notifica di prova AI SOLI suoi telefoni
//   POST {azione:'stato'}          con l'accesso: quanti telefoni ha iscritti (+ la ricevuta di questo)
//   POST {azione:'ricevuta'}       dal service worker, senza accesso: «arrivata e mostrata» su
//                                  QUEL telefono (vale solo per un indirizzo d'iscrizione già noto)
//   POST {azione:'invia'}          con X-Campanello: svuota push_coda. La chiamano i
//                                  trigger (pg_net, dopo il commit) e il giro pg_cron
//
// Che cosa NON fa, di proposito: nessun testo scelto da chi chiama finisce in una
// notifica (i testi li scrivono i trigger e sono fissi, senza nomi di imprese o
// cantieri: una notifica si legge sulla schermata di blocco); le chiavi dei
// telefoni non tornano mai a un client.
//
// verify_jwt = false: GET e campanello non hanno un utente; le porte del tecnico
// verificano il token da se' (auth.getUser). Il campanello vive solo nel database.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { generaChiaviVapid, inviaNotifica, daB64u } from './webpush.js'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

type SB = ReturnType<typeof createClient>
type Chiavi = { jwk: JsonWebKey; pubblica: string }
type Iscrizione = { id: number; email: string; endpoint: string; p256dh: string; auth: string }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...CORS } })
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

const MAX_CORPO = 4096
const MAX_TELEFONI = 6   // per persona: telefono, tablet, un paio di computer
const HOST_PUSH = [
  /^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/,
  /^web\.push\.apple\.com$/,
  /^updates\.push\.services\.mozilla\.com$/, /\.push\.services\.mozilla\.com$/,
  /\.notify\.windows\.com$/,
]
const DISPOSITIVI = ['android', 'iphone', 'computer', 'altro']

/* le letture si ritentano (502/503/504 di passaggio), le scritture no */
async function impostazioni(sb: SB): Promise<Record<string, string>> {
  let ultimo = ''
  for (let i = 0; i < 3; i++) {
    const { data, error } = await sb.from('push_impostazioni').select('chiave, valore')
    if (!error) return Object.fromEntries((data || []).map((r) => [r.chiave as string, r.valore as string]))
    ultimo = error.message
    await new Promise((ok) => setTimeout(ok, 800 * (i + 1)))
  }
  throw new Error('impostazioni delle notifiche non leggibili: ' + ultimo)
}

async function chiaviVapid(sb: SB, imp: Record<string, string>): Promise<Chiavi> {
  if (imp.vapid) return JSON.parse(imp.vapid)
  const nuove = await generaChiaviVapid()
  // due richieste insieme: vince la prima scritta, e tutte rileggono quella
  await sb.from('push_impostazioni').upsert({
    chiave: 'vapid', valore: JSON.stringify(nuove),
    descrizione: 'Coppia di chiavi VAPID (JWK privata + pubblica), generata da push-visite al primo uso. NON cambiarla: i telefoni iscritti smetterebbero di ricevere.',
  }, { onConflict: 'chiave', ignoreDuplicates: true })
  const { data, error } = await sb.from('push_impostazioni').select('valore').eq('chiave', 'vapid').single()
  if (error || !data) throw new Error('chiavi VAPID non leggibili: ' + (error?.message || 'riga mancante'))
  return JSON.parse(data.valore as string)
}

function uguali(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

/* chi sta chiamando: il token lo verifica Supabase, e deve essere personale attivo */
async function chiChiama(sb: SB, req: Request): Promise<{ email: string; tecnico_id: string | null } | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await sb.auth.getUser(token)
  const email = (data?.user?.email || '').toLowerCase()
  if (error || !email) return null
  /* ilike per le maiuscole, ma «_» e «%» in un indirizzo sono caratteri, non jolly */
  const lett = email.replace(/[\\%_]/g, (c) => '\\' + c)
  const [{ data: tec }, { data: ruolo }] = await Promise.all([
    sb.from('tecnici').select('tecnico_id, attivo, elimina').ilike('email', lett).limit(1),
    sb.from('app_ruoli').select('ruolo').ilike('email', lett).eq('stato', 'attivo').limit(1),
  ])
  const t = (tec || []).find((r) => r.attivo !== false && !r.elimina)
  if (!t && !(ruolo || []).length) return null   // un account senza scheda e senza ruolo non riceve niente
  return { email, tecnico_id: (t?.tecnico_id as string) || null }
}

async function iscrivi(sb: SB, chi: { email: string; tecnico_id: string | null }, d: Record<string, any>) {
  const s = d.iscrizione || {}
  const endpoint = typeof s.endpoint === 'string' ? s.endpoint : ''
  const p256dh = typeof s.keys?.p256dh === 'string' ? s.keys.p256dh : ''
  const auth = typeof s.keys?.auth === 'string' ? s.keys.auth : ''
  let url: URL
  try { url = new URL(endpoint) } catch { return json({ error: 'iscrizione non valida' }, 400) }
  if (url.protocol !== 'https:' || endpoint.length > 1000 || !HOST_PUSH.some((r) => r.test(url.hostname))) {
    return json({ error: 'servizio di notifica non riconosciuto' }, 400)
  }
  try {
    const k = daB64u(p256dh), a = daB64u(auth)
    if (k.length !== 65 || k[0] !== 4 || a.length !== 16 || p256dh.length > 120 || auth.length > 40) throw new Error()
  } catch { return json({ error: "chiavi dell'iscrizione non valide" }, 400) }
  const dispositivo = DISPOSITIVI.includes(d.dispositivo) ? d.dispositivo : 'altro'

  const { data: mie } = await sb.from('push_iscrizioni').select('id, endpoint').eq('email', chi.email).order('id')
  const gia = (mie || []).some((r) => r.endpoint === endpoint)
  if (!gia && (mie || []).length >= MAX_TELEFONI) {
    // il piu' vecchio lascia il posto: un telefono cambiato non deve impedire quello nuovo
    await sb.from('push_iscrizioni').delete().eq('id', (mie as any[])[0].id)
  }
  // lo stesso telefono passato a un altro account: l'iscrizione segue chi e' entrato adesso
  const { error } = await sb.from('push_iscrizioni').upsert(
    { email: chi.email, tecnico_id: chi.tecnico_id, endpoint, p256dh, auth, dispositivo, errori: 0 },
    { onConflict: 'endpoint' })
  if (error) return json({ error: 'iscrizione non salvata: ' + error.message }, 500)
  return json({ ok: true })
}

async function cancella(sb: SB, chi: { email: string }, d: Record<string, any>) {
  const endpoint = typeof d.endpoint === 'string' ? d.endpoint : ''
  if (!endpoint) return json({ error: 'manca il telefono da togliere' }, 400)
  const { error } = await sb.from('push_iscrizioni').delete().eq('endpoint', endpoint).eq('email', chi.email)
  if (error) return json({ error: error.message }, 500)
  return json({ ok: true })
}

async function manda(sb: SB, iscritti: Iscrizione[], messaggio: string, chiavi: Chiavi, contatto: string) {
  const ok: number[] = [], ko: number[] = [], morte: number[] = []
  const campioni: string[] = []
  await Promise.all(iscritti.map(async (s) => {
    try {
      const r = await inviaNotifica(s, messaggio, chiavi, contatto, { urgenza: 'normal' })
      if (r.consegnata) ok.push(s.id)
      else if (r.morta) morte.push(s.id)
      else { ko.push(s.id); if (campioni.length < 3) campioni.push(r.stato + ' ' + new URL(s.endpoint).hostname + ' ' + r.testo.slice(0, 80)) }
    } catch (e) {
      ko.push(s.id)
      if (campioni.length < 3) campioni.push('eccezione ' + errMsg(e).slice(0, 80))
    }
  }))
  if (ok.length) await sb.from('push_iscrizioni').update({ ultima_consegna_il: new Date().toISOString(), errori: 0 }).in('id', ok)
  if (morte.length) await sb.from('push_iscrizioni').delete().in('id', morte)   // il telefono ha tolto il permesso
  for (const id of ko) {
    const { data } = await sb.from('push_iscrizioni').select('errori').eq('id', id).single()
    await sb.from('push_iscrizioni').update({ errori: ((data?.errori as number) || 0) + 1 }).eq('id', id)
  }
  return { telefoni: iscritti.length, consegnate: ok.length, rimossi: morte.length, fallite: ko.length, campioni }
}

async function prova(sb: SB, imp: Record<string, string>, chi: { email: string }) {
  const chiavi = await chiaviVapid(sb, imp)
  const { data, error } = await sb.from('push_iscrizioni').select('id, email, endpoint, p256dh, auth').eq('email', chi.email)
  if (error) return json({ error: error.message }, 500)
  if (!data?.length) return json({ error: 'su questo account non risulta nessun telefono iscritto' }, 400)
  const messaggio = JSON.stringify({
    titolo: 'Gestionale Visite — prova', tag: 'prova', url: './',
    testo: 'Se leggi questo, le notifiche su questo dispositivo funzionano.',
  })
  return json({ ok: true, ...(await manda(sb, data as Iscrizione[], messaggio, chiavi, imp.contatto || 'mailto:cpt@formedilpadova.it')) })
}

/* svuota la coda: prende un lotto (una riga presa non la prende un'altra chiamata) */
async function inviaCoda(sb: SB, imp: Record<string, string>) {
  const chiavi = await chiaviVapid(sb, imp)
  const contatto = imp.contatto || 'mailto:cpt@formedilpadova.it'
  let fatte = 0
  for (let giro = 0; giro < 5; giro++) {
    const { data: lotto, error } = await sb.rpc('push_prenota_coda', { p_max: 50 })
    if (error) throw new Error('coda: ' + error.message)
    if (!lotto?.length) break
    for (const n of lotto as any[]) {
      const { data: tel, error: te } = await sb.from('push_iscrizioni').select('id, email, endpoint, p256dh, auth').eq('email', n.email)
      if (te) { await sb.from('push_coda').update({ esito: { errore: te.message } }).eq('id', n.id); continue }
      if (!tel?.length) {
        await sb.from('push_coda').update({ stato: 'nessun_dispositivo', inviata_il: new Date().toISOString(), prenotata_fino: null }).eq('id', n.id)
        fatte++; continue
      }
      const messaggio = JSON.stringify({ titolo: n.titolo, testo: n.testo, url: n.url, tag: n.tag })
      if (new TextEncoder().encode(messaggio).length > 3000) {
        await sb.from('push_coda').update({ stato: 'errore', esito: { errore: 'messaggio troppo lungo' }, prenotata_fino: null }).eq('id', n.id)
        continue
      }
      const esito = await manda(sb, tel as Iscrizione[], messaggio, chiavi, contatto)
      // consegnata ad almeno un telefono = fatta; se falliscono tutti si ritenta (fino a 5 volte)
      const finita = esito.consegnate > 0 || esito.rimossi === esito.telefoni || n.tentativi >= 5
      await sb.from('push_coda').update({
        stato: esito.consegnate > 0 ? 'inviata' : finita ? (esito.rimossi === esito.telefoni ? 'nessun_dispositivo' : 'errore') : 'in_attesa',
        inviata_il: finita ? new Date().toISOString() : null, esito, prenotata_fino: finita ? null : n.prenotata_fino,
      }).eq('id', n.id)
      fatte++
    }
  }
  await sb.from('push_impostazioni').upsert({ chiave: 'ultimo_giro_il', valore: new Date().toISOString(),
    descrizione: 'Ultima volta che la coda è stata lavorata (campanello o giro).', updated_at: new Date().toISOString() }, { onConflict: 'chiave' })
  return fatte
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  try {
    const imp = await impostazioni(sb)
    if (req.method === 'GET') return json({ chiave: (await chiaviVapid(sb, imp)).pubblica })
    if (req.method !== 'POST') return json({ error: 'metodo non ammesso' }, 405)

    const grezzo = await req.text()
    if (grezzo.length > MAX_CORPO) return json({ error: 'richiesta troppo grande' }, 413)
    let d: Record<string, any> = {}
    try { d = grezzo ? JSON.parse(grezzo) : {} } catch { return json({ error: 'richiesta non valida' }, 400) }

    if (d.azione === 'invia') {
      const dato = req.headers.get('x-campanello') || ''
      if (!imp.campanello_token || !uguali(dato, imp.campanello_token)) return json({ error: 'non autorizzato' }, 401)
      EdgeRuntime.waitUntil(inviaCoda(sb, imp).catch((e) => console.error('[push-visite] coda:', errMsg(e))))
      return json({ ok: true, accettata: true }, 202)
    }

    /* ricevuta di ritorno dal service worker: «la notifica è arrivata a QUESTO telefono».
       Senza accesso (il service worker non ha la sessione), ma può riguardare solo un
       indirizzo d'iscrizione già noto, che conoscono soltanto quel telefono e il database:
       chi non lo ha non scrive niente, e chi lo ha può solo aggiornare una data. */
    if (d.azione === 'ricevuta') {
      const endpoint = typeof d.endpoint === 'string' ? d.endpoint.slice(0, 1000) : ''
      if (!endpoint) return json({ error: 'manca il telefono' }, 400)
      const esito = d.esito === 'mostrata' ? 'mostrata'
        : 'errore: ' + String(d.errore || 'non precisato').replace(/[^\x20-\x7e]/g, ' ').slice(0, 120)
      await sb.from('push_iscrizioni').update({ ultima_ricezione_il: new Date().toISOString(), ultima_ricezione_esito: esito }).eq('endpoint', endpoint)
      return json({ ok: true })
    }

    const chi = await chiChiama(sb, req)
    if (!chi) return json({ error: 'accesso non valido' }, 401)
    if (d.azione === 'iscrivi') return await iscrivi(sb, chi, d)
    if (d.azione === 'cancella') return await cancella(sb, chi, d)
    if (d.azione === 'prova') return await prova(sb, imp, chi)
    if (d.azione === 'stato') {
      const { data } = await sb.from('push_iscrizioni').select('id, dispositivo, created_at, ultima_consegna_il, ultima_ricezione_il, ultima_ricezione_esito, endpoint').eq('email', chi.email)
      const questo = typeof d.endpoint === 'string' ? (data || []).find((r) => r.endpoint === d.endpoint) : null
      return json({
        ok: true,
        telefoni: (data || []).map(({ endpoint: _e, ...r }) => r),   // l'indirizzo d'iscrizione non torna al client
        questo: questo ? { ultima_consegna_il: questo.ultima_consegna_il, ultima_ricezione_il: questo.ultima_ricezione_il, ultima_ricezione_esito: questo.ultima_ricezione_esito } : null,
      })
    }
    return json({ error: 'azione sconosciuta' }, 400)
  } catch (e) {
    console.error('[push-visite]', errMsg(e))
    return json({ error: errMsg(e) }, 500)
  }
})
