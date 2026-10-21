// Supabase Edge Function – documenti-personale (21/10/2026)
//
// DOCUMENTI AL PERSONALE CON PRESA VISIONE (documenti.js). La segreteria
// pubblica un PDF (prima applicazione: le informative sulla chat del team e
// sui sistemi automatizzati); il file va su Google Drive in «Documenti al
// personale» accanto a «Chat team», col nome a convenzione, e NON si condivide
// con nessuno: si apre solo passando da qui, che prima chiede al database se
// chi lo chiede può aprirlo (doc_puo_aprire) e ne registra l'apertura
// (doc_aperto). La presa visione la dà poi la persona dall'app
// (doc_prendi_visione), e il database la accetta solo dopo l'apertura.
//
// L'impronta SHA-256 del file la calcola questa funzione al momento della
// pubblicazione e resta nella riga della versione: dice QUALE file la persona
// ha letto. Prima di servirlo si controlla anche che su Drive il file sia
// ancora quello (md5 di Drive): se qualcuno l'avesse sostituito, non si apre.
//
// Azioni (POST JSON, con l'accesso dell'utente):
//   { azione:'pubblica', pdf_base64, titolo, codice, descrizione?, destinatari:[…] } → { ok, id, versione }
//        solo la segreteria; una versione nuova dello stesso codice ritira la precedente
//   { azione:'biglietti', ids:[…] } → { ok, biglietti:{ id: url } }
// GET ?b=<biglietto>[&scarica=1]: il PDF. Il biglietto è firmato, vale 2 ore,
//   porta l'account di chi l'ha chiesto, e a ogni richiesta si ricontrolla.
//
// Secrets: GOOGLE_SERVICE_ACCOUNT_JSON, DRIVE_FOLDER_ID (la cartella delle foto
// dei verbali: «Documenti al personale» si crea nella stessa cartella madre).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAccessToken } from '../_shared/google.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const risposta = (dati: unknown, status = 200) =>
  new Response(JSON.stringify(dati), { status, headers: { 'Content-Type': 'application/json', ...CORS } })

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CARTELLA = 'Documenti al personale'
const MAX_PDF = 10 * 1024 * 1024
const DURATA_BIGLIETTO_S = 2 * 3600
const GRUPPI = ['tecnici', 'coordinatore', 'segreteria', 'chat']

const servizio = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

/* ── nomi a convenzione ── */
function oggiRoma(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
  const v = (t: string) => p.find((x) => x.type === t)!.value
  return { a: v('year'), m: v('month'), g: v('day') }
}
const due = (n: number) => String(n).padStart(2, '0')

/* ── Drive ── */
async function drive(token: string, url: string, init: RequestInit = {}) {
  return await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } })
}
async function cartella(token: string, nome: string, padre: string): Promise<string> {
  const q = `name='${nome.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and '${padre}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const r = await drive(token, 'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id)&q=' + encodeURIComponent(q))
  const j = await r.json()
  if (j.files?.length) return j.files[0].id
  const mk = await drive(token, 'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nome, mimeType: 'application/vnd.google-apps.folder', parents: [padre] }),
  })
  const m = await mk.json()
  if (!m.id) throw new Error('cartella Drive non creata: ' + JSON.stringify(m))
  return m.id
}
async function cartellaDocumenti(token: string): Promise<string> {
  const FOLDER_ID = Deno.env.get('DRIVE_FOLDER_ID')
  if (!FOLDER_ID) throw new Error('configurazione Drive mancante')
  const pr = await drive(token, `https://www.googleapis.com/drive/v3/files/${FOLDER_ID}?fields=parents&supportsAllDrives=true`)
  const pj = await pr.json()
  const madre = (pj.parents && pj.parents[0]) || FOLDER_ID
  return await cartella(token, CARTELLA, madre)
}
async function carica(token: string, nome: string, padre: string, bytes: Uint8Array, app: Record<string, string>) {
  const bnd = '-------DocPersonale' + crypto.randomUUID()
  const enc = new TextEncoder()
  const testa = enc.encode(`--${bnd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nome, parents: [padre], appProperties: app })}\r\n--${bnd}\r\nContent-Type: application/pdf\r\n\r\n`)
  const coda = enc.encode(`\r\n--${bnd}--`)
  const corpo = new Uint8Array(testa.length + bytes.length + coda.length)
  corpo.set(testa, 0); corpo.set(bytes, testa.length); corpo.set(coda, testa.length + bytes.length)
  const up = await drive(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,size,md5Checksum', {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${bnd}` }, body: corpo,
  })
  const uj = await up.json()
  if (!uj.id) throw new Error('caricamento su Drive non riuscito: ' + JSON.stringify(uj))
  return { id: uj.id as string, md5: (uj.md5Checksum as string) || null }
}
const daBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
const esa = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('')

