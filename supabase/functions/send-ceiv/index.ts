// Supabase Edge Function – send-ceiv
// Invia a CEIV una mail con gli allegati (Excel + PDF) passati in base64 nel body.
// Riusa service account + domain-wide delegation (come send-verbale).
// Secret richiesto: GOOGLE_SERVICE_ACCOUNT_JSON
// Scope DWD richiesto: https://www.googleapis.com/auth/gmail.send
//
// ⚠️ Sorgente portato nel repo il 14/09/2026: fino ad allora viveva solo nel
// deploy (versione 5). La chiama il gestionale (ceivEsportaExcel, riservata al
// coordinatore nell'interfaccia).
//
// ⚠️ CHI PUO' CHIAMARLA (14/09/2026). verify_jwt=true lasciava passare la
// chiave anon, che sta in chiaro nel repository pubblico: chiunque poteva far
// partire dalla casella dell'ente una mail verso un indirizzo e con un testo
// scelti da lui. Ora serve un utente autenticato del personale (is_personale).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/* null = chiamante ammesso; altrimenti la risposta di rifiuto */
async function nonPersonale(req: Request): Promise<Response | null> {
  const nega = (status: number, error: string) =>
    new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json', ...CORS } })
  const auth = req.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return nega(401, 'accesso non autorizzato')
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  /* la chiave anon non ha un utente dietro: qui si ferma */
  const { data: u, error: eu } = await sb.auth.getUser()
  if (eu || !u?.user?.email) return nega(401, 'accesso non autorizzato')
  const { data, error } = await sb.rpc('is_personale')
  if (error || data !== true) return nega(403, 'utente non abilitato')
  return null
}

async function getToken(sa: Record<string, string>, scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    sub: 'cptpd@did.formedilpadova.it',
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }
  const signingInput = `${b64(header)}.${b64(payload)}`
  const pemBody = sa.private_key.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\s/g, '')
  const binKey = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey('pkcs8', binKey.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const jwt = `${signingInput}.${sigB64}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const d = await res.json()
  if (!d.access_token) throw new Error('Token Google non ottenuto: ' + JSON.stringify(d))
  return d.access_token
}

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  bytes.forEach(b => bin += String.fromCharCode(b))
  return btoa(bin)
}
function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
function uint8ToBase64(bytes: Uint8Array): string {
  let bin = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) bin += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  return btoa(bin)
}
function wrapBase64(b64: string, width = 76): string {
  const out: string[] = []
  for (let i = 0; i < b64.length; i += width) out.push(b64.slice(i, i + width))
  return out.join('\r\n')
}

type Att = { name: string; b64: string; mime?: string }

function buildMime(opts: { from: string; to: string[]; cc?: string[]; subject: string; html: string; attachments: Att[] }): string {
  const boundary = `----=_Boundary_${Date.now()}`
  const subjB64 = toBase64Url(utf8ToBase64(opts.subject))
  const htmlB64 = wrapBase64(utf8ToBase64(opts.html))
  const parts: string[] = [
    `MIME-Version: 1.0`,
    `From: Formedil Padova CPT <${opts.from}>`,
    `To: ${opts.to.join(', ')}`,
  ]
  if (opts.cc && opts.cc.length) parts.push(`Cc: ${opts.cc.join(', ')}`)
  parts.push(
    `Subject: =?UTF-8?B?${subjB64}?=`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    htmlB64,
    ``,
  )
  for (const a of opts.attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${a.mime || 'application/octet-stream'}; name="${a.name}"`,
      `Content-Disposition: attachment; filename="${a.name}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      wrapBase64(a.b64.replace(/\s/g, '')),
      ``,
    )
  }
  parts.push(`--${boundary}--`)
  const enc = new TextEncoder().encode(parts.join('\r\n'))
  return toBase64Url(uint8ToBase64(enc))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    /* Prima chi chiama, poi le credenziali Google. */
    const no = await nonPersonale(req)
    if (no) return no

    const SA_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!SA_JSON) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON non configurato')
    const sa = JSON.parse(SA_JSON)

    const { to, cc, subject, html, testo, attachments, periodo, nRighe } = await req.json()
    const toList = Array.isArray(to) ? to : (to ? [to] : [])
    if (!toList.length) throw new Error('Nessun destinatario')
    const atts: Att[] = Array.isArray(attachments) ? attachments : []
    if (!atts.length) throw new Error('Nessun allegato')

    const gmailToken = await getToken(sa, 'https://www.googleapis.com/auth/gmail.send')

    const periodoLabel = periodo || ''
    const bodyHtml = html || `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
  <tr><td style="background:#e7500f;padding:16px 24px"><p style="margin:0;color:#fff;font-size:11px;letter-spacing:1px;text-transform:uppercase">Formedil Padova · Area Sicurezza e Salute</p></td></tr>
  <tr><td style="padding:28px 32px 24px">
    <h2 style="color:#e7500f;font-size:16px;margin:0 0 14px;border-bottom:2px solid #e7500f;padding-bottom:6px">Lista visite cantieri con codice CNCE</h2>
    <p style="line-height:1.7;margin:0 0 12px">In allegato trasmettiamo l'estrazione delle visite effettuate nei cantieri con codice CNCE${periodoLabel ? ` per il periodo <strong>${periodoLabel}</strong>` : ''}${nRighe ? ` (<strong>${nRighe}</strong> visite)` : ''}.</p>
    ${testo ? `<p style="line-height:1.7;margin:0 0 12px;white-space:pre-line">${testo}</p>` : ''}
    <p style="line-height:1.7;margin:0 0 12px">Sono allegati due file: il riepilogo in Excel e la lista in PDF raggruppata per codice cantiere.</p>
    <p style="margin:18px 0 0">Cordiali saluti,<br><strong>Area Sicurezza e Salute – Formedil Padova</strong></p>
  </td></tr>
</table></td></tr></table></body></html>`

    const subjectFinal = subject || `Lista visite cantieri CNCE${periodoLabel ? ' – ' + periodoLabel : ''}`

    const raw = buildMime({
      from: 'cptpd@did.formedilpadova.it',
      to: toList,
      cc: Array.isArray(cc) ? cc : (cc ? [cc] : []),
      subject: subjectFinal,
      html: bodyHtml,
      attachments: atts,
    })

    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      { method: 'POST', headers: { Authorization: `Bearer ${gmailToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw }) })
    const gmailData = await gmailRes.json()
    if (!gmailRes.ok || gmailData.error) throw new Error(gmailData.error?.message || JSON.stringify(gmailData))

    return new Response(JSON.stringify({ ok: true, messageId: gmailData.id }), { headers: { 'Content-Type': 'application/json', ...CORS } })
  } catch (e) {
    console.error('send-ceiv error:', e)
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } })
  }
})
