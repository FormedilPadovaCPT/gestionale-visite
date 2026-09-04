// Supabase Edge Function – send-relazione-stage
//
// ARCHIVIA E INVIA LA RELAZIONE DI VISITA ALLO STAGISTA.
//
// Il tecnico la attiva dal gestionale come fa con il verbale di
// cantiere: la funzione deposita il PDF nella cartella del vault
// (s_config.stage_relazione_cartella) e manda la mail con Gmail.
//
// Rispetto a send-verbale il PDF viaggia qui nel body: la relazione
// e' un foglio solo (~12 KB) e non serve il passaggio separato da
// upload-pdf, che invece per i verbali con le foto e' obbligato.
//
// Destinatari: il referente della didattica scelto dal tecnico, con
// l'ufficio in copia (s_config.stage_relazione_cc) e il tecnico
// stesso, che deve avere in mano quello che ha mandato.
//
// Secret: GOOGLE_SERVICE_ACCOUNT_JSON (lo stesso di send-verbale)
// Scope DWD: gmail.send, drive

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getToken(sa: Record<string, string>, scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payload = {
    iss: sa.client_email,
    sub: 'cptpd@did.formedilpadova.it',
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }
  const signingInput = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(payload)}`
  const pemBody = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\s/g, '')
  const binKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binKey.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${signingInput}.${sigB64}`,
  })
  const d = await res.json()
  if (!d.access_token) throw new Error('Token Google non ottenuto: ' + JSON.stringify(d))
  return d.access_token
}

const utf8ToBase64 = (s: string) => {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  bytes.forEach((b) => { bin += String.fromCharCode(b) })
  return btoa(bin)
}
const toBase64Url = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
const wrapBase64 = (b64: string, w = 76) => {
  const out: string[] = []
  for (let i = 0; i < b64.length; i += w) out.push(b64.slice(i, i + w))
  return out.join('\r\n')
}
const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* La cartella del vault, per percorso: cosi' si sposta senza toccare
   la funzione. Le cartelle si cercano per nome dentro il padre. */