/* ── biglietti firmati ── */
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
const daB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0))
let _chiave: CryptoKey | null = null
async function chiave() {
  if (!_chiave) _chiave = await crypto.subtle.importKey('raw', new TextEncoder().encode('documenti-personale|' + SERVICE), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
  return _chiave
}
async function firma(dati: Record<string, unknown>) {
  const corpo = b64url(new TextEncoder().encode(JSON.stringify(dati)))
  const s = new Uint8Array(await crypto.subtle.sign('HMAC', await chiave(), new TextEncoder().encode(corpo)))
  return `${corpo}.${b64url(s)}`
}
async function leggiBiglietto(b: string): Promise<{ d: number; u: string; x: number } | null> {
  const [corpo, s] = String(b || '').split('.')
  if (!corpo || !s) return null
  const ok = await crypto.subtle.verify('HMAC', await chiave(), daB64url(s), new TextEncoder().encode(corpo))
  if (!ok) return null
  try {
    const d = JSON.parse(new TextDecoder().decode(daB64url(corpo)))
    if (!d || typeof d.x !== 'number' || d.x < Math.floor(Date.now() / 1000)) return null
    return d
  } catch { return null }
}

async function puoAprire(doc: number, email: string): Promise<boolean> {
  const { data, error } = await servizio.rpc('doc_puo_aprire', { p_doc: doc, p_email: email })
  if (error) throw error
  return data === true
}
async function eSegreteria(email: string): Promise<boolean> {
  // lo stesso elenco che usa il database (doc_registra lo ricontrolla comunque)
  const { data, error } = await servizio.rpc('push_destinatari_segreteria')
  if (error) throw error
  return Array.isArray(data) && data.includes(email)
}

/* ── GET: il PDF, a chi può aprirlo ── */
async function servi(req: Request): Promise<Response> {
  const u = new URL(req.url)
  const b = await leggiBiglietto(u.searchParams.get('b') || '')
  if (!b) return new Response('Collegamento scaduto o non valido: riapri la pagina Documenti.', { status: 403, headers: CORS })
  const { data: chi, error: ec } = await servizio.auth.admin.getUserById(b.u)
  if (ec || !chi?.user?.email) return new Response('Collegamento non valido: riapri la pagina Documenti.', { status: 403, headers: CORS })
  const email = chi.user.email.toLowerCase()
  if (!(await puoAprire(b.d, email))) return new Response('Questo documento non è fra i tuoi.', { status: 403, headers: CORS })
  const { data: d, error } = await servizio.from('doc_personale').select('id, drive_file_id, nome_file, md5_drive').eq('id', b.d).maybeSingle()
  if (error) throw error
  if (!d) return new Response('Il documento non c\'è.', { status: 404, headers: CORS })

  const token = await getAccessToken(JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')!))
  // il file su Drive è ancora quello pubblicato? (se qualcuno l'avesse sostituito, la presa visione non varrebbe)
  if (d.md5_drive) {
    const mr = await drive(token, `https://www.googleapis.com/drive/v3/files/${d.drive_file_id}?fields=md5Checksum,trashed&supportsAllDrives=true`)
    const mj = await mr.json()
    if (!mr.ok || mj.trashed || mj.md5Checksum !== d.md5_drive) {
      console.error('documenti-personale: file cambiato o sparito su Drive', d.id, mr.status, mj)
      return new Response('Il file su Drive non è più quello pubblicato: avvisa la segreteria.', { status: 409, headers: CORS })
    }
  }
  const r = await drive(token, `https://www.googleapis.com/drive/v3/files/${d.drive_file_id}?alt=media&supportsAllDrives=true`)
  if (!r.ok) return new Response(`Lettura da Drive non riuscita (HTTP ${r.status})`, { status: 502, headers: CORS })
  // l'apertura si registra solo a file letto; per chi non è destinatario (segreteria, Coordinatore) non si scrive niente
  const { error: ea } = await servizio.rpc('doc_aperto', { p_doc: d.id, p_email: email })
  if (ea) throw ea
  const scarica = u.searchParams.get('scarica') === '1'
  return new Response(r.body, {
    status: 200,
    headers: {
      ...CORS, 'Content-Type': 'application/pdf', 'Cache-Control': 'private, no-store',
      'Content-Disposition': `${scarica ? 'attachment' : 'inline'}; filename="${d.nome_file}"`,
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    if (req.method === 'GET') return await servi(req)

    const auth = req.headers.get('Authorization') || ''
    if (!auth.startsWith('Bearer ')) return risposta({ ok: false, error: 'accesso non autorizzato' }, 401)
    const utente = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false } })
    const { data: u, error: eu } = await utente.auth.getUser()
    if (eu || !u?.user?.email) return risposta({ ok: false, error: 'accesso non autorizzato' }, 401)
    const email = u.user.email.toLowerCase()
    const body = await req.json()

    /* ── biglietti per aprire i PDF ── */
    if (body.azione === 'biglietti') {
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter((x: number) => x > 0).slice(0, 60)
      const out: Record<string, string> = {}
      const x = Math.floor(Date.now() / 1000) + DURATA_BIGLIETTO_S
      for (const id of ids) {
        if (await puoAprire(id, email)) out[id] = `${SUPABASE_URL}/functions/v1/documenti-personale?b=` + await firma({ d: id, u: u.user.id, x })
      }
      return risposta({ ok: true, biglietti: out, scadono_tra_s: DURATA_BIGLIETTO_S })
    }

    /* ── pubblicare un documento (segreteria) ── */
    if (body.azione === 'pubblica') {
      if (!(await eSegreteria(email))) return risposta({ ok: false, error: 'I documenti al personale li pubblica la segreteria' }, 403)
      const titolo = String(body.titolo || '').trim()
      const codice = String(body.codice || '').trim()
      const destinatari = (Array.isArray(body.destinatari) ? body.destinatari : []).map(String).filter((g: string) => GRUPPI.includes(g))
      if (titolo.length < 3) return risposta({ ok: false, error: 'Manca il titolo' }, 400)
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(codice) || codice.length < 3 || codice.length > 60) return risposta({ ok: false, error: 'Codice del documento non valido' }, 400)
      if (!destinatari.length) return risposta({ ok: false, error: 'Scegli a chi va il documento' }, 400)
      const bytes = daBase64(String(body.pdf_base64 || ''))
      if (!bytes.length) return risposta({ ok: false, error: 'Manca il PDF' }, 400)
      if (bytes.length > MAX_PDF) return risposta({ ok: false, error: 'Il PDF supera i 10 MB' }, 400)
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') return risposta({ ok: false, error: 'Il file non è un PDF' }, 400)
      const sha256 = esa(await crypto.subtle.digest('SHA-256', bytes))
      const { data: versione, error: ev } = await servizio.rpc('doc_prossima_versione', { p_codice: codice })
      if (ev) throw ev
      const o = oggiRoma()
      const nome = `${o.a}_${o.m}_${o.g}_MOD_Formedil-Padova_${codice}_v${due(versione)}.pdf`
      const token = await getAccessToken(JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')!))
      const dove = await cartellaDocumenti(token)
      const f = await carica(token, nome, dove, bytes, { doc_personale: codice, versione: String(versione), sha256 })
      const { data: id, error } = await servizio.rpc('doc_registra', {
        p_email: email, p_codice: codice, p_versione: versione, p_titolo: titolo, p_descrizione: body.descrizione || null,
        p_destinatari: destinatari, p_drive_file_id: f.id, p_nome_file: nome, p_sha256: sha256, p_md5: f.md5, p_dimensione: bytes.length,
      })
      if (error) {
        // il file appena caricato non è legato a niente: va nel cestino di Drive, così non resta un doppione senza riga
        await drive(token, `https://www.googleapis.com/drive/v3/files/${f.id}?supportsAllDrives=true`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }),
        }).catch(() => {})
        return risposta({ ok: false, error: error.message }, 400)
      }
      return risposta({ ok: true, id, versione, nome_file: nome, sha256 })
    }

    return risposta({ ok: false, error: 'azione sconosciuta' }, 400)
  } catch (e) {
    // il messaggio dell'eccezione resta nel log della funzione, non nella risposta (come chat-team)
    console.error('documenti-personale:', e)
    return risposta({ ok: false, error: 'non sono riuscito a completare: riprova; se si ripete, il motivo è nel registro della funzione documenti-personale' }, 500)
  }
})
