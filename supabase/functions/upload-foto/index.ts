// Supabase Edge Function – upload-foto
// Carica una foto del verbale su Google Drive nella cartella condivisa di cptpd@did.formedilpadova.it
//
// Secrets richiesti:
//   GOOGLE_SERVICE_ACCOUNT_JSON  – il JSON del service account (dal pannello Supabase)
//   DRIVE_FOLDER_ID              – ID della cartella "Foto Verbali CPT" condivisa con il service account

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── JWT per Service Account Google ──────────────────────────────────────────
async function getAccessToken(sa: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    sub: 'cptpd@did.formedilpadova.it',   // impersona l'account cptpd (domain-wide delegation)
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const signingInput = `${b64(header)}.${b64(payload)}`

  // Importa la chiave privata RSA
  const pemBody = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const binaryKey = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(signingInput)
  )
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const jwt = `${signingInput}.${sigB64}`

  // Scambia JWT per access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) throw new Error('Token Google non ottenuto: ' + JSON.stringify(tokenData))
  return tokenData.access_token
}

// ── Handler principale ───────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Leggi secrets
    const SA_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!SA_JSON) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON non configurato')
    const FOLDER_ID = Deno.env.get('DRIVE_FOLDER_ID')
    if (!FOLDER_ID) throw new Error('DRIVE_FOLDER_ID non configurato')

    const sa = JSON.parse(SA_JSON)

    // Leggi il body una sola volta
    const body = await req.json()

    // ── Modalità DOWNLOAD ─────────────────────────────────────────────────────
    // Chiamata con { download: true, file_id: '...' } → restituisce la foto come base64
    // Usato da genPDF per recuperare le foto già caricate su Drive
    if (body.download && body.file_id) {
      const token = await getAccessToken(sa)
      const dlRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${body.file_id}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!dlRes.ok) throw new Error(`Download Drive fallito: HTTP ${dlRes.status}`)
      const buffer = await dlRes.arrayBuffer()
      // Converte in base64 a blocchi per evitare stack overflow su file grandi
      const bytes = new Uint8Array(buffer)
      let b64 = ''
      const CHUNK = 8192
      for (let i = 0; i < bytes.length; i += CHUNK) {
        b64 += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
      }
      return new Response(JSON.stringify({ ok: true, base64: btoa(b64) }), {
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // ── Modalità UPLOAD (comportamento originale) ─────────────────────────────
    const token = await getAccessToken(sa)
    const { visita_id, nr_verbale, tipo, nome_file, mime_type, image_base64 } = body
    if (!image_base64) throw new Error('image_base64 mancante')

    // Nome file: verbale_{nr_verbale}_{tipo}_{timestamp}.jpg
    const ts = Date.now()
    const safeName = (nr_verbale || visita_id || 'visita').toString().replace(/[^a-zA-Z0-9_\-]/g, '-')
    const fileName = nome_file || `verbale_${safeName}_${tipo}_${ts}.jpg`

    // ── Sottocartella per verbale ─────────────────────────────────────────
    // Cerca se esiste già una sottocartella con questo nr_verbale
    let subFolderId: string | null = null
    if (nr_verbale) {
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=` +
        encodeURIComponent(`name='${safeName}' and '${FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`) +
        `&fields=files(id,name)`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const searchData = await searchRes.json()
      if (searchData.files?.length) {
        subFolderId = searchData.files[0].id
      } else {
        // Crea la sottocartella
        const mkRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: safeName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [FOLDER_ID],
          }),
        })
        const mkData = await mkRes.json()
        subFolderId = mkData.id || null
      }
    }

    const parentId = subFolderId || FOLDER_ID

    // ── Upload file su Drive (multipart) ──────────────────────────────────
    const imageBytes = Uint8Array.from(atob(image_base64), c => c.charCodeAt(0))
    const boundary = '-------FotoVerbale'
    const mimeType2 = mime_type || 'image/jpeg'

    const metadata = JSON.stringify({ name: fileName, parents: [parentId] })
    const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`
    const dataPart = `--${boundary}\r\nContent-Type: ${mimeType2}\r\n\r\n`
    const endPart  = `\r\n--${boundary}--`

    const metaBytes = new TextEncoder().encode(metaPart)
    const dataHeaderBytes = new TextEncoder().encode(dataPart)
    const endBytes  = new TextEncoder().encode(endPart)

    const uploadBody = new Uint8Array(metaBytes.length + dataHeaderBytes.length + imageBytes.length + endBytes.length)
    let offset = 0
    uploadBody.set(metaBytes, offset);       offset += metaBytes.length
    uploadBody.set(dataHeaderBytes, offset); offset += dataHeaderBytes.length
    uploadBody.set(imageBytes, offset);      offset += imageBytes.length
    uploadBody.set(endBytes, offset)

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,thumbnailLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: uploadBody,
      }
    )
    const uploadData = await uploadRes.json()
    if (!uploadData.id) throw new Error('Upload Drive fallito: ' + JSON.stringify(uploadData))

    // Rende il file leggibile a chiunque abbia il link (per anteprima nel gestionale)
    await fetch(`https://www.googleapis.com/drive/v3/files/${uploadData.id}/permissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    })

    const driveUrl  = uploadData.webViewLink || `https://drive.google.com/file/d/${uploadData.id}/view`
    const thumbUrl  = uploadData.thumbnailLink?.replace('=s220', '=s400') || null

    return new Response(JSON.stringify({
      ok: true,
      drive_file_id: uploadData.id,
      drive_url: driveUrl,
      thumb_url: thumbUrl,
    }), { headers: { 'Content-Type': 'application/json', ...CORS } })

  } catch (e) {
    console.error('upload-foto error:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
