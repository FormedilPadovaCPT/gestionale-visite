// Supabase Edge Function – upload-pdf
// Salva il PDF del verbale nell'ARCHIVIO DEI VERBALI del vault (09/10/2026, chiesto dall'utente):
//   2_AREE/Sopralluoghi/verbali/ES_aaaa-aaaa/Verbale_NNNN_Impresa_Comune_Tecnico_aaaa mm gg.pdf
// Un verbale ha UN file solo:
//   · se il file del verbale c'e' gia' e i dati non sono cambiati (stessa «impronta» mandata dalla
//     pagina) non si scrive niente e si restituisce quello che c'e';
//   · se i dati sono cambiati si SOSTITUISCE il contenuto dello stesso file (stesso id, stesso link
//     pubblico): niente piu' copie «(1)», «(2)»;
//   · altrimenti si crea, con il link pubblico in lettura come prima (lo chiede l'utente: qualcosa lo usa).
// Se l'archivio non si raggiunge, il PDF va nella cartella di prima (DRIVE_VERBALI_FOLDER_ID), come
// prima del 09/10: l'invio del verbale non deve mai fermarsi per l'archivio. La risposta lo dice.
//
// Secrets richiesti:
//   GOOGLE_SERVICE_ACCOUNT_JSON  – service account JSON (delega: agisce come cptpd@)
//   DRIVE_VERBALI_FOLDER_ID      – cartella di prima, «9_APPLICATIVI/Gestionale_Visite/01 Sopralluoghi
//                                  in cantiere/Verbali»: serve da ancora per trovare la radice del vault
//                                  e da ripiego
//   VERBALI_ARCHIVIO_PERCORSO    – facoltativo, predefinito «2_AREE/Sopralluoghi/verbali»

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

const DRIVE = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
const TUTTI = 'supportsAllDrives=true&includeItemsFromAllDrives=true'
const qv = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

async function cerca(token: string, q: string, campi = 'files(id,name)'): Promise<any[]> {
  const r = await fetch(`${DRIVE}?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(campi)}&pageSize=20&${TUTTI}`,
    { headers: { Authorization: `Bearer ${token}` } })
  const d = await r.json()
  if (!r.ok) throw new Error('Drive: ' + JSON.stringify(d).slice(0, 200))
  return d.files || []
}
const CARTELLA = "mimeType='application/vnd.google-apps.folder' and trashed=false"

/* La radice del vault: si risale dalla cartella di prima (che sta dentro il vault) finche' si trova la
   cartella che contiene la prima voce del percorso («2_AREE»). Cosi' non si confonde con un'altra
   cartella omonima altrove nel Drive. */
async function radiceVault(token: string, ancora: string, primo: string): Promise<string | null> {
  let id = ancora
  for (let i = 0; i < 8; i++) {
    const r = await fetch(`${DRIVE}/${id}?fields=parents&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } })
    const d = await r.json()
    const padre = d.parents?.[0]
    if (!padre) return null
    const f = await cerca(token, `name='${qv(primo)}' and '${padre}' in parents and ${CARTELLA}`)
    if (f.length) return padre
    id = padre
  }
  return null
}
async function sottocartella(token: string, padre: string, nome: string, crea: boolean): Promise<string | null> {
  const f = await cerca(token, `name='${qv(nome)}' and '${padre}' in parents and ${CARTELLA}`)
  if (f.length) return f[0].id
  if (!crea) return null
  const c = await fetch(`${DRIVE}?supportsAllDrives=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nome, mimeType: 'application/vnd.google-apps.folder', parents: [padre] }),
  })
  const cd = await c.json()
  if (!cd.id) throw new Error('Cartella non creata: ' + JSON.stringify(cd).slice(0, 200))
  return cd.id
}