async function risolviCartella(token: string, percorso: string): Promise<string | null> {
  let padre: string | null = null
  for (const nome of percorso.split('/').map((s) => s.trim()).filter(Boolean)) {
    const q = `name='${nome.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
      + (padre ? ` and '${padre}' in parents` : '')
    const u = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q)
      + '&fields=files(id,name)&pageSize=5&supportsAllDrives=true&includeItemsFromAllDrives=true'
    const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } })
    const d = await r.json()
    const trovata = d.files?.[0]?.id
    if (!trovata) return null
    padre = trovata
  }
  return padre
}

/* Le relazioni si raccolgono per ANNO FORMATIVO (settembre-agosto), non
   per anno solare: uno stage a cavallo di gennaio appartiene all'anno
   scolastico in cui e' cominciato, ed e' cosi' che la didattica lo cerca. */
function annoFormativo(dataIso: string): string {
  const d = new Date(dataIso || Date.now())
  const a = d.getFullYear()
  return d.getMonth() >= 8 ? `${a}-${a + 1}` : `${a - 1}-${a}`
}

async function creaCartella(token: string, padre: string, nome: string): Promise<string> {
  const q = `name='${nome}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${padre}' in parents`
  const u = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q)
    + '&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true'
  const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } })
  const d = await r.json()
  if (d.files?.[0]?.id) return d.files[0].id
  const c = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nome, mimeType: 'application/vnd.google-apps.folder', parents: [padre] }),
  })
  const cd = await c.json()
  if (!cd.id) throw new Error('Cartella non creata: ' + JSON.stringify(cd).slice(0, 200))
  return cd.id
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const SA_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    const SUPA = Deno.env.get('SUPABASE_URL')
    const SRV = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SA_JSON) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON non configurato')
    if (!SUPA || !SRV) throw new Error('Chiavi Supabase non disponibili nella funzione')
    const sa = JSON.parse(SA_JSON)

    const b = await req.json()
    const { pdf_base64, nome_file, visita_stage_id, dati } = b
    if (!pdf_base64) throw new Error('pdf_base64 mancante')
    if (!dati?.richiedente_email) throw new Error('Manca il destinatario')

    const db = async (rotta: string, init?: RequestInit) => {
      const r = await fetch(`${SUPA}/rest/v1/${rotta}`, {
        ...init,
        headers: {
          apikey: SRV, Authorization: `Bearer ${SRV}`,
          'Content-Type': 'application/json', Prefer: 'return=representation',
          ...(init?.headers || {}),
        },
      })
      const t = await r.text()
      if (!r.ok) throw new Error('Database: ' + t.slice(0, 300))
      return t ? JSON.parse(t) : []
    }

    const cfg = Object.fromEntries(((await db(
      's_config?chiave=in.(stage_relazione_cc,stage_relazione_cartella)&select=chiave,valore',
    )) as { chiave: string; valore: string }[]).map((r) => [r.chiave, r.valore]))

    const [gmail, drive] = await Promise.all([
      getToken(sa, 'https://www.googleapis.com/auth/gmail.send'),
      getToken(sa, 'https://www.googleapis.com/auth/drive'),
    ])

    /* ── archivio nel vault ── */
    let driveId: string | null = null
    let driveUrl: string | null = null
    const percorso = cfg.stage_relazione_cartella || '2_AREE/Sopralluoghi/visite_stage'
    try {
      const base = await risolviCartella(drive, percorso)
      if (base) {
        const sub = await creaCartella(drive, base, annoFormativo(dati.data))
        const meta = JSON.stringify({ name: nome_file, parents: [sub] })
        const conf = '-----=b\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta
          + '\r\n-----=b\r\nContent-Type: application/pdf\r\nContent-Transfer-Encoding: base64\r\n\r\n'
          + pdf_base64 + '\r\n-----=b--'
        const up = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true', {
            method: 'POST',
            headers: { Authorization: `Bearer ${drive}`, 'Content-Type': 'multipart/related; boundary="---=b"' },
            body: conf,
          })
        const ud = await up.json()
        driveId = ud.id || null
        driveUrl = ud.webViewLink || (ud.id ? `https://drive.google.com/file/d/${ud.id}/view` : null)
      } else {
        console.warn('cartella non trovata nel vault:', percorso)
      }
    } catch (e) {
      /* se l'archivio non riesce la mail parte lo stesso: il documento
         non deve restare fermo per un problema di cartella */
      console.warn('archivio su Drive non riuscito:', e)
    }

    /* ── la mail ── */
    const dIt = (s: string) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '')
    const dest = [dati.richiedente_email]
    const cc = [cfg.stage_relazione_cc, dati.tecnico_email].filter(Boolean)
    const oggetto = `FORMEDIL PADOVA - Area Sicurezza e Salute - Relazione visita allo stagista `
      + `${dati.stagista || ''} presso ${dati.azienda || ''}`
      + (dati.richiedente ? ` - alla c.a. ${dati.richiedente}` : '')

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333">
      <p>Gent.ma ${esc(dati.richiedente || '')},</p>
      <p>in allegato la relazione della visita effettuata il <strong>${esc(dIt(dati.data))}</strong>
      allo stagista <strong>${esc(dati.stagista || '')}</strong> presso
      <strong>${esc(dati.azienda || '')}</strong>${dati.comune ? ' di ' + esc(dati.comune) : ''}.</p>
      ${dati.periodo_stage ? `<p>Periodo di stage: ${esc(dati.periodo_stage)}.</p>` : ''}
      <p>Cordiali saluti,<br>${esc(dati.tecnico || 'Area Sicurezza e Salute')}<br>
      <span style="color:#e7500f;font-weight:bold">CPT — Area Sicurezza e Salute</span><br>
      Formedil Padova — Scuola Costruzioni Giuseppe Jappelli</p>
      ${driveUrl ? `<p style="font-size:12px;color:#888">Copia archiviata in ${esc(percorso)}.</p>` : ''}
    </div>`

    const boundary = `----=_B_${Date.now()}`
    const mime = [
      'MIME-Version: 1.0',
      `From: Formedil Padova CPT <cptpd@did.formedilpadova.it>`,
      `To: ${dest.join(', ')}`,
      cc.length ? `Cc: ${cc.join(', ')}` : '',
      `Subject: =?UTF-8?B?${toBase64Url(utf8ToBase64(oggetto))}?=`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      wrapBase64(utf8ToBase64(html)),
      '',
      `--${boundary}`,
      'Content-Type: application/pdf',
      `Content-Disposition: attachment; filename="${nome_file}"`,
      'Content-Transfer-Encoding: base64',
      '',
      wrapBase64(pdf_base64.replace(/\s/g, '')),
      '',
      `--${boundary}--`,
    ].filter((r) => r !== '').join('\r\n')

    const inviata = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${gmail}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: toBase64Url(utf8ToBase64(mime)) }),
    })
    const esitoMail = await inviata.json()
    if (!inviata.ok) throw new Error('Invio non riuscito: ' + JSON.stringify(esitoMail).slice(0, 300))

    if (visita_stage_id) {
      await db(`s_visite_stage?id=eq.${visita_stage_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          relazione_drive_id: driveId, relazione_drive_url: driveUrl,
          relazione_inviata_il: new Date().toISOString(),
        }),
        headers: { Prefer: 'return=minimal' },
      })
    }

    return new Response(JSON.stringify({
      ok: true, drive_file_id: driveId, drive_url: driveUrl,
      destinatari: dest, cc, archiviata: !!driveId, cartella: percorso,
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message || e) }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
