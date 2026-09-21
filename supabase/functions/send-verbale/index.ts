// Supabase Edge Function – send-verbale
// Scarica il PDF da Google Drive (tramite driveFileId) e lo invia via Gmail API
// con service account + domain-wide delegation. Nessun payload PDF nel body.
// v21: blocco opzionale "campagna" (titolo, testo, immagini, link) prima della firma.
// v22: modalità "rettifica" – corpo email dedicato che comunica la sostituzione
//      di un verbale già trasmesso (dataPrimoInvio, modifiche[], note).
// 14/09/2026: CHI PUO' CHIAMARLA. verify_jwt=true lasciava passare la chiave
//      anon, che sta in chiaro nel repository pubblico del gestionale: chiunque
//      poteva far partire dalla casella dell'ente una mail verso un indirizzo
//      scelto da lui, con allegato un file qualunque del Drive letto per id.
//      Ora serve un utente autenticato del personale (is_personale).
//
// Secret richiesto: GOOGLE_SERVICE_ACCOUNT_JSON
// Scopes DWD richiesti:
//   https://www.googleapis.com/auth/gmail.send
//   https://www.googleapis.com/auth/drive

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/* null = chiamante ammesso; altrimenti la risposta di rifiuto. Il ruolo lo
   dice il database, eseguito COME l'utente: con la sola anon risponde errore = «no». */
async function nonPersonale(req: Request): Promise<Response | null> {
  const nega = (status: number, error: string) =>
    new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json', ...CORS } })
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

// ── JWT / access token ───────────────────────────
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

// ── Uint8Array → base64 (chunked, sicuro per file grandi) ──────────────
function uint8ToBase64(bytes: Uint8Array): string {
  let bin = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(bin)
}

// ── Codifica UTF-8 → base64 ──────────────────────────
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  bytes.forEach(b => bin += String.fromCharCode(b))
  return btoa(bin)
}
function toBase64Url(b64: string): string {
  return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
}

// ── Spezza base64 a 76 char/riga (RFC 2045 MIME) ─────────────────
function wrapBase64(b64: string, width = 76): string {
  const out: string[] = []
  for (let i = 0; i < b64.length; i += width) out.push(b64.slice(i, i + width))
  return out.join('\r\n')
}

// ── Costruisce messaggio MIME raw (chunked btoa per file grandi) ──────────
function buildMime(opts: {
  from: string, to: string[], subject: string,
  html: string, attachmentB64: string, attachmentName: string
}): string {
  const boundary = `----=_Boundary_${Date.now()}`
  const subjB64 = toBase64Url(utf8ToBase64(opts.subject))
  const htmlB64 = wrapBase64(utf8ToBase64(opts.html))
  const pdfB64  = wrapBase64(opts.attachmentB64.replace(/\s/g, ''))

  const mimeRaw = [
    `MIME-Version: 1.0`,
    `From: Formedil Padova CPT <${opts.from}>`,
    `To: ${opts.to.join(', ')}`,
    `Subject: =?UTF-8?B?${subjB64}?=`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    htmlB64,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf`,
    `Content-Disposition: attachment; filename="${opts.attachmentName}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    pdfB64,
    ``,
    `--${boundary}--`,
  ].join('\r\n')

  // btoa chunked per stringhe molto lunghe
  const enc = new TextEncoder().encode(mimeRaw)
  const b64 = uint8ToBase64(enc)
  return toBase64Url(b64)
}