/* Esercizio dell'ente 1/10-30/9: dal numero «CPT/26_27/0003», altrimenti dalla data della visita. */
function esercizio(nr: string, data: string): string {
  const m = /(\d{2})_(\d{2})/.exec(nr || '')
  if (m) return `ES_20${m[1]}-20${m[2]}`
  const d = new Date((data || '') + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  const a = d.getFullYear()
  return d.getMonth() >= 9 ? `ES_${a}-${a + 1}` : `ES_${a - 1}-${a}`
}
const pulisci = (s: unknown) => String(s ?? '').replace(/[\\/:*?"<>|\r\n\t_]/g, ' ').replace(/\s+/g, ' ').trim()
/* il comune scritto tutto maiuscolo diventa «Piazzola sul Brenta», com'e' nei nomi gia' in archivio */
function comuneLeggibile(s: string): string {
  const c = pulisci(s)
  if (c !== c.toUpperCase()) return c
  const minuscole = new Set(['di', 'del', 'della', 'sul', 'sulla', 'in', 'al', 'e', 'd'])
  return c.toLowerCase().split(' ').map((w, i) => (i > 0 && minuscole.has(w)) ? w
    : w.replace(/(^|['’-])(\p{L})/gu, (_m, a, b) => a + b.toUpperCase())).join(' ')
}
/* (09/10/2026, chiesto dall'utente: «il nome dell'azienda potrebbe essere ridotto, altrimenti viene troppo lungo»)
   Nel nome del file l'impresa va senza forma giuridica e senza i soci che la seguono («ROR COSTRUZIONI S.A.S.
   DI ROSU IONEL & C» → «ROR COSTRUZIONI»), come le cartelle-impresa dell'asseverazione, e al massimo 35
   caratteri tagliati fra due parole. La ragione sociale intera resta nel database e sul PDF. */
const FORMA_GIURIDICA = /\s(?:&\s*c\.?\s*)?(?:s\.?\s?r\.?\s?l\.?\s?s?|s\.?\s?p\.?\s?a|s\.?\s?n\.?\s?c|s\.?\s?a\.?\s?s|s\.?\s?c\.?\s?a\.?\s?r\.?\s?l|soc(?:iet[àa]'?)?\.?\s+coop\S*|coop\S*)\.?(?=\s|$).*$/iu
export function impresaBreve(s: unknown, max = 35): string {
  const tutto = pulisci(s)
  let c = tutto.replace(FORMA_GIURIDICA, '').replace(/\s+(&|e)\s*c\.?$/i, '').trim() || tutto
  if (c.length > max) {
    let r = ''
    for (const p of c.split(' ')) { if ((r ? r.length + 1 : 0) + p.length > max) break; r = r ? r + ' ' + p : p }
    c = r || c.slice(0, max)
  }
  return c.replace(/(\s+(di|dei|del|della|e|&))+$/i, '').replace(/[ ,&-]+$/, '') || tutto.slice(0, max)
}
/* Verbale_NNNN_Impresa_Comune_Tecnico_aaaa mm gg.pdf — la convenzione dei verbali del vault */
export function nomeArchivio(x: { nr: string; impresa: string; comune: string; tecnico: string; data: string }): string {
  const num = ((x.nr || '').match(/(\d+)\s*$/)?.[1] || '').padStart(4, '0').slice(-4) || 'SN'
  const imp = impresaBreve(x.impresa) || 'ImpresaNonIndicata'
  const com = comuneLeggibile(x.comune) || 'ComuneNonDocumentato'
  const tec = pulisci(x.tecnico) || 'TecnicoNonIndicato'
  const dat = /^\d{4}-\d{2}-\d{2}/.test(x.data || '') ? x.data.slice(0, 10).replace(/-/g, ' ') : 'data-non-indicata'
  return `Verbale_${num}_${imp}_${com}_${tec}_${dat}.pdf`
}

function multipart(meta: Record<string, unknown>, pdf: Uint8Array | null): { body: Uint8Array; tipo: string } {
  const b = '-------PdfVerbale'
  const enc = new TextEncoder()
  const parti = [enc.encode(`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`)]
  if (pdf) { parti.push(enc.encode(`--${b}\r\nContent-Type: application/pdf\r\n\r\n`), pdf) }
  parti.push(enc.encode(`\r\n--${b}--`))
  const tot = parti.reduce((s, p) => s + p.length, 0)
  const body = new Uint8Array(tot)
  let off = 0
  for (const p of parti) { body.set(p, off); off += p.length }
  return { body, tipo: `multipart/related; boundary=${b}` }
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
    const PERCORSO = (Deno.env.get('VERBALI_ARCHIVIO_PERCORSO') || '2_AREE/Sopralluoghi/verbali').split('/').map((s) => s.trim()).filter(Boolean)

    const sa    = JSON.parse(SA_JSON)
    const token = await getAccessToken(sa)

    const { pdf_base64, nr_verbale, data_visita, visita_id, impronta, verifica } = await req.json()

    // I dati del nome si leggono dal database, non dalla maschera: impresa principale, comune del
    // cantiere, cognome del tecnico, numero e data del verbale salvato.
    let info = { nr: String(nr_verbale || ''), data: String(data_visita || ''), impresa: '', comune: '', tecnico: '' }
    if (visita_id) {
      const adm = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
      const { data: v, error } = await adm.from('visite')
        .select('nr_verbale,data_visita,imprese(impresa_nome),cantieri(comune_nome),tecnici!visite_tecnico_id_fkey(tecnico_cognome)')
        .eq('visita_id', visita_id).maybeSingle()
      if (error) console.warn('upload-pdf: dati del verbale non letti:', error.message)
      if (v) info = {
        nr: v.nr_verbale || info.nr, data: v.data_visita || info.data,
        impresa: (v as any).imprese?.impresa_nome || '', comune: (v as any).cantieri?.comune_nome || '',
        tecnico: (v as any).tecnici?.tecnico_cognome || '',
      }
    }
    const nome = nomeArchivio(info)
    const es = esercizio(info.nr, info.data)

    // La cartella dell'archivio. Se non si trova si usa quella di prima, e la risposta lo dice.
    let cartella: string | null = null
    let motivo = ''
    try {
      const radice = await radiceVault(token, FOLDER_ID, PERCORSO[0])
      if (!radice) motivo = 'radice del vault non trovata'
      else {
        let id: string | null = radice
        for (const p of PERCORSO) { id = id ? await sottocartella(token, id, p, false) : null }
        if (!id) motivo = 'percorso ' + PERCORSO.join('/') + ' non trovato'
        else if (!es) motivo = 'esercizio non ricavabile'
        else cartella = await sottocartella(token, id, es, !verifica)
      }
    } catch (e) { motivo = (e as Error).message }
    const archivio = !!cartella
    const dove = cartella || FOLDER_ID

    if (verifica) {
      return new Response(JSON.stringify({ ok: true, verifica: true, archivio, motivo, cartella: archivio ? PERCORSO.join('/') + '/' + es : null, cartella_id: cartella, nome }),
        { headers: { 'Content-Type': 'application/json', ...CORS } })
    }
    if (!pdf_base64) throw new Error('pdf_base64 mancante')

    // Il file di questo verbale, se c'e' gia': prima per l'identificativo della visita, poi per il numero
    // (i file spostati a mano nell'archivio non hanno ancora l'identificativo).
    const campi = 'files(id,name,webViewLink,appProperties)'
    let esist: any = null
    if (visita_id) esist = (await cerca(token, `'${dove}' in parents and trashed=false and appProperties has { key='visita_id' and value='${qv(String(visita_id))}' }`, campi))[0] || null
    if (!esist && archivio && /^Verbale_\d{4}_/.test(nome)) {
      const pref = nome.slice(0, 13)   // «Verbale_0003_»
      esist = (await cerca(token, `'${dove}' in parents and trashed=false and name contains '${qv(pref)}'`, campi))
        .find((f) => String(f.name).startsWith(pref)) || null
    }
    const props: Record<string, string> = { visita_id: String(visita_id || '') }
    if (impronta) props.impronta = String(impronta)

    const risposta = (f: any, esito: string) => new Response(JSON.stringify({
      ok: true, esito, archivio, motivo: archivio ? undefined : motivo,
      drive_file_id: f.id,
      drive_url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
      file_name: f.name || nome,
    }), { headers: { 'Content-Type': 'application/json', ...CORS } })

    // 1. stessi dati: non si riscrive niente (al massimo si corregge il nome)
    if (esist && impronta && esist.appProperties?.impronta === String(impronta)) {
      if (esist.name !== nome) {
        await fetch(`${DRIVE}/${esist.id}?supportsAllDrives=true`, {
          method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: nome }),
        })
        esist.name = nome
      }
      return risposta(esist, 'invariato')
    }

    const pdfBytes = Uint8Array.from(atob(pdf_base64), (c) => c.charCodeAt(0))

    // 2. dati cambiati: si sostituisce il contenuto dello STESSO file (id e link pubblico restano)
    if (esist) {
      const { body, tipo } = multipart({ name: nome, appProperties: props }, pdfBytes)
      const r = await fetch(`${UPLOAD}/${esist.id}?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true`,
        { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': tipo }, body })
      const d = await r.json()
      if (!d.id) throw new Error('Sostituzione su Drive non riuscita: ' + JSON.stringify(d).slice(0, 200))
      return risposta(d, 'sostituito')
    }

    // 3. nuovo: si crea, con il link pubblico in lettura come prima
    const { body, tipo } = multipart({ name: nome, parents: [dove], appProperties: props }, pdfBytes)
    const up = await fetch(`${UPLOAD}?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': tipo }, body })
    const upData = await up.json()
    if (!upData.id) throw new Error('Upload Drive fallito: ' + JSON.stringify(upData).slice(0, 200))
    await fetch(`${DRIVE}/${upData.id}/permissions?supportsAllDrives=true`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    })
    return risposta(upData, 'creato')

  } catch (e) {
    console.error('upload-pdf error:', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } })
  }
})
