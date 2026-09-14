// Supabase Edge Function – upload-pdf
// Salva il PDF del verbale su Google Drive nella cartella verbali di cptpd@
//
// Secrets richiesti:
//   GOOGLE_SERVICE_ACCOUNT_JSON  – service account JSON
//   DRIVE_VERBALI_FOLDER_ID      – ID cartella "Verbali CPT" su Drive di cptpd@

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

import { getAccessToken } from '../_shared/google.ts'
// (audit 05/09/2026: il token Google viene dal modulo condiviso, non piu' copiato qui)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/* ⚠️ CHI PUO' CHIAMARLA (14/09/2026). verify_jwt=true lasciava passare la
   chiave anon, che sta in chiaro nel repository pubblico del gestionale:
   chiunque poteva caricare PDF sul Drive dell'ente con link pubblico. Ora
   serve un utente autenticato del personale (is_personale). Il ruolo lo dice
   il database, eseguito COME l'utente: con la sola anon risponde errore = «no». */
async function nonPersonale(req: Request): Promise<Response | null> {
  const nega = (status: number, error: string) =>
    new Response(JSON.stringify({ ok: false, error }), { status, headers: { 'Content-Type': 'application/json', ...CORS } })
  try {
    const auth = req.headers.get('Authorization') || ''
    if (!auth.startsWith('Bearer ')) return nega(401, 'accesso non autorizzato')
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: u, error: eu } = await sb.auth.getUser()
    if (eu || !u?.user?.email) return nega(401, 'accesso non autorizzato')
    const { data, error } = await sb.rpc('is_personale')
    if (error || data !== true) return nega(403, 'utente non abilitato')
    return null
  } catch {
    return nega(401, 'accesso non autorizzato')
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const no = await nonPersonale(req)
  if (no) return no
  try {
    const SA_JSON   = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    const FOLDER_ID = Deno.env.get('DRIVE_VERBALI_FOLDER_ID')
    if (!SA_JSON)   throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON non configurato')
    if (!FOLDER_ID) throw new Error('DRIVE_VERBALI_FOLDER_ID non configurato')

    const sa    = JSON.parse(SA_JSON)
    const token = await getAccessToken(sa)

    const { pdf_base64, nr_verbale, data_visita, visita_id } = await req.json()
    if (!pdf_base64) throw new Error('pdf_base64 mancante')

    // Nome file: verbale_CPT-2026-0001_20260513.pdf
    const safe  = (nr_verbale || visita_id || 'verbale').replace(/[^a-zA-Z0-9_\-]/g, '-')
    const date  = (data_visita || '').replace(/-/g, '')
    const fileName = `verbale_${safe}${date ? '_' + date : ''}.pdf`

    // Upload multipart su Drive
    const pdfBytes       = Uint8Array.from(atob(pdf_base64), c => c.charCodeAt(0))
    const boundary       = '-------PdfVerbale'
    const metadata       = JSON.stringify({ name: fileName, parents: [FOLDER_ID] })
    const metaPart       = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`
    const dataPart       = `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`
    const endPart        = `\r\n--${boundary}--`
    const metaBytes      = new TextEncoder().encode(metaPart)
    const dataHeadBytes  = new TextEncoder().encode(dataPart)
    const endBytes       = new TextEncoder().encode(endPart)
    const body           = new Uint8Array(metaBytes.length + dataHeadBytes.length + pdfBytes.length + endBytes.length)
    let off = 0
    body.set(metaBytes,     off); off += metaBytes.length
    body.set(dataHeadBytes, off); off += dataHeadBytes.length
    body.set(pdfBytes,      off); off += pdfBytes.length
    body.set(endBytes,      off)

    const upRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':`multipart/related; boundary=${boundary}` }, body }
    )
    const upData = await upRes.json()
    if (!upData.id) throw new Error('Upload Drive fallito: ' + JSON.stringify(upData))

    // Permesso lettura pubblica (per link diretto)
    await fetch(`https://www.googleapis.com/drive/v3/files/${upData.id}/permissions`, {
      method:'POST',
      headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ role:'reader', type:'anyone' }),
    })

    return new Response(JSON.stringify({
      ok: true,
      drive_file_id: upData.id,
      drive_url: upData.webViewLink || `https://drive.google.com/file/d/${upData.id}/view`,
      file_name: fileName,
    }), { headers:{ 'Content-Type':'application/json', ...CORS } })

  } catch(e) {
    console.error('upload-pdf error:', e)
    return new Response(JSON.stringify({ error: e.message }), { status:400, headers:{ 'Content-Type':'application/json', ...CORS } })
  }
})
