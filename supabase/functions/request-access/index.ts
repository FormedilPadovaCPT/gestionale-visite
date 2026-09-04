// Supabase Edge Function – request-access
// Riceve una richiesta di accesso (sola lettura dashboard) da un consigliere,
// la registra in public.richieste_accesso e invia una notifica email alla segreteria
// (cpt@formedilpadova.it) tramite service account Gmail (DWD), come send-verbale.
//
// Pubblica: verify_jwt = false (il richiedente non ha ancora un account).
// Anti-spam: dedup per email (una sola richiesta in_attesa) + cap globale 10 min.
// Secret richiesto: GOOGLE_SERVICE_ACCOUNT_JSON (gia' configurato per send-verbale)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Cap: numero massimo di nuove richieste accettate globalmente negli ultimi RATE_WINDOW_MIN minuti
const RATE_MAX = 5
const RATE_WINDOW_MIN = 10

async function getToken(sa: Record<string, string>, scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
  const header  = { alg:'RS256', typ:'JWT' }
  const payload = {
    iss: sa.client_email,
    sub: 'cptpd@did.formedilpadova.it',
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }
  const signingInput = `${b64(header)}.${b64(payload)}`
  const pemBody  = sa.private_key.replace('-----BEGIN PRIVATE KEY-----','').replace('-----END PRIVATE KEY-----','').replace(/\s/g,'')
  const binKey   = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
  const cryptoKey= await crypto.subtle.importKey('pkcs8', binKey.buffer, { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' }, false, ['sign'])
  const sig      = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput))
  const sigB64   = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
  const jwt      = `${signingInput}.${sigB64}`
  const res      = await fetch('https://oauth2.googleapis.com/token', {
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:`grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const d = await res.json()
  if (!d.access_token) throw new Error('Token Google non ottenuto: ' + JSON.stringify(d))
  return d.access_token
}

function b64urlBytes(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
}
function b64urlUtf8(s: string): string {
  return b64urlBytes(new TextEncoder().encode(s))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { email, nome } = await req.json()
    const emailOk = typeof email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
    if (!emailOk) throw new Error('Email non valida')
    const nomeSafe = (typeof nome === 'string' ? nome : '').slice(0, 120)
    const emailNorm = email.trim().toLowerCase()

    const SB_URL = Deno.env.get('SUPABASE_URL')
    const SRK    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // ── Anti-spam (service role: bypassa RLS) ─────────────────────────────────
    if (SB_URL && SRK) {
      const hdr = { apikey: SRK, Authorization: `Bearer ${SRK}` }

      // a) dedup: se esiste già una richiesta in_attesa per questa email, non re-inserisco né rimando l'email
      const dupRes = await fetch(
        `${SB_URL}/rest/v1/richieste_accesso?select=id&stato=eq.in_attesa&email=ilike.${encodeURIComponent(emailNorm)}`,
        { headers: hdr }
      )
      const dup = await dupRes.json().catch(() => [])
      if (Array.isArray(dup) && dup.length > 0) {
        return new Response(JSON.stringify({ ok: true, already: true }),
          { headers: { 'Content-Type': 'application/json', ...CORS } })
      }

      // b) cap globale: max RATE_MAX richieste negli ultimi RATE_WINDOW_MIN minuti
      const since = new Date(Date.now() - RATE_WINDOW_MIN * 60 * 1000).toISOString()
      const cntRes = await fetch(
        `${SB_URL}/rest/v1/richieste_accesso?select=id&created_at=gte.${since}`,
        { headers: { ...hdr, Prefer: 'count=exact' } }
      )
      const cnt = await cntRes.json().catch(() => [])
      if (Array.isArray(cnt) && cnt.length >= RATE_MAX) {
        return new Response(JSON.stringify({ ok: false, error: 'Troppe richieste in questo momento. Riprova tra qualche minuto.' }),
          { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } })
      }

      // 1) Registra la richiesta
      await fetch(`${SB_URL}/rest/v1/richieste_accesso`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', apikey:SRK, Authorization:`Bearer ${SRK}`, Prefer:'return=minimal' },
        body: JSON.stringify({ email: emailNorm, nome: nomeSafe || null, ruolo_richiesto:'viewer', stato:'in_attesa' })
      }).catch(e => console.warn('insert richiesta:', e))
    }

    // 2) Notifica email alla segreteria
    const SA_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (SA_JSON) {
      const sa = JSON.parse(SA_JSON)
      const token = await getToken(sa, 'https://www.googleapis.com/auth/gmail.send')
      const subject = `Richiesta accesso dashboard – ${nomeSafe || email}`
      const html =
        `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333">`
        + `<p>È pervenuta una nuova <strong>richiesta di accesso alla dashboard</strong> (sola lettura):</p>`
        + `<ul><li><strong>Nome:</strong> ${nomeSafe || '–'}</li><li><strong>Email:</strong> ${email}</li></ul>`
        + `<p style="color:#666">Per abilitarla: creare l'account e aggiungerlo come <code>viewer</code> in <code>app_ruoli</code>.</p>`
        + `</div>`
      const mime = [
        `MIME-Version: 1.0`,
        `From: Gestionale Visite <cptpd@did.formedilpadova.it>`,
        `To: cpt@formedilpadova.it`,
        `Reply-To: ${email}`,
        `Subject: =?UTF-8?B?${b64urlUtf8(subject)}?=`,
        `Content-Type: text/html; charset=UTF-8`,
        ``,
        html,
      ].join('\r\n')
      const raw = b64urlBytes(new TextEncoder().encode(mime))
      const gmailRes = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ raw }) }
      )
      const gd = await gmailRes.json()
      if (!gmailRes.ok || gd.error) console.warn('gmail send:', JSON.stringify(gd))
    }

    return new Response(JSON.stringify({ ok:true }), { headers:{ 'Content-Type':'application/json', ...CORS } })
  } catch (e) {
    console.error('request-access error:', e)
    return new Response(JSON.stringify({ error: e.message }), { status:400, headers:{ 'Content-Type':'application/json', ...CORS } })
  }
})
