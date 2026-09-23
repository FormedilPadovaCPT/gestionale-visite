// Supabase Edge Function – foto-appunti (23/09/2026)
//
// Foto degli APPUNTI DI CANTIERE del tecnico (appunti-cantiere.js). Gli appunti
// sono personali: li vede solo chi li ha scritti. Per questo NON si usa
// upload-foto, che rende ogni file leggibile a chiunque abbia il link:
// - le foto vanno su Drive in «Foto Appunti tecnici/<email del tecnico>»,
//   cartella accanto a «Foto Verbali CPT», SENZA permesso pubblico;
// - si leggono solo da qui, e solo se la riga appunti_cantiere_foto e' del
//   chiamante: il database e' interrogato COME l'utente, quindi decide la RLS.
//
// Azioni (POST JSON):
//   { azione:'carica',  appunto_id, image_base64 }  → { ok, foto:{id,…} }
//   { azione:'scarica', foto_id }                   → { ok, base64 }
//   { azione:'elimina', foto_id }                   → { ok }  (il file va nel cestino di Drive)
//
// Secrets: GOOGLE_SERVICE_ACCOUNT_JSON, DRIVE_FOLDER_ID (quella delle foto verbali:
// la cartella degli appunti si crea accanto, nella stessa cartella madre).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAccessToken } from '../_shared/google.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const risposta = (dati: unknown, status = 200) =>
  new Response(JSON.stringify(dati), { status, headers: { 'Content-Type': 'application/json', ...CORS } })

const CARTELLA = 'Foto Appunti tecnici'
const MAX_KB = 4096      // una foto compressa dal telefono pesa 200-600 KB
const MAX_PER_APPUNTO = 12

async function drive(token: string, url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } })
  return r
}

