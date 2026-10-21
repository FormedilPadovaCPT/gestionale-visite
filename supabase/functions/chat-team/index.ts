// Supabase Edge Function – chat-team (21/10/2026)
//
// Foto e video della CHAT DEL TEAM (chat-team.js). I file vanno su Google
// Drive, in «Chat team/aaaa-mm» accanto a «Foto Verbali CPT», col nome a
// convenzione (aaaa_mm_gg_IMG|VID_Chat-team_<Cognome>_<descrizione>_n<ID>.ext),
// e NON si condividono con nessuno: si aprono solo passando da qui, che
// prima controlla nel database se chi chiede è ancora nella chat. Chi viene
// tolto perde subito anche i file.
//
// Chi può fare che cosa lo decide il database (chat_ruolo_di, chat_file_nuovo):
// questa funzione lo interroga e, per agganciare un file a un messaggio, usa
// la chiave di servizio, così dall'app nessuno può legare a un messaggio un
// file di Drive qualsiasi.
//
// Azioni (POST JSON, con l'accesso dell'utente):
//   { azione:'foto', image_base64, testo?, larghezza?, altezza? } → { ok, id }
//   { azione:'video_inizia', nome_originale, mime, dimensione, testo?, durata?, larghezza?, altezza? }
//        → { ok, id, upload_url }  indirizzo di caricamento «a pezzi» (resumable)
//          preparato qui: il telefono manda il file direttamente a Drive, a pezzi,
//          e se cade la linea riprende da dove era arrivato
//   { azione:'video_fine', id }       → { ok }  controlla su Drive che il file ci sia tutto
//   { azione:'anteprima', id, image_base64 } → { ok }  fotogramma del video, piccolo
//   { azione:'fallito', id }          → { ok }  caricamento abbandonato
//   { azione:'biglietti', ids:[…] }   → { ok, biglietti:{ id:{file, anteprima?} } }
// GET ?b=<biglietto>: il file, con le richieste a intervalli (Range) che usano
//   <img> e <video>. Il biglietto è firmato, vale 2 ore, porta l'account di chi l'ha chiesto,
//   e a ogni richiesta si ricontrolla che sia ancora nella chat. I video passano
//   da qui a pezzi da 8 MB e solo quando qualcuno preme «play»: nell'elenco si
//   vede il fotogramma (anteprima), non il video.
//
// Secrets: GOOGLE_SERVICE_ACCOUNT_JSON, DRIVE_FOLDER_ID (la cartella delle foto
// dei verbali: «Chat team» si crea nella stessa cartella madre).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAccessToken } from '../_shared/google.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Expose-Headers': 'content-range, content-length, accept-ranges',
}
const risposta = (dati: unknown, status = 200) =>
  new Response(JSON.stringify(dati), { status, headers: { 'Content-Type': 'application/json', ...CORS } })

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CARTELLA = 'Chat team'
const MAX_VIDEO = 100 * 1024 * 1024        // 100 MB, deciso il 20/10/2026
const MAX_FOTO_KB = 8192                   // la foto arriva già ridotta dal telefono (≈ 300-900 KB)
const MAX_ANTEPRIMA_KB = 1024
const PEZZO_VIDEO = 8 * 1024 * 1024        // ogni risposta di un video porta al massimo 8 MB
const DURATA_BIGLIETTO_S = 2 * 3600
const ORIGINI = ['https://formedilpadovacpt.github.io', 'http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:5500', 'http://127.0.0.1:5500']

const servizio = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

/* ── nomi a convenzione ── */
function oggiRoma(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
  const v = (t: string) => p.find((x) => x.type === t)!.value
  return { a: v('year'), m: v('month'), g: v('day') }
}
export function descrizione(testo: string | null | undefined, ripiego: string) {
  const s = String(testo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 6).join('-')
  return (s || ripiego).slice(0, 50).replace(/-+$/, '')
}
function cognomeFile(c: string) {
  return String(c || 'Segreteria').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'Segreteria'
}
function estensione(mime: string, nome: string) {
  const m: Record<string, string> = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/3gpp': '3gp', 'video/x-matroska': 'mkv' }
  if (m[mime]) return m[mime]
  const e = String(nome || '').split('.').pop() || ''
  return /^[a-z0-9]{2,4}$/i.test(e) ? e.toLowerCase() : 'mp4'
}

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
/* «Chat team/aaaa-mm», nella cartella madre di quella delle foto dei verbali */
async function cartellaMese(token: string): Promise<string> {
  const FOLDER_ID = Deno.env.get('DRIVE_FOLDER_ID')
  if (!FOLDER_ID) throw new Error('configurazione Drive mancante')
  const pr = await drive(token, `https://www.googleapis.com/drive/v3/files/${FOLDER_ID}?fields=parents&supportsAllDrives=true`)
  const pj = await pr.json()
  const madre = (pj.parents && pj.parents[0]) || FOLDER_ID
  const radice = await cartella(token, CARTELLA, madre)
  const o = oggiRoma()
  return await cartella(token, `${o.a}-${o.m}`, radice)
}
async function caricaPiccolo(token: string, nome: string, padre: string, mime: string, bytes: Uint8Array, app: Record<string, string>) {
  const bnd = '-------ChatTeam' + crypto.randomUUID()
  const enc = new TextEncoder()
  const testa = enc.encode(`--${bnd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nome, parents: [padre], appProperties: app })}\r\n--${bnd}\r\nContent-Type: ${mime}\r\n\r\n`)
  const coda = enc.encode(`\r\n--${bnd}--`)
  const corpo = new Uint8Array(testa.length + bytes.length + coda.length)
  corpo.set(testa, 0); corpo.set(bytes, testa.length); corpo.set(coda, testa.length + bytes.length)
  const up = await drive(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,size', {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${bnd}` }, body: corpo,
  })
  const uj = await up.json()
  if (!uj.id) throw new Error('caricamento su Drive non riuscito: ' + JSON.stringify(uj))
  return uj.id as string
}
const daBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