// ── Handler ─────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    /* Prima chi chiama, poi le credenziali Google. */
    const no = await nonPersonale(req)
    if (no) return no

    const SA_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!SA_JSON) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON non configurato')
    const sa = JSON.parse(SA_JSON)

    const { to, subject, nrVerbale, cantiere, impresa, tecnico, tecnico2, comune, cantIndirizzo, dataVisita, driveFileId, fileName, campagna, rettifica, linkValuta } = await req.json()
    if (!to?.length)   throw new Error('Nessun destinatario')
    if (!driveFileId)  throw new Error('driveFileId mancante')

    // Token Gmail e Drive in parallelo
    const [gmailToken, driveToken] = await Promise.all([
      getToken(sa, 'https://www.googleapis.com/auth/gmail.send'),
      getToken(sa, 'https://www.googleapis.com/auth/drive'),
    ])

    // Scarica PDF da Drive
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
      { headers: { Authorization: `Bearer ${driveToken}` } }
    )
    if (!driveRes.ok) {
      const errTxt = await driveRes.text()
      throw new Error(`Fetch PDF da Drive fallito: HTTP ${driveRes.status} – ${errTxt.slice(0,200)}`)
    }
    const pdfBytes = new Uint8Array(await driveRes.arrayBuffer())
    const b64 = uint8ToBase64(pdfBytes)

    const attachmentName = fileName || `verbale_${(nrVerbale||'sopralluogo').replace(/\//g,'-')}.pdf`

    // ── Modalità rettifica ──
    const isRett = !!(rettifica && (rettifica.dataPrimoInvio || (rettifica.modifiche||[]).length || rettifica.note))
    const esc = (s: unknown) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

    const subjectFinal = subject || `${isRett ? 'RETTIFICA verbale - ' : ''}Cantiere di ${cantIndirizzo||cantiere||''} ${nrVerbale||''}`.trim()

    const comuneLabel    = [cantIndirizzo, comune].filter(Boolean).join(' – ') || comune || cantiere || ''
    const impresaLabel   = impresa     || ''
    const tecnicoLabel   = tecnico     || ''
    const tecnico2Label  = tecnico2    || ''
    const dataLabel      = dataVisita  || ''
    // Gestione singolare/plurale in base alla presenza del secondo tecnico
    const dueTecnici     = !!(tecnicoLabel && tecnico2Label)
    const verbPassato    = dueTecnici ? 'sono passati' : 'è passato'
    const verbPassatoAlt = dueTecnici ? 'Sono passati'  : 'È passato'
    const tecSoggetto    = dueTecnici ? 'i nostri tecnici' : 'uno dei nostri tecnici'
    const tecNomiStr     = dueTecnici
      ? `, <strong>${tecnicoLabel}</strong> e <strong>${tecnico2Label}</strong>`
      : (tecnicoLabel ? `, <strong>${tecnicoLabel}</strong>` : '')

    // ── Blocco campagna informativa (opzionale, escluso in rettifica) ──
    let campagnaHtml = ''
    if (!isRett && campagna && (campagna.titolo || campagna.testo || campagna.img1_url || campagna.img2_url)) {
      const links = [
        campagna.link1_url ? `<a href="${campagna.link1_url}" style="color:#2563eb;text-decoration:underline;margin:0 12px">${campagna.link1_label || campagna.link1_url}</a>` : '',
        campagna.link2_url ? `<a href="${campagna.link2_url}" style="color:#2563eb;text-decoration:underline;margin:0 12px">${campagna.link2_label || campagna.link2_url}</a>` : '',
      ].filter(Boolean).join('')
      campagnaHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;border:2px solid #e7500f;border-radius:8px">
    <tr><td style="padding:16px 18px">
      ${campagna.titolo ? `<h3 style="color:#e7500f;font-size:15px;margin:0 0 8px">${campagna.titolo}</h3>` : ''}
      ${campagna.testo ? `<p style="line-height:1.6;margin:0 0 12px;white-space:pre-line">${campagna.testo}</p>` : ''}
      ${campagna.img1_url ? `<img src="${campagna.img1_url}" width="536" alt="" style="display:block;width:100%;max-width:536px;height:auto;border:0;margin:0 0 10px">` : ''}
      ${campagna.img2_url ? `<img src="${campagna.img2_url}" width="536" alt="" style="display:block;width:100%;max-width:536px;height:auto;border:0;margin:0 0 10px">` : ''}
      ${links ? `<p style="margin:6px 0 0;text-align:center">${links}</p>` : ''}
    </td></tr>
    </table>`
    }

    /* ── «Com'è andata la visita?» (18/09/2026) ──────────────────────────
       Il questionario esisteva da sempre nel portale e non lo compilava
       nessuno: nel gestionale la parola «questionario» non compariva da
       nessuna parte, quindi lo trovava solo chi entrava nel portale e lo
       cercava. Il link arriva firmato da questionario_link e porta con sé la
       visita, così la risposta si sa sempre a quale sopralluogo si riferisce.
       ⚠️ Non in rettifica: una rettifica è un errore nostro, e chiedere lì
       «com'è andata» stonerebbe.

       Il pulsante (21/09/2026) ha il RILIEVO fatto con un bordo inferiore
       pieno, non con un'ombra: Outlook per Windows disegna le mail col motore
       di Word e le ombre le ignora. Sotto c'è sempre l'indirizzo scritto,
       perché qualche programma di posta blocca i link nei riquadri colorati.
       ⚠️ È la stessa forma di bloccoAzioneMail() in segreteria-app/js/firma.js,
       ricopiata a mano: questa funzione sta in un altro repo e non può
       importare da lì. Se cambia una, va cambiata anche l'altra. */
    const linkOk = typeof linkValuta === 'string' && /^https:\/\//.test(linkValuta) && linkValuta.length < 500
    const valutaHtml = (!isRett && linkOk) ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 26px">
    <tr><td style="background:#faf8f4;border:1px solid #e2dfd6;border-radius:8px;padding:18px 20px">
      <p style="margin:0 0 5px;font-size:15px;font-weight:bold;color:#333">Com'è andata la visita?</p>
      <p style="margin:0 0 15px;line-height:1.6;color:#555">Un minuto del Vostro tempo ci aiuta a fare meglio il prossimo sopralluogo. Le risposte servono solo a noi e non vengono comunicate a nessuno.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" bgcolor="#e7500f" style="background:#e7500f;border-radius:6px;border-bottom:3px solid #a83a0b">
        <a href="${linkValuta}" style="display:inline-block;padding:13px 26px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none">Valuta la visita &rarr;</a>
      </td></tr></table>
      <p style="margin:12px 0 0;font-size:12px;line-height:17px;color:#8a9099">Se il pulsante non si apre, copiate questo indirizzo nel browser:<br><a href="${linkValuta}" style="color:#e7500f">${linkValuta}</a></p>
    </td></tr>
    </table>` : ''

    // ── Corpo lettera: standard oppure rettifica ──
    let corpoHtml = ''
    if (isRett) {
      const mods = (rettifica.modifiche || []).map((m: string) => `<li style="margin:0 0 6px">${esc(m)}</li>`).join('')
      corpoHtml = `
    <p style="line-height:1.7;margin:0 0 14px">Con la presente Vi comunichiamo che il verbale ${nrVerbale ? `n. <strong>${esc(nrVerbale)}</strong> ` : ''}relativo alla visita effettuata${dataLabel ? ` il <strong>${esc(dataLabel)}</strong>` : ''} nel cantiere in oggetto, già trasmesso${rettifica.dataPrimoInvio ? ` in data <strong>${esc(rettifica.dataPrimoInvio)}</strong>` : ''}, è stato <strong style="color:#e7500f">rettificato</strong>.</p>
    ${mods ? `<p style="margin:0 0 6px"><strong>Modifiche apportate:</strong></p><ul style="margin:0 0 14px 18px;line-height:1.7;padding:0">${mods}</ul>` : ''}
    ${rettifica.note ? `<p style="line-height:1.7;margin:0 0 14px"><strong>Note:</strong> ${esc(rettifica.note)}</p>` : ''}
    <p style="line-height:1.7;margin:0 0 14px">Vi trasmettiamo in allegato il verbale rettificato, che <strong>sostituisce integralmente</strong> quello precedentemente inviato, da ritenersi privo di validità.</p>
    <p style="line-height:1.7;margin:0 0 14px">Ci scusiamo per l'inconveniente e rimaniamo a disposizione per ogni eventuale chiarimento.</p>
    <p style="margin:0 0 24px">Distinti saluti.</p>`
    } else {
      corpoHtml = `
    <p style="line-height:1.7;margin:0 0 14px">
      ${dataLabel ? `Il giorno <strong>${dataLabel}</strong> ${verbPassato}` : verbPassatoAlt} nel vostro cantiere in oggetto, per fornirvi utili consigli in materia di prevenzione infortuni, ${tecSoggetto}${tecNomiStr}.
    </p>
    <p style="line-height:1.7;margin:0 0 14px">${dueTecnici ? 'Essi si sono soffermati' : 'Egli si è soffermato'} ad illustrare al Vostro personale in cantiere le più importanti norme che devono essere tenute presenti per garantire la sicurezza durante le varie fasi lavorative, con particolare riferimento a quelle in corso.</p>
    <p style="line-height:1.7;margin:0 0 14px">In base a quanto previsto dalle norme che regolano il funzionamento dello scrivente Comitato Paritetico Territoriale, potrà essere effettuata entro breve termine una successiva visita, per constatare che i consigli forniti siano stati correttamente attuati.</p>
    <p style="line-height:1.7;margin:0 0 14px">Vi trasmettiamo in allegato il rapporto di visita redatto ${dueTecnici ? 'dai nostri Tecnici' : 'dal nostro Tecnico'} in cantiere.</p>
    <p style="line-height:1.7;margin:0 0 14px">Evidenziamo che la consulenza che è stata resa alla Vostra impresa è per Voi totalmente gratuita, grazie al contributo versato da imprese e lavoratori iscritti a C.E.I.V.</p>
    <p style="line-height:1.7;margin:0 0 20px">L'iscrizione a C.E.I.V. offre molti altri vantaggi, come ad esempio la possibilità di accedere alla formazione obbligatoria ex D.Lgs 81/2008, che Formedil Padova offre a tariffe agevolate.</p>
    <p style="margin:0 0 24px">Rimanendo a disposizione per ogni eventuale chiarimento porgiamo distinti saluti.</p>`
    }

    const htmlBody = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:6px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">

  <!-- HEADER arancione -->
  <tr><td style="background:#e7500f;padding:16px 24px">
    <p style="margin:0;color:#ffffff;font-size:11px;letter-spacing:1px;text-transform:uppercase">Formedil Padova · Area Sicurezza e Salute</p>
  </td></tr>

  <!-- BANNER cantieri con link ai servizi -->
  <tr><td style="padding:0;line-height:0">
    <a href="https://formedilpadovacpt.github.io/servizi/" style="display:block;text-decoration:none">
      <img src="https://utdantrfugnmqsuujxbe.supabase.co/storage/v1/object/sign/firme-tecnici/Banner%20mail%20cantieri.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9mNTBkZTA3NS02NDYwLTRkYzEtYjcwMy04ODBiMTY2ZDk5YTEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJmaXJtZS10ZWNuaWNpL0Jhbm5lciBtYWlsIGNhbnRpZXJpLnBuZyIsImlhdCI6MTc3OTA0NzUxNCwiZXhwIjoxOTY4MjYzNTE0fQ.d0vkp_LZAWs3yMzD0ZNnQgjCifM8GqRKjQSiqYcjens"
           width="600" alt="Formedil Padova – Area Sicurezza e Salute" style="display:block;width:100%;max-width:600px;height:auto;border:0">
    </a>
  </td></tr>

  <!-- CORPO -->
  <tr><td style="padding:28px 32px 20px">
    <p style="margin:0 0 6px">Spett.le impresa${impresaLabel ? `<br><strong>${impresaLabel}</strong>` : ''}</p>

    <h2 style="color:#e7500f;font-size:16px;margin:20px 0 6px;border-bottom:2px solid #e7500f;padding-bottom:6px">Prevenzione Infortuni${isRett ? ' – RETTIFICA VERBALE' : ''}</h2>

    <p style="color:#666;font-size:13px;margin:0 0 18px;line-height:1.6">
      Alla cortese attenzione del<br>
      <em>Responsabile del Servizio di Prevenzione e Protezione</em><br>
      e/o del<br>
      <em>Coordinatore per la Sicurezza</em>
    </p>

    ${comuneLabel ? `<p style="font-weight:bold;margin:0 0 16px">Cantiere di ${comuneLabel}</p>` : ''}

    ${corpoHtml}
    ${valutaHtml}

    ${campagnaHtml}

    <!-- FIRMA -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #e7500f;padding-top:16px;margin-top:4px">
    <tr>
      <td style="vertical-align:top;padding-right:16px">
        <p style="margin:0 0 3px;font-weight:bold;font-size:15px">Renato Squizzato</p>
        <p style="margin:0 0 14px;color:#e7500f;font-weight:bold;font-size:13px">Area Sicurezza e Salute | FORMEDIL PADOVA</p>
        <p style="margin:0;font-size:12px;color:#555;line-height:1.8">
          Via Basilicata 10<br>35127 Padova (PD)<br>
          email: <a href="mailto:cpt@formedilpadova.it" style="color:#e7500f;text-decoration:none">cpt@formedilpadova.it</a><br>
          Tel. 049 - 761168 (int.4)<br>
          URL: <a href="http://www.formedilpadova.it" style="color:#e7500f;text-decoration:none">www.formedilpadova.it</a><br>
          <span style="color:#888;font-size:11px">Organismo Accreditato Regione Veneto per la formazione L.R. n. 19 del 09.08.02 cod. AO119 per i servizi al lavoro codice L236</span>
        </p>
      </td>
      <td width="120" style="vertical-align:top;text-align:center">
        <a href="https://formedilpadovacpt.github.io/servizi/#" style="text-decoration:none">
          <img src="https://image.jimcdn.com/app/cms/image/transf/dimension=488x10000:format=png/path/s49ae6d7152f6f900/image/i5c7a83ad82ccbf42/version/1760964835/image.png" width="110" alt="QR Servizi Formedil Padova CPT" style="display:block;margin:0 auto 6px">
          <span style="font-size:9px;color:#e7500f;font-weight:bold;text-transform:uppercase;letter-spacing:.5px">FORMEDIL PADOVA · CPT</span><br>
          <span style="font-size:8px;color:#888">I NOSTRI SERVIZI</span>
        </a>
      </td>
    </tr>
    </table>

    <!-- DISCLAIMER GDPR -->
    <p style="font-size:10px;color:#aaa;margin-top:20px;line-height:1.5;font-style:italic;border-top:1px solid #eee;padding-top:12px">
      Ai sensi del Regolamento (UE) 2016/679 (GDPR) relativo alla protezione delle persone fisiche con riguardo al trattamento dei dati personali, la presente e-mail è destinata unicamente alle persone sopra indicate e le informazioni in essa contenute sono da considerarsi strettamente riservate. Se avete ricevuto questo messaggio per errore, siete pregati di rispedirlo al mittente, distruggendo qualunque copia in Vostro possesso, grazie.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`

    const toList = Array.isArray(to) ? to : [to]
    const raw = buildMime({
      from: 'cptpd@did.formedilpadova.it',
      to:   toList,
      subject: subjectFinal,
      html: htmlBody,
      attachmentB64: b64,
      attachmentName,
    })

    const gmailRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      { method:'POST', headers:{ Authorization:`Bearer ${gmailToken}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ raw }) }
    )
    const gmailData = await gmailRes.json()
    if (!gmailRes.ok || gmailData.error) throw new Error(gmailData.error?.message || JSON.stringify(gmailData))

    return new Response(JSON.stringify({ ok:true, messageId: gmailData.id }),
      { headers:{ 'Content-Type':'application/json', ...CORS } })

  } catch(e) {
    console.error('send-verbale error:', e)
    return new Response(JSON.stringify({ error: e.message }),
      { status:400, headers:{ 'Content-Type':'application/json', ...CORS } })
  }
})