/* cartella per nome dentro `padre`, creata se manca */
async function cartella(token: string, nome: string, padre: string): Promise<string> {
  const q = `name='${nome.replace(/'/g, "\\'")}' and '${padre}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const r = await drive(token, 'https://www.googleapis.com/drive/v3/files?fields=files(id)&q=' + encodeURIComponent(q))
  const j = await r.json()
  if (j.files?.length) return j.files[0].id
  const mk = await drive(token, 'https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nome, mimeType: 'application/vnd.google-apps.folder', parents: [padre] }),
  })
  const m = await mk.json()
  if (!m.id) throw new Error('cartella Drive non creata: ' + JSON.stringify(m))
  return m.id
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const auth = req.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return risposta({ ok: false, error: 'accesso non autorizzato' }, 401)

  // il database visto COME l'utente: la RLS decide che cosa e' suo
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: u, error: eu } = await sb.auth.getUser()
  if (eu || !u?.user?.email) return risposta({ ok: false, error: 'accesso non autorizzato' }, 401)
  const { data: pers, error: ep } = await sb.rpc('is_personale')
  if (ep || pers !== true) return risposta({ ok: false, error: 'utente non abilitato' }, 403)
  const email = u.user.email.toLowerCase()

  try {
    const body = await req.json()
    const SA_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    const FOLDER_ID = Deno.env.get('DRIVE_FOLDER_ID')
    if (!SA_JSON || !FOLDER_ID) throw new Error('configurazione Drive mancante')
    const token = await getAccessToken(JSON.parse(SA_JSON))

    /* ── carica ── */
    if (body.azione === 'carica') {
      const appuntoId = Number(body.appunto_id)
      const b64 = String(body.image_base64 || '')
      if (!appuntoId || !b64) return risposta({ ok: false, error: 'dati mancanti' }, 400)
      const kb = Math.round(b64.length * 3 / 4 / 1024)
      if (kb > MAX_KB) return risposta({ ok: false, error: `foto troppo grande (${kb} KB)` }, 400)
      // l'appunto dev'essere del chiamante (RLS: se non e' suo non lo vede)
      const { data: ap, error: ea } = await sb.from('appunti_cantiere').select('id').eq('id', appuntoId).maybeSingle()
      if (ea) throw ea
      if (!ap) return risposta({ ok: false, error: 'appunto non trovato' }, 404)
      const { count, error: ec } = await sb.from('appunti_cantiere_foto').select('id', { count: 'exact', head: true }).eq('appunto_id', appuntoId)
      if (ec) throw ec
      if ((count || 0) >= MAX_PER_APPUNTO) return risposta({ ok: false, error: `al massimo ${MAX_PER_APPUNTO} foto per appunto` }, 400)

      // cartella madre di «Foto Verbali CPT» → «Foto Appunti tecnici» → <email>
      const pr = await drive(token, `https://www.googleapis.com/drive/v3/files/${FOLDER_ID}?fields=parents&supportsAllDrives=true`)
      const pj = await pr.json()
      const madre = (pj.parents && pj.parents[0]) || FOLDER_ID
      const radice = await cartella(token, CARTELLA, madre)
      const mia = await cartella(token, email, radice)

      const d = new Date()
      const p2 = (n: number) => String(n).padStart(2, '0')
      const nome = `appunto_${appuntoId}_${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}.jpg`
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const bnd = '-------FotoAppunto'
      const enc = new TextEncoder()
      const testa = enc.encode(`--${bnd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nome, parents: [mia] })}\r\n--${bnd}\r\nContent-Type: image/jpeg\r\n\r\n`)
      const coda = enc.encode(`\r\n--${bnd}--`)
      const corpo = new Uint8Array(testa.length + bytes.length + coda.length)
      corpo.set(testa, 0); corpo.set(bytes, testa.length); corpo.set(coda, testa.length + bytes.length)
      const up = await drive(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${bnd}` }, body: corpo,
      })
      const uj = await up.json()
      if (!uj.id) throw new Error('caricamento su Drive non riuscito: ' + JSON.stringify(uj))
      // NESSUN permesso pubblico: la foto si legge solo da questa funzione

      const { data: riga, error: ei } = await sb.from('appunti_cantiere_foto')
        .insert({ appunto_id: appuntoId, drive_file_id: uj.id, nome_file: nome, dimensione_kb: kb })
        .select('id, appunto_id, nome_file, dimensione_kb, creato_il').single()
      if (ei) {
        // la riga non si e' scritta: il file non deve restare orfano
        await drive(token, `https://www.googleapis.com/drive/v3/files/${uj.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }),
        })
        throw ei
      }
      return risposta({ ok: true, foto: riga })
    }

    /* ── scarica / elimina: solo foto del chiamante ── */
    if (body.azione === 'scarica' || body.azione === 'elimina') {
      const fotoId = Number(body.foto_id)
      if (!fotoId) return risposta({ ok: false, error: 'dati mancanti' }, 400)
      const { data: f, error: ef } = await sb.from('appunti_cantiere_foto').select('id, drive_file_id').eq('id', fotoId).maybeSingle()
      if (ef) throw ef
      if (!f) return risposta({ ok: false, error: 'foto non trovata' }, 404)

      if (body.azione === 'scarica') {
        const r = await drive(token, `https://www.googleapis.com/drive/v3/files/${f.drive_file_id}?alt=media`)
        if (!r.ok) throw new Error(`lettura da Drive non riuscita (HTTP ${r.status})`)
        const b = new Uint8Array(await r.arrayBuffer())
        let s = ''
        for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192))
        return risposta({ ok: true, base64: btoa(s) })
      }

      // elimina: il file va nel cestino di Drive (recuperabile), la riga si cancella
      const t = await drive(token, `https://www.googleapis.com/drive/v3/files/${f.drive_file_id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }),
      })
      if (!t.ok && t.status !== 404) throw new Error(`Drive non ha spostato la foto nel cestino (HTTP ${t.status})`)
      const { error: ed } = await sb.from('appunti_cantiere_foto').delete().eq('id', fotoId)
      if (ed) throw ed
      return risposta({ ok: true })
    }

    return risposta({ ok: false, error: 'azione sconosciuta' }, 400)
  } catch (e) {
    console.error('foto-appunti:', e)
    return risposta({ ok: false, error: (e as Error).message || String(e) }, 500)
  }
})