/* ── biglietti firmati per aprire i file ── */
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
const daB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0))
let _chiave: CryptoKey | null = null
async function chiave() {
  if (!_chiave) _chiave = await crypto.subtle.importKey('raw', new TextEncoder().encode('chat-team|' + SERVICE), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
  return _chiave
}
async function firma(dati: Record<string, unknown>) {
  const corpo = b64url(new TextEncoder().encode(JSON.stringify(dati)))
  const s = new Uint8Array(await crypto.subtle.sign('HMAC', await chiave(), new TextEncoder().encode(corpo)))
  return `${corpo}.${b64url(s)}`
}
async function leggiBiglietto(b: string): Promise<{ i: number; k: string; u: string; x: number } | null> {
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

/* ── un messaggio, letto con la chiave di servizio ── */
async function messaggio(id: number) {
  const { data, error } = await servizio.from('chat_messaggi')
    .select('id, autore_email, tipo, stato_file, cancellato_il, chat_contenuti(drive_file_id, drive_anteprima_id, nome_file, mime, dimensione_byte, testo)')
    .eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const c = Array.isArray(data.chat_contenuti) ? data.chat_contenuti[0] : data.chat_contenuti
  return { ...data, c: c || {} }
}
async function aggiorna(id: number, busta: Record<string, unknown> | null, contenuto: Record<string, unknown> | null) {
  if (contenuto) { const { error } = await servizio.from('chat_contenuti').update(contenuto).eq('messaggio_id', id); if (error) throw error }
  if (busta) { const { error } = await servizio.from('chat_messaggi').update(busta).eq('id', id); if (error) throw error }
}
async function ruoloDi(email: string): Promise<string | null> {
  const { data, error } = await servizio.rpc('chat_ruolo_di', { p_email: email })
  if (error) throw error
  return data || null
}

/* ── GET: il file, a chi è ancora nella chat ── */
async function servi(req: Request): Promise<Response> {
  const u = new URL(req.url)
  const b = await leggiBiglietto(u.searchParams.get('b') || '')
  if (!b) return new Response('Collegamento scaduto o non valido: riapri la chat.', { status: 403, headers: CORS })
  // nel biglietto c'è l'identificativo dell'account, non l'indirizzo: l'indirizzo si rilegge qui
  const { data: chi, error: ec } = await servizio.auth.admin.getUserById(b.u)
  if (ec || !chi?.user?.email) return new Response('Collegamento non valido: riapri la chat.', { status: 403, headers: CORS })
  if (!(await ruoloDi(chi.user.email.toLowerCase()))) return new Response('Non sei più nella chat del team.', { status: 403, headers: CORS })
  const m = await messaggio(b.i)
  if (!m || m.cancellato_il || m.stato_file !== 'pronto') return new Response('Il file non è disponibile.', { status: 404, headers: CORS })
  const fileId = b.k === 'a' ? m.c.drive_anteprima_id : m.c.drive_file_id
  if (!fileId) return new Response('Il file non è disponibile.', { status: 404, headers: CORS })
  const mime = b.k === 'a' ? 'image/jpeg' : (m.c.mime || 'application/octet-stream')

  const token = await getAccessToken(JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')!))
  const h: Record<string, string> = {}
  let range = req.headers.get('range')
  // un video si serve a pezzi: un intervallo aperto («bytes=0-») si chiude a 8 MB, il browser chiede il resto
  if (m.tipo === 'video' && b.k === 'f') {
    const r = /^bytes=(\d+)-(\d*)$/.exec(range || '')
    if (r) {
      const da = Number(r[1]); let a = r[2] ? Number(r[2]) : da + PEZZO_VIDEO - 1
      if (a - da + 1 > PEZZO_VIDEO) a = da + PEZZO_VIDEO - 1
      if (m.c.dimensione_byte && a > m.c.dimensione_byte - 1) a = m.c.dimensione_byte - 1
      range = `bytes=${da}-${a}`
    }
  }
  if (range) h.Range = range
  const r = await drive(token, `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, { headers: h })
  if (!r.ok && r.status !== 206) return new Response(`Lettura da Drive non riuscita (HTTP ${r.status})`, { status: 502, headers: CORS })
  const out: Record<string, string> = { ...CORS, 'Content-Type': mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=7200' }
  for (const k of ['content-range', 'content-length']) { const v = r.headers.get(k); if (v) out[k] = v }
  if (u.searchParams.get('scarica') === '1' && m.c.nome_file) out['Content-Disposition'] = `attachment; filename="${m.c.nome_file}"`
  return new Response(r.body, { status: r.status, headers: out })
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
    // il database decide se è nella chat: lo stesso controllo delle pagine
    const { data: st, error: es } = await utente.rpc('chat_stato')
    if (es) throw es
    if (!st || !st.partecipa) return risposta({ ok: false, error: 'Non sei nella chat del team' }, 403)

    const body = await req.json()
    const SA_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!SA_JSON) throw new Error('configurazione Drive mancante')

    /* ── biglietti per vedere i file ── */
    if (body.azione === 'biglietti') {
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter((x: number) => x > 0).slice(0, 100)
      const out: Record<string, { file?: string; anteprima?: string }> = {}
      if (ids.length) {
        const { data, error } = await servizio.from('chat_messaggi')
          .select('id, tipo, stato_file, cancellato_il, chat_contenuti(drive_file_id, drive_anteprima_id)').in('id', ids)
        if (error) throw error
        const x = Math.floor(Date.now() / 1000) + DURATA_BIGLIETTO_S
        const base = `${SUPABASE_URL}/functions/v1/chat-team?b=`
        for (const m of data || []) {
          const c = Array.isArray(m.chat_contenuti) ? m.chat_contenuti[0] : m.chat_contenuti
          if (m.cancellato_il || m.stato_file !== 'pronto' || !c) continue
          const o: { file?: string; anteprima?: string } = {}
          if (c.drive_file_id) o.file = base + await firma({ i: m.id, k: 'f', u: u.user.id, x })
          if (c.drive_anteprima_id) o.anteprima = base + await firma({ i: m.id, k: 'a', u: u.user.id, x })
          out[m.id] = o
        }
      }
      return risposta({ ok: true, biglietti: out, scadono_tra_s: DURATA_BIGLIETTO_S })
    }

    const token = await getAccessToken(JSON.parse(SA_JSON))
    const { data: cogn } = await servizio.rpc('chat_cognome_di', { p_email: email })
    const cognome = cognomeFile(cogn || '')
    const o = oggiRoma()

    /* ── una foto ── */
    if (body.azione === 'foto') {
      const b64 = String(body.image_base64 || '')
      if (!b64) return risposta({ ok: false, error: 'foto mancante' }, 400)
      const bytes = daBase64(b64)
      if (bytes.length / 1024 > MAX_FOTO_KB) return risposta({ ok: false, error: 'foto troppo grande' }, 400)
      const { data: id, error } = await servizio.rpc('chat_file_nuovo', {
        p_email: email, p_tipo: 'foto', p_testo: body.testo || null, p_mime: 'image/jpeg', p_dimensione: bytes.length,
        p_larghezza: Number(body.larghezza) || null, p_altezza: Number(body.altezza) || null, p_durata: null,
      })
      if (error) return risposta({ ok: false, error: error.message }, 400)
      const nome = `${o.a}_${o.m}_${o.g}_IMG_Chat-team_${cognome}_${descrizione(body.testo, 'foto')}_n${id}.jpg`
      try {
        const dove = await cartellaMese(token)
        const fid = await caricaPiccolo(token, nome, dove, 'image/jpeg', bytes, { chat_messaggio: String(id) })
        await aggiorna(id, { stato_file: 'pronto' }, { drive_file_id: fid, nome_file: nome, caricato_il: new Date().toISOString() })
      } catch (e) {
        await aggiorna(id, { stato_file: 'fallito' }, { nome_file: nome }).catch(() => {})
        throw e
      }
      return risposta({ ok: true, id })
    }

    /* ── un video: si apre il caricamento a pezzi ── */
    if (body.azione === 'video_inizia') {
      const dim = Number(body.dimensione) || 0
      const mime = String(body.mime || '')
      if (!/^video\//.test(mime)) return risposta({ ok: false, error: 'non è un video' }, 400)
      if (dim <= 0) return risposta({ ok: false, error: 'dimensione mancante' }, 400)
      if (dim > MAX_VIDEO) return risposta({ ok: false, error: 'Il video supera i 100 MB: condividi un link di Drive' }, 400)
      const { data: id, error } = await servizio.rpc('chat_file_nuovo', {
        p_email: email, p_tipo: 'video', p_testo: body.testo || null, p_mime: mime, p_dimensione: dim,
        p_larghezza: Number(body.larghezza) || null, p_altezza: Number(body.altezza) || null, p_durata: Number(body.durata) || null,
      })
      if (error) return risposta({ ok: false, error: error.message }, 400)
      const nome = `${o.a}_${o.m}_${o.g}_VID_Chat-team_${cognome}_${descrizione(body.testo, 'video')}_n${id}.${estensione(mime, body.nome_originale)}`
      try {
        const dove = await cartellaMese(token)
        const origine = ORIGINI.includes(req.headers.get('Origin') || '') ? req.headers.get('Origin')! : ORIGINI[0]
        // l'«Origin» qui è ciò che permette al browser di mandare i pezzi direttamente a Google
        const s = await drive(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,size', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(dim), Origin: origine },
          body: JSON.stringify({ name: nome, parents: [dove], appProperties: { chat_messaggio: String(id) } }),
        })
        const url = s.headers.get('location')
        if (!s.ok || !url) throw new Error(`Drive non ha aperto il caricamento (HTTP ${s.status}): ${await s.text()}`)
        await aggiorna(id, null, { nome_file: nome })
        return risposta({ ok: true, id, upload_url: url, nome_file: nome })
      } catch (e) {
        await aggiorna(id, { stato_file: 'fallito' }, { nome_file: nome }).catch(() => {})
        throw e
      }
    }

    /* da qui in poi: solo sui propri messaggi */
    const id = Number(body.id)
    if (!id) return risposta({ ok: false, error: 'messaggio mancante' }, 400)
    const m = await messaggio(id)
    if (!m) return risposta({ ok: false, error: 'messaggio non trovato' }, 404)
    if (m.autore_email !== email) return risposta({ ok: false, error: 'non è un tuo messaggio' }, 403)

    /* ── il video è arrivato tutto? lo si chiede a Drive, non al telefono ── */
    if (body.azione === 'video_fine') {
      if (m.tipo !== 'video') return risposta({ ok: false, error: 'non è un video' }, 400)
      if (m.stato_file === 'pronto') return risposta({ ok: true })
      const q = `appProperties has { key='chat_messaggio' and value='${id}' } and trashed=false and not mimeType contains 'image/'`
      const r = await drive(token, 'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,size,name)&q=' + encodeURIComponent(q))
      const j = await r.json()
      const f = (j.files || [])[0]
      if (!f) return risposta({ ok: false, error: 'Su Drive il video non è ancora arrivato tutto' }, 409)
      if (Number(f.size) > MAX_VIDEO) return risposta({ ok: false, error: 'Il video supera i 100 MB' }, 400)
      await aggiorna(id, { stato_file: 'pronto' }, { drive_file_id: f.id, dimensione_byte: Number(f.size) || null, caricato_il: new Date().toISOString() })
      return risposta({ ok: true })
    }

    /* ── il fotogramma che si vede nella chat al posto del video ── */
    if (body.azione === 'anteprima') {
      if (m.tipo !== 'video' || m.c.drive_anteprima_id) return risposta({ ok: true })
      const bytes = daBase64(String(body.image_base64 || ''))
      if (!bytes.length || bytes.length / 1024 > MAX_ANTEPRIMA_KB) return risposta({ ok: false, error: 'anteprima non valida' }, 400)
      const nome = String(m.c.nome_file || `video_n${id}`).replace(/\.[a-z0-9]+$/i, '') + '_anteprima.jpg'
      const dove = await cartellaMese(token)
      const fid = await caricaPiccolo(token, nome, dove, 'image/jpeg', bytes, { chat_messaggio: String(id), chat_anteprima: '1' })
      await aggiorna(id, null, { drive_anteprima_id: fid })
      return risposta({ ok: true })
    }

    /* ── caricamento abbandonato ── */
    if (body.azione === 'fallito') {
      if (m.stato_file === 'in_caricamento') await aggiorna(id, { stato_file: 'fallito' }, null)
      return risposta({ ok: true })
    }

    return risposta({ ok: false, error: 'azione sconosciuta' }, 400)
  } catch (e) {
    // (come promemoria-invii, avviso CodeQL n. 32) il messaggio dell'eccezione resta nel log della funzione, non nella risposta
    console.error('chat-team:', e)
    return risposta({ ok: false, error: 'non sono riuscito a completare: riprova; se si ripete, il motivo è nel registro della funzione chat-team' }, 500)
  }
})
